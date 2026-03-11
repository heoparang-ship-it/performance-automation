"""최적화 API 엔드포인트."""

from __future__ import annotations

import datetime as dt
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...config import DEFAULT_THRESHOLDS
from ...core.security import get_current_user
from ...database import get_db
from ...models.optimization import OptimizationAction, OptimizationJob
from ...models.setting import Setting
from ...models.store import Store
from ...models.user import User
from ...schemas.optimization import (
    OptimizationActionContext,
    OptimizationActionOut,
    OptimizationActionUpdateRequest,
    OptimizationExecuteRequest,
    OptimizationExecuteResponse,
    OptimizationExecuteSummary,
    OptimizationJobListItem,
    OptimizationJobOut,
    OptimizationPreviewRequest,
    OptimizationPreviewResponse,
    OptimizationPreviewSummary,
)
from ...services.naver_api import NaverAdsClient
from ...services.naver_realtime import invalidate_cache
from ...services.optimization_engine import (
    execute_single_action,
    generate_optimization_plan,
)

router = APIRouter(prefix="/optimization", tags=["optimization"])

SETTINGS_KEY = "naver_api_credentials"


# ── 헬퍼 ──


def _resolve_client(store_id: int, db: Session):
    """store_id → NaverAdsClient + customer_id."""
    store = db.query(Store).filter_by(id=store_id).first()
    if not store or not store.customer_id:
        raise HTTPException(
            status_code=400, detail="스토어에 연결된 광고주가 없습니다."
        )
    setting = db.query(Setting).filter_by(key=SETTINGS_KEY).first()
    if not setting:
        raise HTTPException(
            status_code=400, detail="네이버 API 인증 정보가 설정되지 않았습니다."
        )
    creds = json.loads(setting.value)
    client = NaverAdsClient(
        api_key=creds["api_key"],
        secret_key=creds["secret_key"],
        customer_id=creds["customer_id"],
    )
    return client, store.customer_id


def _get_thresholds(db: Session) -> dict:
    setting = db.query(Setting).filter_by(key="thresholds").first()
    if setting:
        return json.loads(setting.value)
    return dict(DEFAULT_THRESHOLDS)


def _action_to_out(action: OptimizationAction) -> OptimizationActionOut:
    ctx = None
    if action.context_impressions is not None:
        ctx = OptimizationActionContext(
            impressions=action.context_impressions or 0,
            clicks=action.context_clicks or 0,
            cost=action.context_cost or 0,
            conversions=action.context_conversions or 0,
            roas=action.context_roas or 0,
            ctr=action.context_ctr or 0,
            cpc=action.context_cpc or 0,
        )
    return OptimizationActionOut(
        id=action.id,
        job_id=action.job_id,
        rule_id=action.rule_id,
        priority=action.priority,
        level=action.level,
        reason=action.reason,
        action_description=action.action_description,
        campaign_id=action.campaign_id,
        campaign_name=action.campaign_name,
        adgroup_id=action.adgroup_id,
        adgroup_name=action.adgroup_name,
        keyword_id=action.keyword_id,
        keyword_text=action.keyword_text,
        action_type=action.action_type,
        before_value=json.loads(action.before_value) if action.before_value else None,
        after_value=json.loads(action.after_value) if action.after_value else None,
        change_pct=action.change_pct,
        status=action.status,
        error_message=action.error_message,
        executed_at=action.executed_at,
        created_at=action.created_at,
        context=ctx,
    )


def _build_preview_summary(
    actions: List[OptimizationActionOut],
) -> OptimizationPreviewSummary:
    by_type: dict[str, int] = {}
    by_level: dict[str, int] = {}
    cost_savings = 0

    for a in actions:
        by_type[a.action_type] = by_type.get(a.action_type, 0) + 1
        by_level[a.level] = by_level.get(a.level, 0) + 1
        if a.action_type == "keyword_pause" and a.context:
            cost_savings += a.context.cost
        elif a.action_type == "add_negative_keyword" and a.context:
            cost_savings += a.context.cost
        elif a.action_type == "bid_down" and a.change_pct and a.context:
            cost_savings += int(a.context.cost * abs(a.change_pct) / 100)

    return OptimizationPreviewSummary(
        total_actions=len(actions),
        by_type=by_type,
        by_level=by_level,
        estimated_cost_savings=cost_savings,
    )


# ── 1. 미리보기 ──


@router.post("/preview", response_model=OptimizationPreviewResponse)
def preview_optimization(
    body: OptimizationPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """최적화 미리보기: 성과 분석 후 제안 액션 반환."""
    client, customer_id = _resolve_client(body.store_id, db)
    thresholds = _get_thresholds(db)

    end_date = dt.date.today() - dt.timedelta(days=1)
    start_date = end_date - dt.timedelta(days=body.period_days - 1)

    proposed = generate_optimization_plan(
        client, customer_id, start_date, end_date, thresholds
    )

    # Job 생성
    job = OptimizationJob(
        store_id=body.store_id,
        customer_id=customer_id,
        status="preview",
        total_actions=len(proposed),
        analysis_period_start=start_date,
        analysis_period_end=end_date,
        created_by=current_user.id,
    )
    db.add(job)
    db.flush()

    # Action 레코드 생성
    action_records = []
    for p in proposed:
        action = OptimizationAction(
            job_id=job.id,
            rule_id=p.rule_id,
            priority=p.priority,
            level=p.level,
            reason=p.reason,
            campaign_id=p.campaign_id,
            campaign_name=p.campaign_name,
            adgroup_id=p.adgroup_id,
            adgroup_name=p.adgroup_name,
            keyword_id=p.keyword_id,
            keyword_text=p.keyword_text,
            action_type=p.action_type,
            action_description=p.action_description,
            before_value=json.dumps(p.before_value, ensure_ascii=False),
            after_value=json.dumps(p.after_value, ensure_ascii=False),
            change_pct=p.change_pct,
            status="pending",
            context_impressions=p.context.get("impressions"),
            context_clicks=p.context.get("clicks"),
            context_cost=p.context.get("cost"),
            context_conversions=p.context.get("conversions"),
            context_roas=p.context.get("roas"),
            context_ctr=p.context.get("ctr"),
            context_cpc=p.context.get("cpc"),
        )
        db.add(action)
        action_records.append(action)

    db.commit()
    db.refresh(job)
    for a in action_records:
        db.refresh(a)

    actions_out = [_action_to_out(a) for a in action_records]
    summary = _build_preview_summary(actions_out)

    return OptimizationPreviewResponse(
        job=OptimizationJobOut.model_validate(job),
        actions=actions_out,
        summary=summary,
    )


# ── 2. 실행 ──


@router.post("/execute", response_model=OptimizationExecuteResponse)
def execute_optimization(
    body: OptimizationExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """승인된 최적화 액션 실행."""
    job = db.query(OptimizationJob).filter_by(id=body.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")
    if job.status not in ("preview", "approved"):
        raise HTTPException(
            status_code=400, detail=f"실행할 수 없는 상태: {job.status}"
        )

    client, customer_id = _resolve_client(job.store_id, db)

    # 제외 처리
    if body.excluded_action_ids:
        db.query(OptimizationAction).filter(
            OptimizationAction.job_id == job.id,
            OptimizationAction.id.in_(body.excluded_action_ids),
        ).update({"status": "excluded"}, synchronize_session=False)

    # 실행 대상 조회
    actions_to_execute = (
        db.query(OptimizationAction)
        .filter_by(job_id=job.id)
        .filter(OptimizationAction.status.in_(["pending", "approved"]))
        .order_by(OptimizationAction.priority.desc())
        .all()
    )

    job.status = "executing"
    job.executed_at = dt.datetime.now()
    db.flush()

    success_count = 0
    fail_count = 0

    for action in actions_to_execute:
        after_val = json.loads(action.after_value) if action.after_value else {}
        result = execute_single_action(
            client=client,
            customer_id=customer_id,
            action_type=action.action_type,
            keyword_id=action.keyword_id or "",
            after_value=after_val,
            adgroup_id=action.adgroup_id or "",
        )
        action.executed_at = dt.datetime.now()
        if result["success"]:
            action.status = "success"
            success_count += 1
        else:
            action.status = "failed"
            action.error_message = result.get("error", "Unknown error")
            fail_count += 1

    job.executed_actions = success_count
    job.failed_actions = fail_count
    job.status = "completed" if fail_count == 0 else "partial"
    job.completed_at = dt.datetime.now()
    db.commit()
    db.refresh(job)

    # 캐시 무효화
    invalidate_cache(customer_id)

    all_actions = (
        db.query(OptimizationAction)
        .filter_by(job_id=job.id)
        .order_by(OptimizationAction.priority.desc())
        .all()
    )
    actions_out = [_action_to_out(a) for a in all_actions]
    excluded_count = sum(1 for a in all_actions if a.status == "excluded")

    return OptimizationExecuteResponse(
        job=OptimizationJobOut.model_validate(job),
        results=actions_out,
        summary=OptimizationExecuteSummary(
            total=len(all_actions),
            success=success_count,
            failed=fail_count,
            excluded=excluded_count,
        ),
    )


# ── 3. 히스토리 ──


@router.get("/jobs", response_model=List[OptimizationJobListItem])
def list_jobs(
    store_id: int = Query(...),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """최적화 작업 히스토리."""
    return (
        db.query(OptimizationJob)
        .filter_by(store_id=store_id)
        .order_by(OptimizationJob.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/jobs/{job_id}", response_model=OptimizationPreviewResponse)
def get_job_detail(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """작업 상세 조회."""
    job = db.query(OptimizationJob).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    actions = (
        db.query(OptimizationAction)
        .filter_by(job_id=job_id)
        .order_by(OptimizationAction.priority.desc())
        .all()
    )
    actions_out = [_action_to_out(a) for a in actions]
    summary = _build_preview_summary(actions_out)

    return OptimizationPreviewResponse(
        job=OptimizationJobOut.model_validate(job),
        actions=actions_out,
        summary=summary,
    )


# ── 4. 개별 액션 상태 변경 ──


@router.patch("/actions/{action_id}")
def update_action_status(
    action_id: int,
    body: OptimizationActionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """개별 액션 승인/제외."""
    action = db.query(OptimizationAction).filter_by(id=action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="액션을 찾을 수 없습니다.")
    if body.status not in ("approved", "excluded"):
        raise HTTPException(
            status_code=400, detail="approved 또는 excluded만 가능합니다."
        )
    action.status = body.status
    db.commit()
    return {"success": True}
