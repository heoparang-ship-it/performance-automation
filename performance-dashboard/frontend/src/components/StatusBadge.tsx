"use client";

interface StatusBadgeProps {
  roas: number;
  clicks: number;
  conversions: number;
}

type StatusLevel = "excellent" | "good" | "warning" | "danger" | "nodata";

function getStatus(roas: number, clicks: number, conversions: number): StatusLevel {
  if (clicks < 5) return "nodata";
  if (clicks >= 20 && conversions === 0) return "danger";
  if (roas < 100 && roas > 0) return "danger";
  if (roas >= 300 && conversions >= 1) return "excellent";
  if (roas >= 100) return "good";
  if (roas === 0 && conversions === 0) return "warning";
  return "warning";
}

const STATUS_CONFIG: Record<StatusLevel, { dotClassName: string; label: string; className: string }> = {
  excellent: { dotClassName: "bg-emerald-400", label: "우수", className: "bg-emerald-950/30 text-emerald-400" },
  good: { dotClassName: "bg-yellow-400", label: "보통", className: "bg-yellow-950/30 text-yellow-400" },
  warning: { dotClassName: "bg-orange-400", label: "주의", className: "bg-orange-950/30 text-orange-400" },
  danger: { dotClassName: "bg-red-400", label: "위험", className: "bg-red-950/30 text-red-400" },
  nodata: { dotClassName: "bg-gray-500", label: "부족", className: "bg-gray-800 text-gray-400" },
};

export default function StatusBadge({ roas, clicks, conversions }: StatusBadgeProps) {
  const status = getStatus(roas, clicks, conversions);
  const config = STATUS_CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.className}`}>
      <span className={`w-2 h-2 rounded-full ${config.dotClassName} inline-block`} />
      {config.label}
    </span>
  );
}

export { getStatus, STATUS_CONFIG };
export type { StatusLevel };
