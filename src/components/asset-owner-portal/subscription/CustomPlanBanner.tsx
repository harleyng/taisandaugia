import { useNavigate } from "react-router-dom";

/** Thanh "Cần hạn mức riêng?" cuối danh mục (.cust trong design) — gói riêng do sàn cấu hình. */
export function CustomPlanBanner() {
  const navigate = useNavigate();
  return (
    <div className="sub-cust relative mt-2 grid items-center gap-5 overflow-hidden rounded-[18px] px-[30px] py-[26px] sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="sub-art" aria-hidden />
      <div className="relative z-[1]">
        <b className="text-[19px] font-bold">Cần hạn mức riêng?</b>
        <p className="mt-1 max-w-[560px] text-sm text-[hsl(var(--tier-slate-muted))]">
          Tổ chức nhiều chi nhánh hoặc khối lượng tài sản lớn — sàn cấu hình gói theo nhu cầu.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/lien-he")}
        className="relative z-[1] inline-flex h-11 items-center justify-center justify-self-start whitespace-nowrap rounded-full bg-white px-[22px] text-[13.5px] font-semibold text-foreground transition-colors hover:bg-white/90 sm:justify-self-auto"
      >
        Liên hệ sàn
      </button>
    </div>
  );
}
