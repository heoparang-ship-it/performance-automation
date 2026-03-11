"""최적화 엔진 - 분석 규칙을 실행 가능한 API 액션으로 변환."""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

from .naver_api import NaverAdsClient
from .naver_realtime import _get_structure, _get_keywords_for_adgroup

logger = logging.getLogger(__name__)


# ── 입찰가 유틸 ──


def round_bid(amount: float) -> int:
    """입찰가를 10원 단위로 반올림. 최소 70원."""
    return max(70, round(amount / 10) * 10)


# ── 데이터 클래스 ──


@dataclass
class ProposedAction:
    """분석 결과에서 생성된 실행 가능한 액션."""

    rule_id: str
    priority: int
    level: str
    reason: str
    action_description: str

    campaign_id: str = ""
    campaign_name: str = ""
    adgroup_id: str = ""
    adgroup_name: str = ""
    keyword_id: str = ""
    keyword_text: str = ""

    action_type: str = ""
    before_value: Dict[str, Any] = field(default_factory=dict)
    after_value: Dict[str, Any] = field(default_factory=dict)
    change_pct: float | None = None

    context: Dict[str, Any] = field(default_factory=dict)


# ── 최적화 계획 생성 ──


def generate_optimization_plan(
    client: NaverAdsClient,
    customer_id: str,
    start_date: dt.date,
    end_date: dt.date,
    thresholds: Dict[str, Any] | None = None,
) -> List[ProposedAction]:
    """키워드 레벨 성과를 분석하여 최적화 액션 목록을 생성.

    Returns:
        priority 내림차순으로 정렬된 ProposedAction 리스트
    """
    if thresholds is None:
        thresholds = {}

    min_clicks = thresholds.get("min_clicks_for_pause", 30)
    low_roas = thresholds.get("low_roas_threshold", 200.0)
    high_roas = thresholds.get("high_roas_threshold", 400.0)
    high_cpc = thresholds.get("high_cpc_threshold", 1200.0)

    structure = _get_structure(client, customer_id)
    ag_ids = structure["adgroup_ids"]
    ag_map = structure["adgroup_map"]

    actions: List[ProposedAction] = []

    for ag_id in ag_ids:
        ag_info = ag_map.get(ag_id, {})
        camp_name = ag_info.get("campaign_name", "")
        camp_id = ag_info.get("campaign_id", "")
        ag_name = ag_info.get("name", "")

        keywords = _get_keywords_for_adgroup(client, customer_id, ag_id)
        if not keywords:
            continue

        kw_ids = [kw["nccKeywordId"] for kw in keywords if kw.get("nccKeywordId")]
        if not kw_ids:
            continue

        # 키워드별 성과 조회
        end_exclusive = (end_date + dt.timedelta(days=1)).isoformat()
        try:
            stats_list = client.get_stats(
                customer_id=customer_id,
                ids=kw_ids,
                start_date=start_date.isoformat(),
                end_date=end_exclusive,
                time_increment="allTime",
            )
            if isinstance(stats_list, dict):
                stats_list = stats_list.get("data", [])
        except Exception:
            logger.warning("Stats fetch failed for adgroup %s", ag_id)
            continue

        stats_map = {s.get("id", ""): s for s in stats_list if isinstance(s, dict)}

        for kw in keywords:
            kw_id = kw.get("nccKeywordId", "")
            kw_text = kw.get("keyword", "")
            current_bid = kw.get("bidAmt", 0) or 0

            # 이미 일시중지된 키워드 스킵
            if kw.get("userLock", False):
                continue

            s = stats_map.get(kw_id, {})
            imp = s.get("impCnt", 0) or 0
            clk = s.get("clkCnt", 0) or 0
            cost = s.get("salesAmt", 0) or 0
            conv = s.get("ccnt", 0) or 0
            rev = s.get("convAmt", 0) or 0
            ctr = (clk / imp * 100) if imp > 0 else 0
            avg_cpc = int(cost / clk) if clk > 0 else 0
            roas = (rev / cost * 100) if cost > 0 else 0

            ctx = {
                "impressions": imp,
                "clicks": clk,
                "cost": cost,
                "conversions": conv,
                "roas": round(roas, 1),
                "ctr": round(ctr, 2),
                "cpc": avg_cpc,
            }

            common = dict(
                campaign_id=camp_id,
                campaign_name=camp_name,
                adgroup_id=ag_id,
                adgroup_name=ag_name,
                keyword_id=kw_id,
                keyword_text=kw_text,
                context=ctx,
            )

            # ── Rule 1 (P100): 클릭 多 + 전환 0 → 키워드 일시중지 ──
            if clk >= min_clicks and conv <= 0:
                actions.append(
                    ProposedAction(
                        rule_id="rule_1",
                        priority=100,
                        level="HIGH",
                        reason=f"클릭 {clk}회, 전환 0건 (기준: {min_clicks}회 이상)",
                        action_description=f"키워드 '{kw_text}' 일시중지",
                        action_type="keyword_pause",
                        before_value={"status": "ELIGIBLE", "bid": current_bid},
                        after_value={"status": "PAUSED"},
                        **common,
                    )
                )

            # ── Rule 3 (P80): ROAS 낮음 → 입찰가 20% 하향 ──
            elif cost >= 30000 and 0 < roas < low_roas and current_bid > 0:
                new_bid = round_bid(current_bid * 0.8)
                actions.append(
                    ProposedAction(
                        rule_id="rule_3",
                        priority=80,
                        level="MEDIUM",
                        reason=f"ROAS {roas:.1f}% (목표 {low_roas:.0f}% 미만), 광고비 {cost:,.0f}원",
                        action_description=(
                            f"키워드 '{kw_text}' 입찰가 "
                            f"{current_bid:,}원 → {new_bid:,}원 (20% 하향)"
                        ),
                        action_type="bid_down",
                        before_value={"bid": current_bid},
                        after_value={"bid": new_bid},
                        change_pct=-20.0,
                        **common,
                    )
                )

            # ── Rule 4 (P75): CPC 높음 + 전환 0 → 입찰가 30% 하향 ──
            elif avg_cpc > high_cpc and conv <= 0 and current_bid > 0:
                new_bid = round_bid(current_bid * 0.7)
                actions.append(
                    ProposedAction(
                        rule_id="rule_4",
                        priority=75,
                        level="MEDIUM",
                        reason=f"평균 CPC {avg_cpc:,}원 (기준 {high_cpc:,.0f}원 초과), 전환 0건",
                        action_description=(
                            f"키워드 '{kw_text}' 입찰가 "
                            f"{current_bid:,}원 → {new_bid:,}원 (30% 하향)"
                        ),
                        action_type="bid_down",
                        before_value={"bid": current_bid},
                        after_value={"bid": new_bid},
                        change_pct=-30.0,
                        **common,
                    )
                )

            # ── Rule 5 (P60): 우수 성과 → 입찰가 10% 상향 ──
            elif roas >= high_roas and conv >= 2 and current_bid > 0:
                new_bid = round_bid(current_bid * 1.1)
                actions.append(
                    ProposedAction(
                        rule_id="rule_5",
                        priority=60,
                        level="MEDIUM",
                        reason=f"ROAS {roas:.1f}%, 전환 {conv}건 — 우수 성과",
                        action_description=(
                            f"키워드 '{kw_text}' 입찰가 "
                            f"{current_bid:,}원 → {new_bid:,}원 (10% 상향)"
                        ),
                        action_type="bid_up",
                        before_value={"bid": current_bid},
                        after_value={"bid": new_bid},
                        change_pct=10.0,
                        **common,
                    )
                )

    actions.sort(key=lambda a: a.priority, reverse=True)
    return actions


# ── 단일 액션 실행 ──


def execute_single_action(
    client: NaverAdsClient,
    customer_id: str,
    action_type: str,
    keyword_id: str,
    after_value: Dict[str, Any],
    adgroup_id: str = "",
) -> Dict[str, Any]:
    """단일 최적화 액션을 Naver API로 실행.

    Returns:
        {"success": True/False, "result": ..., "error": ...}
    """
    try:
        if action_type == "keyword_pause":
            result = client.update_keyword(
                customer_id=customer_id,
                keyword_id=keyword_id,
                status="PAUSED",
            )
            return {"success": True, "result": result}

        elif action_type == "keyword_resume":
            result = client.update_keyword(
                customer_id=customer_id,
                keyword_id=keyword_id,
                status="ELIGIBLE",
            )
            return {"success": True, "result": result}

        elif action_type in ("bid_down", "bid_up"):
            new_bid = after_value.get("bid")
            if new_bid is None:
                return {"success": False, "error": "bid value missing"}
            result = client.update_keyword(
                customer_id=customer_id,
                keyword_id=keyword_id,
                bid_amount=int(new_bid),
            )
            return {"success": True, "result": result}

        elif action_type == "add_negative_keyword":
            keyword_text = after_value.get("keyword", "")
            if not keyword_text or not adgroup_id:
                return {"success": False, "error": "keyword or adgroup_id missing"}
            result = client.add_negative_keywords(
                customer_id=customer_id,
                adgroup_id=adgroup_id,
                keywords=[keyword_text],
            )
            return {"success": True, "result": result}

        else:
            return {"success": False, "error": f"Unknown action_type: {action_type}"}

    except Exception as e:
        logger.error("Action execution failed: %s - %s", action_type, str(e))
        return {"success": False, "error": str(e)}
