"""최적화 관련 스키마."""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ── Request ──


class OptimizationPreviewRequest(BaseModel):
    store_id: int
    period_days: int = 7


class OptimizationExecuteRequest(BaseModel):
    job_id: int
    excluded_action_ids: List[int] = []


class OptimizationActionUpdateRequest(BaseModel):
    status: str  # approved | excluded


# ── Response 부품 ──


class OptimizationActionContext(BaseModel):
    impressions: int = 0
    clicks: int = 0
    cost: int = 0
    conversions: int = 0
    roas: float = 0
    ctr: float = 0
    cpc: int = 0


class OptimizationPreviewSummary(BaseModel):
    total_actions: int = 0
    by_type: Dict[str, int] = {}
    by_level: Dict[str, int] = {}
    estimated_cost_savings: int = 0


class OptimizationExecuteSummary(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    excluded: int = 0


# ── Response ──


class OptimizationActionOut(BaseModel):
    id: int
    job_id: int
    rule_id: str
    priority: int
    level: str
    reason: str
    action_description: str

    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    adgroup_id: Optional[str] = None
    adgroup_name: Optional[str] = None
    keyword_id: Optional[str] = None
    keyword_text: Optional[str] = None

    action_type: str
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    change_pct: Optional[float] = None

    status: str
    error_message: Optional[str] = None
    executed_at: Optional[dt.datetime] = None
    created_at: dt.datetime

    context: Optional[OptimizationActionContext] = None

    model_config = {"from_attributes": True}


class OptimizationJobOut(BaseModel):
    id: int
    store_id: int
    customer_id: str
    status: str
    total_actions: int
    executed_actions: int
    failed_actions: int
    analysis_period_start: dt.date
    analysis_period_end: dt.date
    created_at: dt.datetime
    executed_at: Optional[dt.datetime] = None
    completed_at: Optional[dt.datetime] = None
    error_summary: Optional[str] = None

    model_config = {"from_attributes": True}


class OptimizationJobListItem(BaseModel):
    id: int
    store_id: int
    status: str
    total_actions: int
    executed_actions: int
    failed_actions: int
    analysis_period_start: dt.date
    analysis_period_end: dt.date
    created_at: dt.datetime
    executed_at: Optional[dt.datetime] = None
    completed_at: Optional[dt.datetime] = None

    model_config = {"from_attributes": True}


class OptimizationPreviewResponse(BaseModel):
    job: OptimizationJobOut
    actions: List[OptimizationActionOut]
    summary: OptimizationPreviewSummary


class OptimizationExecuteResponse(BaseModel):
    job: OptimizationJobOut
    results: List[OptimizationActionOut]
    summary: OptimizationExecuteSummary
