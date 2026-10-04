import { BellRing, Bookmark, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FollowState = "idle" | "pending" | "done";

const SAVE_LABELS = { done: "Đã lưu", doneLong: "Đã lưu tài sản", doneNote: "Xem lại trong mục tài sản đã lưu của bạn trên sàn." };

/**
 * "Nhận thông báo khi mở phiên" (hồ sơ số hoá) hoặc "Lưu tài sản" (tin trên sàn — `save`) —
 * 3 trạng thái: chưa bấm / đang gửi / đã đăng ký.
 */
export function SharedFollowButton({
  state,
  onFollow,
  compact = false,
  save = false,
}: {
  state: FollowState;
  onFollow: () => void;
  compact?: boolean;
  save?: boolean;
}) {
  if (state === "done" && save) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 bg-success/10 font-semibold text-success",
          compact ? "h-[46px] rounded-[10px] px-4 text-sm" : "h-[50px] w-full justify-center rounded-xl text-[15px]",
        )}
        title={SAVE_LABELS.doneNote}
      >
        <CircleCheck className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
        {compact ? SAVE_LABELS.done : SAVE_LABELS.doneLong}
      </span>
    );
  }
  if (state === "done") {
    return compact ? (
      <span className="inline-flex h-[46px] items-center gap-2 rounded-[10px] bg-success/10 px-4 text-sm font-semibold text-success">
        <CircleCheck className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
        Đã đăng ký
      </span>
    ) : (
      <div className="flex items-start gap-2.5 rounded-xl bg-success/10 px-3.5 py-3 text-[13.5px] text-success">
        <CircleCheck className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
        <div>
          <b className="block text-[14.5px] font-semibold">Đã đăng ký nhận thông báo</b>
          Chúng tôi sẽ báo bạn ngay khi tài sản lên phiên mới.
        </div>
      </div>
    );
  }
  const pending = state === "pending";
  const Icon = pending ? Loader2 : save ? Bookmark : BellRing;
  const label = save
    ? pending
      ? "Đang lưu…"
      : compact
        ? "Lưu"
        : "Lưu tài sản"
    : compact
      ? pending
        ? "Đang đăng ký"
        : "Nhận thông báo"
      : pending
        ? "Đang đăng ký…"
        : "Nhận thông báo khi mở phiên";
  return (
    <Button
      onClick={onFollow}
      disabled={pending}
      className={cn(
        "gap-2 font-semibold",
        compact ? "h-[46px] rounded-[10px] px-4" : "h-[50px] w-full rounded-xl text-[15px]",
      )}
    >
      <Icon className={cn(compact ? "h-[15px] w-[15px]" : "h-[18px] w-[18px]", pending && "animate-spin")} strokeWidth={1.7} />
      {label}
    </Button>
  );
}
