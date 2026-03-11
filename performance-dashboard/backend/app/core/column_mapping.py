"""기존 analyze_naver_ads.py에서 추출한 컬럼 매핑 로직."""

from __future__ import annotations

from typing import Dict, List

from .parsers import normalize_header

COLUMN_ALIASES: Dict[str, List[str]] = {
    "campaign": ["campaign", "campaign_name", "캠페인", "캠페인명"],
    "adgroup": ["adgroup", "ad_group", "adgroup_name", "광고그룹", "광고그룹명"],
    "keyword": ["keyword", "키워드", "검색어"],
    "impressions": ["impressions", "노출수"],
    "clicks": ["clicks", "클릭수"],
    "cost": ["cost", "spend", "광고비", "총비용", "비용"],
    "conversions": ["conversions", "총 전환수", "총_전환수", "전환수", "전환"],
    "revenue": ["revenue", "매출", "총 전환매출액", "총_전환매출액", "전환매출"],
    "avg_cpc": ["avg_cpc", "cpc", "평균클릭비용"],
    "ctr": ["ctr", "클릭률"],
    "roas": ["roas", "총 광고수익률", "총_광고수익률", "광고수익률"],
    "date": ["date", "날짜", "일자", "기간"],
}


def _strip_parens(s: str) -> str:
    """괄호와 그 내용을 제거: '총비용(VAT포함,원)' → '총비용'."""
    import re
    return re.sub(r"\(.*?\)", "", s).strip()


def build_column_map(headers: List[str]) -> Dict[str, str]:
    norm = {normalize_header(h): h for h in headers}
    # 괄호 제거 버전도 준비 (fallback 매칭용)
    norm_stripped = {normalize_header(_strip_parens(h)): h for h in headers}
    result: Dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_norm = normalize_header(alias)
            # 1차: 정확 매칭
            if alias_norm in norm:
                result[canonical] = norm[alias_norm]
                break
            # 2차: 괄호 제거 후 매칭
            if alias_norm in norm_stripped:
                result[canonical] = norm_stripped[alias_norm]
                break
        else:
            # 3차: 헤더에 alias가 포함되어 있으면 매칭 (예: "총 전환수"에 "전환수" 포함)
            for alias in aliases:
                alias_norm = normalize_header(alias)
                for header_norm, header_orig in norm.items():
                    if alias_norm in header_norm and canonical not in result:
                        result[canonical] = header_orig
                        break
                if canonical in result:
                    break
    return result


def safe_get(row: Dict[str, str], mapping: Dict[str, str], key: str, default: str = "") -> str:
    real = mapping.get(key)
    if not real:
        return default
    return row.get(real, default)
