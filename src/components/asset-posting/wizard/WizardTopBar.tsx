import { ArrowLeft, Loader2, Save } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";

export type DraftSaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "error" };

interface WizardTopBarProps {
  parentSlug: string;
  childSlug: string;
  save: DraftSaveState;
  onExit: () => void;
  /** "Lưu & thoát" — lưu nháp rồi quay về danh sách. Bỏ trống thì ẩn nút. */
  onSaveExit?: () => void;
  savingExit?: boolean;
}

/** Thanh trên của wizard số hoá (thiết kế v3): quay lại · tiêu đề · loại tài sản · trạng thái lưu nháp · Lưu & thoát. */
export function WizardTopBar({ parentSlug, childSlug, save, onExit, onSaveExit, savingExit }: WizardTopBarProps) {
  const parent = ASSET_CATEGORIES.find((c) => c.slug === parentSlug);
  const child = parent?.children.find((c) => c.slug === childSlug);
  const Icon = parent?.icon;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3.5 border-b border-border bg-card px-4 sm:px-6">
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-[15px] w-[15px]" /> <span className="hidden sm:inline">Tài sản của tôi</span>
      </button>
      <div className="border-l border-border pl-3.5 text-[14.5px] font-semibold text-foreground">Số hoá tài sản</div>
      {child && (
        <span className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-[3px] pl-2 text-[12.5px] text-muted-foreground sm:inline-flex">
          {Icon && <Icon className="h-[13px] w-[13px]" />} {child.name}
        </span>
      )}
      <div className="flex-1" />
      <span className="hidden items-center gap-1.5 text-[12.5px] text-muted-foreground md:flex">
        {save.kind === "saved" ? (
          <>
            <i className="h-[7px] w-[7px] rounded-full bg-success" /> Đã lưu nháp{" "}
            {save.at.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </>
        ) : save.kind === "saving" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Đang lưu nháp…
          </>
        ) : save.kind === "error" ? (
          <span className="text-destructive">Chưa lưu được nháp</span>
        ) : (
          "Chưa có thay đổi"
        )}
      </span>
      {onSaveExit && (
        <button
          type="button"
          onClick={onSaveExit}
          disabled={savingExit}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          {savingExit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu & thoát
        </button>
      )}
    </header>
  );
}
