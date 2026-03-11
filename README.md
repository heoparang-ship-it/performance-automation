# 네이버 검색광고 액션 추천기 (MVP)

네이버 검색광고 성과 CSV를 읽어서, 광고주 계정에서 우선 조치할 액션을 자동으로 추천하는 CLI 도구입니다.

## 1) 실행 방법

```bash
cd '/Users/heopalang/Desktop/엑스컴 개발/퍼포먼스 자동화'
python3 analyze_naver_ads.py sample_report.csv
```

## 2) 입력 CSV 형식

아래 컬럼 중 일부를 지원합니다. (한글/영문 헤더 혼용 가능)

- `campaign` / `캠페인명`
- `adgroup` / `광고그룹명`
- `keyword` / `키워드`
- `impressions` / `노출수` (필수)
- `clicks` / `클릭수` (필수)
- `cost` / `광고비` (필수)
- `conversions` / `전환수` (필수)
- `revenue` / `매출`
- `avg_cpc` / `평균클릭비용`
- `ctr` / `클릭률`
- `roas`

## 3) 기본 진단 규칙

- 클릭이 충분한데 전환이 없으면: 일시중지/입찰가 하향
- 노출이 많은데 CTR이 낮으면: 문안/키워드 재정비
- ROAS가 낮으면: 입찰 하향 및 랜딩 검토
- CPC가 높고 전환이 없으면: 품질지수 개선 + 입찰 하향
- ROAS와 전환이 높으면: 예산/입찰 확대 테스트
- 데이터가 적으면: 확장 키워드로 데이터 확보

## 4) 임계값 커스터마이즈 예시

```bash
python3 analyze_naver_ads.py sample_report.csv \
  --min-clicks-for-pause 25 \
  --low-ctr 1.2 \
  --low-roas 250 \
  --high-roas 500 \
  --high-cpc 1500
```

## 5) 다음 확장 아이디어

- 네이버 검색광고 API 연동(자동 수집)
- 캠페인/광고그룹/키워드 레벨별 규칙 분리
- 액션 결과를 Google Sheets/Notion으로 자동 리포팅
- 주간 자동 실행(cron) + Slack 알림
