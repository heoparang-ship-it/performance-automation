"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { api, Store, UploadResult } from "@/lib/api";

type UploadState = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getAllStores().then((list) => {
      setStores(list);
      if (list.length > 0) setSelectedStoreId(list[0].id);
    });
  }, []);

  const acceptFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      setErrorMsg("CSV 또는 Excel(.xlsx) 파일만 업로드 가능합니다.");
      setUploadState("error");
      return;
    }
    setFile(f);
    setUploadState("idle");
    setErrorMsg("");
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) acceptFile(f);
    },
    [acceptFile]
  );

  const handleUpload = async () => {
    if (!file || !selectedStoreId) return;
    setUploadState("uploading");
    setErrorMsg("");
    try {
      const res = await api.uploadFile(file, selectedStoreId, targetDate);
      setResult(res);
      setUploadState("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "업로드 실패");
      setUploadState("error");
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setUploadState("idle");
    setErrorMsg("");
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Upload className="w-6 h-6 text-emerald-400" />
          데이터 업로드
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          네이버 광고 보고서(CSV/Excel)를 업로드하여 퍼포먼스 데이터를
          등록합니다.
        </p>
      </div>

      {/* 설정 카드 */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">
          업로드 설정
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 광고주 선택 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">광고주</label>
            {stores.length === 0 ? (
              <p className="text-sm text-slate-500">
                등록된 광고주가 없습니다. 설정에서 추가하세요.
              </p>
            ) : (
              <select
                className="w-full text-sm border border-slate-600 rounded-lg px-3 py-2 bg-slate-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={selectedStoreId ?? ""}
                onChange={(e) => setSelectedStoreId(Number(e.target.value))}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 날짜 선택 */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              데이터 날짜
            </label>
            <input
              type="date"
              className="w-full text-sm border border-slate-600 rounded-lg px-3 py-2 bg-slate-700 text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 드래그 & 드롭 영역 */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-emerald-400 bg-emerald-500/10"
            : file
              ? "border-emerald-600 bg-slate-800"
              : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) acceptFile(f);
          }}
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
            <div className="text-left">
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-xs text-slate-400">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              className="ml-4 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">
              파일을 드래그하거나 클릭하여 선택
            </p>
            <p className="text-xs text-slate-500 mt-1">
              CSV, Excel(.xlsx, .xls) 지원
            </p>
          </>
        )}
      </div>

      {/* 업로드 버튼 */}
      {file && uploadState !== "success" && (
        <button
          className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 flex items-center justify-center gap-2"
          disabled={!selectedStoreId || uploadState === "uploading"}
          onClick={handleUpload}
        >
          {uploadState === "uploading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              업로드 중...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              업로드 시작
            </>
          )}
        </button>
      )}

      {/* 에러 메시지 */}
      {uploadState === "error" && errorMsg && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">업로드 실패</p>
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 성공 결과 */}
      {uploadState === "success" && result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-300">
                업로드 완료
              </p>
              <p className="text-xs text-emerald-400 mt-1">
                {result.filename} — {result.rows_processed.toLocaleString()}행
                처리됨
              </p>
            </div>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "처리 행수", value: result.rows_processed.toLocaleString() },
              { label: "신규 삽입", value: result.rows_inserted.toLocaleString() },
              { label: "업데이트", value: result.rows_updated.toLocaleString() },
              { label: "액션 생성", value: result.actions_generated.toLocaleString() },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-slate-800 rounded-lg border border-slate-700 p-3"
              >
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="text-lg font-bold text-white mt-1">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* 요약 */}
          {result.summary && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                요약
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">총 비용</span>
                  <p className="text-white font-medium">
                    {result.summary.total_cost.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">총 매출</span>
                  <p className="text-white font-medium">
                    {result.summary.total_revenue.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">총 전환</span>
                  <p className="text-white font-medium">
                    {result.summary.total_conversions.toLocaleString()}건
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">ROAS</span>
                  <p className="text-white font-medium">
                    {result.summary.roas.toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 감지된 컬럼 */}
          {result.columns_detected.length > 0 && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                감지된 컬럼
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.columns_detected.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 다시 업로드 */}
          <button
            className="w-full py-2.5 rounded-xl font-medium text-slate-300 border border-slate-600 hover:bg-slate-700 transition-colors"
            onClick={reset}
          >
            다른 파일 업로드
          </button>
        </div>
      )}
    </div>
  );
}
