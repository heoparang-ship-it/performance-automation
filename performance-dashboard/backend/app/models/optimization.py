"""최적화 작업 모델."""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class OptimizationJob(Base):
    """최적화 작업 (한 번의 분석+실행 단위)."""

    __tablename__ = "optimization_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(String, nullable=False)
    # preview | executing | completed | partial | failed
    status: Mapped[str] = mapped_column(String, nullable=False, default="preview")
    total_actions: Mapped[int] = mapped_column(Integer, default=0)
    executed_actions: Mapped[int] = mapped_column(Integer, default=0)
    failed_actions: Mapped[int] = mapped_column(Integer, default=0)
    analysis_period_start: Mapped[dt.date] = mapped_column(Date, nullable=False)
    analysis_period_end: Mapped[dt.date] = mapped_column(Date, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
    executed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    error_summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class OptimizationAction(Base):
    """개별 최적화 액션."""

    __tablename__ = "optimization_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # 분석 규칙 정보
    rule_id: Mapped[str] = mapped_column(String, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)

    # 타겟 식별
    campaign_id: Mapped[str | None] = mapped_column(String, nullable=True)
    campaign_name: Mapped[str | None] = mapped_column(String, nullable=True)
    adgroup_id: Mapped[str | None] = mapped_column(String, nullable=True)
    adgroup_name: Mapped[str | None] = mapped_column(String, nullable=True)
    keyword_id: Mapped[str | None] = mapped_column(String, nullable=True)
    keyword_text: Mapped[str | None] = mapped_column(String, nullable=True)

    # 액션 상세
    # bid_down | bid_up | keyword_pause | keyword_resume | add_negative_keyword
    action_type: Mapped[str] = mapped_column(String, nullable=False)
    action_description: Mapped[str] = mapped_column(String, nullable=False)

    # 변경 전/후 값 (JSON 문자열)
    before_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    # 실행 상태
    # pending | approved | excluded | executing | success | failed
    status: Mapped[str] = mapped_column(String, default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    executed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    # 분석 시점 성과 컨텍스트
    context_impressions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_clicks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_conversions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    context_roas: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_ctr: Mapped[float | None] = mapped_column(Float, nullable=True)
    context_cpc: Mapped[int | None] = mapped_column(Integer, nullable=True)
