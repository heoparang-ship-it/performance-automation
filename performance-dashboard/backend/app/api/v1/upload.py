"""CSV/Excel 업로드 API."""

from __future__ import annotations

import asyncio
import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...core.security import get_current_user
from ...database import SessionLocal, get_db
from ...models.store import Store
from ...models.user import User
from ...schemas.upload import UploadResult
from ...services.csv_processor import process_csv

router = APIRouter(prefix="/upload", tags=["upload"])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


def _excel_to_csv_bytes(content: bytes) -> bytes:
    """Excel 파일(.xlsx)을 CSV bytes로 변환."""
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        raise ValueError("Excel 파일에 시트가 없습니다.")

    output = io.StringIO()
    writer = csv.writer(output)
    for row in ws.iter_rows(values_only=True):
        writer.writerow([cell if cell is not None else "" for cell in row])
    wb.close()

    return output.getvalue().encode("utf-8-sig")


def _run_file_processing(
    store_id: int,
    file_content: bytes,
    filename: str,
    target_date: date | None,
):
    """별도 스레드에서 동기적으로 파일을 처리."""
    db = SessionLocal()
    try:
        return process_csv(
            db=db,
            store_id=store_id,
            file_content=file_content,
            filename=filename,
            target_date=target_date,
        )
    finally:
        db.close()


@router.post("/csv", response_model=UploadResult)
async def upload_file(
    file: UploadFile = File(...),
    store_id: int = Query(..., description="업로드 대상 스토어 ID"),
    target_date: date | None = Query(None, description="데이터 날짜 (기본: 오늘)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 스토어 존재 확인
    store = db.query(Store).filter_by(id=store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="스토어를 찾을 수 없습니다.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    # 확장자 확인
    filename_lower = file.filename.lower()
    ext = ""
    for e in ALLOWED_EXTENSIONS:
        if filename_lower.endswith(e):
            ext = e
            break
    if not ext:
        raise HTTPException(
            status_code=400,
            detail="CSV 또는 Excel(.xlsx) 파일만 업로드 가능합니다.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # Excel이면 CSV로 변환
    if ext in (".xlsx", ".xls"):
        try:
            content = _excel_to_csv_bytes(content)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Excel 파일 변환 오류: {str(e)}",
            )

    try:
        result = await asyncio.to_thread(
            _run_file_processing,
            store_id=store_id,
            file_content=content,
            filename=file.filename,
            target_date=target_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result
