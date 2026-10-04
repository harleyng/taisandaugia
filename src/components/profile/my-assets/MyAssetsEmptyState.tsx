import type { CSSProperties } from "react";
import { BarChart3, FileCheck2, ListFilter, Mail, SearchCheck, Workflow, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const BENEFITS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: SearchCheck, title: "Gom tài sản về một mối", desc: "Sàn tự tìm tài sản đứng tên bạn" },
  { icon: FileCheck2, title: "Số hoá tài sản", desc: "Đưa tài sản lên không gian số" },
  { icon: ListFilter, title: "Chọn tổ chức qua báo giá", desc: "So sánh phí trước khi ký gửi" },
  { icon: Workflow, title: "Theo dõi đến khi thu tiền", desc: "Từ niêm yết đến hợp đồng" },
  { icon: Mail, title: "Tiếp cận đúng nhà đầu tư", desc: "Thư mời đúng người cần mua" },
  { icon: BarChart3, title: "Báo cáo định kỳ", desc: "Kết quả, dòng tiền theo kỳ" },
];

// Lưới chấm trang trí ở góc khối "Có gì trong Trạm điều hành?".
const dots = (alpha: number, at: string): CSSProperties => ({
  backgroundImage: `radial-gradient(hsl(var(--primary) / ${alpha}) 1.2px, transparent 1.3px)`,
  backgroundSize: "16px 16px",
  maskImage: `radial-gradient(80% 100% at ${at}, #000 18%, transparent 74%)`,
  WebkitMaskImage: `radial-gradient(80% 100% at ${at}, #000 18%, transparent 74%)`,
});

/** Người dùng chưa có không gian Chủ tài sản lẫn hồ sơ xác thực nào. */
export function MyAssetsEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="overflow-hidden rounded-[18px] bg-card bg-[radial-gradient(70%_120%_at_0%_0%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(60%_100%_at_100%_100%,hsl(var(--accent)/0.14),transparent_60%)] shadow-card">
        <div className="grid items-stretch xl:min-h-[280px] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] xl:gap-8 xl:pl-9">
          <div className="flex flex-col items-start justify-center px-6 pb-2 pt-7 xl:px-0 xl:py-9">
            <h2 className="text-2xl font-bold leading-[1.25] tracking-tight [text-wrap:balance]">
              Thu hồi vốn từ tài sản đấu giá nhanh hơn
            </h2>
            <p className="mb-8 mt-2 text-[14.5px] text-muted-foreground [text-wrap:pretty]">
              Xác thực ngay để truy cập{" "}
              <strong className="bg-[linear-gradient(transparent_62%,hsl(var(--accent)/0.35)_62%)] px-0.5 font-bold text-primary">
                Trạm điều hành
              </strong>{" "}
              tài sản.
            </p>
            <Button onClick={onStart} className="h-[42px] px-5 text-sm font-semibold">
              Bắt đầu xác thực →
            </Button>
          </div>
          <StationIllustration />
        </div>
      </section>

      <section className="relative flex flex-col gap-[22px] overflow-hidden rounded-[20px] bg-[radial-gradient(40%_60%_at_100%_0%,hsl(var(--primary)/0.16),transparent_70%),radial-gradient(35%_55%_at_0%_100%,hsl(var(--accent)/0.2),transparent_70%)] bg-[hsl(var(--tier-basic-2))] p-7 shadow-card">
        <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-[150px] w-[46%]" style={dots(0.22, "100% 0%")} />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-[140px] w-[40%]" style={dots(0.16, "0% 100%")} />
        <header className="relative">
          <h3 className="text-[22px] font-bold tracking-tight">
            Có gì trong <span className="text-primary">Trạm điều hành</span>?
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">Mọi công cụ để điều hành tài sản, trong một nơi.</p>
        </header>
        <ul className="relative grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex flex-col items-start gap-3.5 rounded-2xl bg-card px-6 py-[22px] shadow-card transition-shadow duration-150 hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.05),0_12px_28px_-8px_hsl(var(--foreground)/0.14)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-primary/10 text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 max-w-full">
                <b className="block text-[15px] font-semibold">{title}</b>
                <span className="mt-1 block truncate text-[13.5px] text-muted-foreground">{desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

const ROW_TAGS = [
  { label: "Đấu giá", className: "bg-primary/10 text-primary" },
  { label: "Sau trúng", className: "bg-warning/15 text-warning" },
  { label: "Chuẩn bị", className: "bg-muted text-muted-foreground" },
];

/** Minh hoạ Trạm điều hành — hình trang trí, số liệu không phải dữ liệu thật. */
function StationIllustration() {
  return (
    <div
      aria-hidden
      className="relative min-h-[240px] overflow-hidden bg-[radial-gradient(80%_80%_at_85%_10%,hsl(var(--primary)/0.22),transparent_70%),radial-gradient(60%_70%_at_10%_100%,hsl(var(--accent)/0.3),transparent_70%)] bg-[hsl(var(--tier-std-hover))] xl:min-h-[280px]"
    >
      <div className="absolute left-[12%] right-[6%] top-1/2 -translate-y-1/2 rounded-xl bg-card px-3 pb-2.5 text-[11px] shadow-[0_18px_40px_-16px_hsl(var(--primary)/0.35)]">
        <div className="-mx-3 mb-2.5 flex h-[26px] items-center gap-1 border-b border-border px-2.5">
          <i className="h-[7px] w-[7px] rounded-full bg-muted-foreground/25" />
          <i className="h-[7px] w-[7px] rounded-full bg-muted-foreground/25" />
          <i className="h-[7px] w-[7px] rounded-full bg-muted-foreground/25" />
          <span className="ml-2 text-[10.5px] font-semibold text-muted-foreground">Trạm điều hành</span>
        </div>
        <div className="mb-1.5 grid grid-cols-3 gap-1.5">
          {[
            ["Tài sản", "128"],
            ["Đang đấu", "36"],
            ["Đã thu", "246 tỷ"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[7px] bg-muted px-2 py-[5px]">
              <small className="block text-[9.5px] text-muted-foreground">{k}</small>
              <b className="text-sm font-bold">{v}</b>
            </div>
          ))}
        </div>
        {ROW_TAGS.map((tag) => (
          <div key={tag.label} className="flex items-center gap-2 border-t border-border py-1.5">
            <div className="h-[26px] w-[26px] rounded-md bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,hsl(var(--background))_6px_12px)]" />
            <span className="flex flex-1 flex-col gap-1">
              <em className="h-[5px] rounded-sm bg-border" />
              <em className="h-[5px] w-[55%] rounded-sm bg-border" />
            </span>
            <u className={`rounded-full px-[7px] py-px text-[9.5px] font-bold no-underline ${tag.className}`}>{tag.label}</u>
          </div>
        ))}
      </div>
      <div className="absolute left-[4%] top-[calc(50%-30px)] flex -rotate-[4deg] items-center gap-1.5 whitespace-nowrap rounded-full bg-primary py-[5px] pl-[5px] pr-3 text-xs font-bold text-primary-foreground shadow-[0_8px_18px_-6px_hsl(var(--primary)/0.5)]">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-card text-[11px] text-primary">✓</span>
        Đã xác thực
      </div>
      <div className="absolute bottom-[26px] right-[8%] flex items-center gap-[7px] rounded-[10px] bg-card px-3 py-2 text-xs font-semibold shadow-[0_10px_24px_-10px_hsl(var(--foreground)/0.3)]">
        <i className="h-2 w-2 rounded-full bg-warning shadow-[0_0_0_3px_hsl(var(--warning)/0.2)]" />
        12 tin sàn tìm thấy
      </div>
    </div>
  );
}
