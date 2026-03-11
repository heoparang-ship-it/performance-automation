#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import math
from dataclasses import dataclass
from typing import Dict, List, Tuple


COLUMN_ALIASES = {
    "campaign": ["campaign", "campaign_name", "캠페인", "캠페인명"],
    "adgroup": ["adgroup", "ad_group", "adgroup_name", "광고그룹", "광고그룹명"],
    "keyword": ["keyword", "키워드"],
    "impressions": ["impressions", "노출수"],
    "clicks": ["clicks", "클릭수"],
    "cost": ["cost", "spend", "광고비", "비용"],
    "conversions": ["conversions", "전환수", "전환"],
    "revenue": ["revenue", "매출", "전환매출"],
    "avg_cpc": ["avg_cpc", "cpc", "평균클릭비용"],
    "ctr": ["ctr", "클릭률"],
    "roas": ["roas"],
}


@dataclass
class ActionItem:
    priority: int
    level: str
    campaign: str
    adgroup: str
    keyword: str
    reason: str
    action: str


def normalize_header(name: str) -> str:
    return name.strip().lower().replace(" ", "_")


def parse_float(val: str) -> float:
    if val is None:
        return 0.0
    txt = str(val).strip().replace(",", "")
    if txt.endswith("%"):
        txt = txt[:-1]
        try:
            return float(txt)
        except ValueError:
            return 0.0
    try:
        return float(txt)
    except ValueError:
        return 0.0


def build_column_map(headers: List[str]) -> Dict[str, str]:
    norm = {normalize_header(h): h for h in headers}
    result: Dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_norm = normalize_header(alias)
            if alias_norm in norm:
                result[canonical] = norm[alias_norm]
                break
    return result


def safe_get(row: Dict[str, str], mapping: Dict[str, str], key: str, default: str = "") -> str:
    real = mapping.get(key)
    if not real:
        return default
    return row.get(real, default)


def evaluate_row(
    row: Dict[str, str],
    mapping: Dict[str, str],
    min_clicks_for_pause: int,
    low_ctr_threshold: float,
    low_roas_threshold: float,
    high_roas_threshold: float,
    high_cpc_threshold: float,
) -> List[ActionItem]:
    campaign = safe_get(row, mapping, "campaign", "(캠페인 미지정)")
    adgroup = safe_get(row, mapping, "adgroup", "(광고그룹 미지정)")
    keyword = safe_get(row, mapping, "keyword", "(키워드 미지정)")

    impressions = parse_float(safe_get(row, mapping, "impressions", "0"))
    clicks = parse_float(safe_get(row, mapping, "clicks", "0"))
    cost = parse_float(safe_get(row, mapping, "cost", "0"))
    conversions = parse_float(safe_get(row, mapping, "conversions", "0"))
    revenue = parse_float(safe_get(row, mapping, "revenue", "0"))

    ctr = parse_float(safe_get(row, mapping, "ctr", "0"))
    if ctr == 0 and impressions > 0:
        ctr = (clicks / impressions) * 100

    avg_cpc = parse_float(safe_get(row, mapping, "avg_cpc", "0"))
    if avg_cpc == 0 and clicks > 0:
        avg_cpc = cost / clicks

    roas = parse_float(safe_get(row, mapping, "roas", "0"))
    if roas == 0 and cost > 0:
        roas = (revenue / cost) * 100

    actions: List[ActionItem] = []

    if clicks >= min_clicks_for_pause and conversions <= 0:
        actions.append(
            ActionItem(
                priority=100,
                level="HIGH",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"클릭 {clicks:.0f}회, 전환 0건",
                action="해당 키워드 일시중지 또는 입찰가 20~40% 하향",
            )
        )

    if impressions >= 500 and ctr < low_ctr_threshold:
        actions.append(
            ActionItem(
                priority=90,
                level="HIGH",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"CTR {ctr:.2f}% (기준 {low_ctr_threshold:.2f}% 미만)",
                action="광고문안/키워드 매칭 재점검, 비관련 검색어 제외",
            )
        )

    if cost >= 30000 and roas > 0 and roas < low_roas_threshold:
        actions.append(
            ActionItem(
                priority=80,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"ROAS {roas:.1f}% (목표 {low_roas_threshold:.1f}% 미만)",
                action="입찰가 10~25% 하향, 랜딩/상품 경쟁력 검토",
            )
        )

    if avg_cpc > high_cpc_threshold and conversions <= 0:
        actions.append(
            ActionItem(
                priority=75,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"평균 CPC {avg_cpc:.0f}원 (기준 {high_cpc_threshold:.0f}원 초과)",
                action="입찰가 하향 + 품질지수 개선(문안/랜딩 연관성)",
            )
        )

    if roas >= high_roas_threshold and conversions >= 2:
        actions.append(
            ActionItem(
                priority=60,
                level="MEDIUM",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"ROAS {roas:.1f}%, 전환 {conversions:.0f}건",
                action="성과 상위 키워드 예산 증액 또는 입찰가 10~15% 상향 테스트",
            )
        )

    if impressions < 100 and clicks < 3:
        actions.append(
            ActionItem(
                priority=40,
                level="LOW",
                campaign=campaign,
                adgroup=adgroup,
                keyword=keyword,
                reason=f"데이터 부족 (노출 {impressions:.0f}, 클릭 {clicks:.0f})",
                action="매칭 확장/유사 키워드 추가 후 데이터 확보",
            )
        )

    return actions


def analyze(
    input_path: str,
    min_clicks_for_pause: int,
    low_ctr_threshold: float,
    low_roas_threshold: float,
    high_roas_threshold: float,
    high_cpc_threshold: float,
) -> Tuple[List[ActionItem], Dict[str, float]]:
    actions: List[ActionItem] = []
    total_rows = 0
    total_cost = 0.0
    total_revenue = 0.0
    total_conversions = 0.0

    with open(input_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV 헤더를 찾을 수 없습니다.")
        mapping = build_column_map(reader.fieldnames)

        required = ["impressions", "clicks", "cost", "conversions"]
        missing = [k for k in required if k not in mapping]
        if missing:
            raise ValueError(f"필수 컬럼 누락: {', '.join(missing)}")

        for row in reader:
            total_rows += 1
            total_cost += parse_float(safe_get(row, mapping, "cost", "0"))
            total_revenue += parse_float(safe_get(row, mapping, "revenue", "0"))
            total_conversions += parse_float(safe_get(row, mapping, "conversions", "0"))

            actions.extend(
                evaluate_row(
                    row=row,
                    mapping=mapping,
                    min_clicks_for_pause=min_clicks_for_pause,
                    low_ctr_threshold=low_ctr_threshold,
                    low_roas_threshold=low_roas_threshold,
                    high_roas_threshold=high_roas_threshold,
                    high_cpc_threshold=high_cpc_threshold,
                )
            )

    actions.sort(key=lambda x: x.priority, reverse=True)
    summary = {
        "rows": total_rows,
        "cost": total_cost,
        "revenue": total_revenue,
        "conversions": total_conversions,
        "roas": (total_revenue / total_cost * 100) if total_cost > 0 else 0.0,
    }
    return actions, summary


def print_report(actions: List[ActionItem], summary: Dict[str, float], top_n: int) -> None:
    print("=" * 80)
    print("네이버 검색광고 액션 추천 리포트")
    print("=" * 80)
    print(
        f"행 수: {summary['rows']:.0f} | 광고비: {summary['cost']:.0f}원 | "
        f"매출: {summary['revenue']:.0f}원 | 전환: {summary['conversions']:.0f}건 | "
        f"ROAS: {summary['roas']:.1f}%"
    )
    print("-" * 80)

    if not actions:
        print("추천 액션이 없습니다. 현재 규칙 기준에서 특이점이 감지되지 않았습니다.")
        return

    show = actions[:top_n] if top_n > 0 else actions
    for i, a in enumerate(show, start=1):
        print(f"[{i}] ({a.level}) {a.campaign} > {a.adgroup} > {a.keyword}")
        print(f"    사유: {a.reason}")
        print(f"    액션: {a.action}")

    if len(actions) > len(show):
        print("-" * 80)
        print(f"총 {len(actions)}개 중 상위 {len(show)}개만 출력했습니다.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="네이버 검색광고 성과 CSV를 분석해 액션을 추천합니다."
    )
    parser.add_argument("input_csv", help="분석할 CSV 파일 경로")
    parser.add_argument("--top", type=int, default=20, help="출력할 최대 액션 수 (기본 20)")
    parser.add_argument("--min-clicks-for-pause", type=int, default=30)
    parser.add_argument("--low-ctr", type=float, default=1.0, help="낮은 CTR 기준(%%)")
    parser.add_argument("--low-roas", type=float, default=200.0, help="낮은 ROAS 기준(%%)")
    parser.add_argument("--high-roas", type=float, default=400.0, help="우수 ROAS 기준(%%)")
    parser.add_argument("--high-cpc", type=float, default=1200.0, help="높은 CPC 기준(원)")

    args = parser.parse_args()

    actions, summary = analyze(
        input_path=args.input_csv,
        min_clicks_for_pause=args.min_clicks_for_pause,
        low_ctr_threshold=args.low_ctr,
        low_roas_threshold=args.low_roas,
        high_roas_threshold=args.high_roas,
        high_cpc_threshold=args.high_cpc,
    )
    print_report(actions, summary, args.top)


if __name__ == "__main__":
    main()
