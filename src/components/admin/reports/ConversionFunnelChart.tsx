import type { FunnelStage } from "@/lib/reports/accessAnalytics";
import ReportCard from "./ReportCard";

interface Props {
  data: FunnelStage[];
  loading?: boolean;
}

// Dải màu xanh → tím (theo mẫu tham khảo).
const COLORS = [
  "hsl(205 85% 55%)",
  "hsl(228 68% 58%)",
  "hsl(258 55% 60%)",
  "hsl(288 55% 62%)",
];

const num = (n: number) => n.toLocaleString("vi-VN");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pct = (v: number) => `${v.toFixed(v > 0 && v < 10 ? 1 : 0)}%`;

// viewBox cố định chiều dọc; preserveAspectRatio="none" chỉ giãn NGANG nên chiều
// cao không méo. Chữ vẽ bằng HTML overlay → không phóng to theo bề rộng.
const VB_W = 1000;
const VB_H = 150;
const MID = VB_H / 2;
const MAX_HALF = 66; // nửa chiều cao lát đầu phễu
const GAP = 10; // khe giữa các lát (đơn vị viewBox ngang)

/**
 * Nửa chiều cao từng bậc: thu nhỏ dần theo cấp số nhân (0.6–0.85 lần bước trước)
 * để phễu LUÔN bé dần đều, kể cả khi dữ liệu lệch mạnh (vd 635 → 1). Con số thật
 * hiển thị ở nhãn; hình phễu chỉ thể hiện thứ tự giảm.
 */
function halfHeights(values: number[]): number[] {
  const out: number[] = [];
  let rmin = values[0] || 1;
  let half = MAX_HALF;
  out.push(half);
  for (let i = 1; i < values.length; i++) {
    rmin = Math.min(rmin, values[i]);
    const prev = Math.min(rmin, values[i - 1]) || 1;
    const ratio = clamp(rmin / prev, 0.6, 0.85);
    half = half * ratio;
    out.push(half);
  }
  return out;
}

export default function ConversionFunnelChart({ data, loading }: Props) {
  const empty = !loading && data.every((d) => d.value === 0);
  const n = data.length;
  const cw = VB_W / Math.max(n, 1);
  const halves = halfHeights(data.map((d) => d.value));

  return (
    <ReportCard
      title="Phễu chuyển đổi người dùng"
      subtitle="Truy cập → Đăng ký → Kích hoạt → Tiêu credit (theo khoảng thời gian đã chọn)"
      loading={loading}
      empty={empty}
    >
      <div className="relative w-full" style={{ height: VB_H }}>
        <svg
          width="100%"
          height={VB_H}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0"
          role="img"
          aria-label="Phễu chuyển đổi người dùng"
        >
          {data.map((stage, i) => {
            const xL = i * cw + GAP / 2;
            const xR = (i + 1) * cw - GAP / 2;
            const lh = halves[i];
            const rh = i < n - 1 ? halves[i + 1] : halves[i] * 0.9;
            const points = [
              `${xL},${MID - lh}`,
              `${xR},${MID - rh}`,
              `${xR},${MID + rh}`,
              `${xL},${MID + lh}`,
            ].join(" ");
            return <polygon key={stage.key} points={points} fill={COLORS[i % COLORS.length]} />;
          })}
        </svg>

        {/* Overlay chữ (cỡ cố định) — chỉ hiện khi lát đủ cao để đọc. */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {data.map((stage, i) =>
            halves[i] * 2 >= 22 ? (
              <div key={stage.key} className="flex items-center justify-center">
                <div className="text-center leading-tight text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>
                  <div className="text-base font-bold tabular-nums">{num(stage.value)}</div>
                  <div className="text-[11px] opacity-95">{pct(stage.pctOfTop)}</div>
                </div>
              </div>
            ) : (
              <div key={stage.key} />
            ),
          )}
        </div>
      </div>

      {/* Chú thích: màu + bậc + % so với tổng truy cập */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4">
        {data.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="font-medium text-foreground">{stage.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {num(stage.value)} · {pct(stage.pctOfTop)}
            </span>
          </div>
        ))}
      </div>
    </ReportCard>
  );
}
