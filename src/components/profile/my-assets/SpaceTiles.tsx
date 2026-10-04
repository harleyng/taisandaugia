import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MyOwnerSpace } from "@/hooks/useMyOwnerSpaces";
import { spaceInitials, type KycTile } from "@/lib/ownerWorkspace/mySpaces";

const TILE =
  "flex min-h-[220px] flex-col gap-2.5 rounded-2xl bg-card p-[18px] text-left shadow-card transition-all duration-150";
const TILE_HOVER =
  "hover:-translate-y-px hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.05),0_12px_28px_-8px_hsl(var(--foreground)/0.16)]";
const GO = "border-t border-border pt-2.5 text-[13px] font-semibold";

type BadgeTone = "ok" | "wait" | "rejected" | "neutral";

const BADGE_TONE: Record<BadgeTone, string> = {
  ok: "bg-primary/10 text-primary",
  wait: "bg-warning/15 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

function TileBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-0.5 text-[11.5px] font-semibold",
        "before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:content-['']",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

function TileIcon({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-sm font-bold",
        strong ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </div>
  );
}

function TileText({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="mt-1.5">
      <b className="block text-[15px] font-semibold leading-[1.3] [text-wrap:balance]">{name}</b>
      <small className="mt-[3px] block text-[12.5px] text-muted-foreground">{subtitle}</small>
    </div>
  );
}

/** Thẻ một không gian — bấm cả thẻ để vào Trạm điều hành. */
export function SpaceTile({ space, onOpen }: { space: MyOwnerSpace; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        TILE,
        TILE_HOVER,
        space.isMine && "shadow-[var(--shadow-card),inset_0_0_0_1.5px_hsl(var(--primary)/0.3)]",
      )}
    >
      <div className="flex items-start justify-between">
        <TileIcon text={space.initials} strong={space.isMine} />
        {space.isMine && <TileBadge tone="ok">Của bạn</TileBadge>}
      </div>
      <TileText name={space.name} subtitle={space.subtitle} />
      <div className="mt-auto flex flex-col gap-1 text-[12.5px] text-muted-foreground">
        {space.pendingClaims > 0 && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold tabular-nums text-warning">
            <i className="h-[7px] w-[7px] rounded-full bg-warning" />
            {space.pendingClaims} tài sản chờ xác nhận
          </span>
        )}
      </div>
      <span className={cn(GO, "text-primary")}>Vào Trạm điều hành →</span>
    </button>
  );
}

const PENDING_STEPS = 4;

/** Hồ sơ xác thực chưa duyệt: chờ duyệt / bị từ chối / còn nháp. */
export function KycStatusTile({ tile, onOpen }: { tile: KycTile; onOpen: () => void }) {
  const initials = tile.kind === "individual" ? "CN" : spaceInitials(tile.name);
  const subtitle = tile.kind === "individual" ? "Hồ sơ cá nhân" : "Hồ sơ tổ chức";

  return (
    <div className={TILE}>
      <div className="flex items-start justify-between">
        <TileIcon text={initials} />
        {tile.status === "pending" && <TileBadge tone="wait">Chờ duyệt</TileBadge>}
        {tile.status === "rejected" && <TileBadge tone="rejected">Bị từ chối</TileBadge>}
        {tile.status === "draft" && <TileBadge tone="neutral">Chưa nộp</TileBadge>}
      </div>
      <TileText name={tile.name} subtitle={subtitle} />
      <div className="mt-auto flex flex-col gap-1 text-[12.5px] text-muted-foreground">
        {tile.status === "pending" && (
          <>
            <div className="mb-1 flex gap-[3px]" aria-hidden>
              {Array.from({ length: PENDING_STEPS }, (_, i) => (
                <i
                  key={i}
                  className={cn("h-1 flex-1 rounded-sm", i === 0 ? "bg-primary" : i === 1 ? "bg-warning" : "bg-border")}
                />
              ))}
            </div>
            <span>Kiểm tra pháp lý · 1–3 ngày làm việc</span>
          </>
        )}
        {tile.status === "rejected" && (
          <p className="rounded-lg bg-destructive/10 px-2.5 py-2 leading-[1.4] text-destructive">
            {tile.rejectionReason?.trim() || "Hồ sơ chưa đạt yêu cầu. Vui lòng kiểm tra và nộp lại."}
          </p>
        )}
        {tile.status === "draft" && <span>Hồ sơ đang lưu nháp, chưa gửi duyệt.</span>}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          GO,
          "w-full text-left",
          tile.status === "rejected" ? "text-destructive hover:text-destructive/80" : "text-primary hover:text-primary-hover",
        )}
      >
        {tile.status === "pending" && "Xem hồ sơ đã nộp →"}
        {tile.status === "rejected" && "Sửa và nộp lại →"}
        {tile.status === "draft" && "Tiếp tục hồ sơ →"}
      </button>
    </div>
  );
}

export function AddSpaceTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        TILE,
        TILE_HOVER,
        "items-center justify-center border-[1.5px] border-dashed border-border bg-muted/60 text-center shadow-none",
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-card text-[22px] text-primary shadow-card">+</span>
      <b className="text-[15px] font-semibold leading-[1.3]">Thêm không gian</b>
      <small className="-mt-1.5 text-[12.5px] text-muted-foreground">Xác thực cá nhân hoặc tổ chức</small>
    </button>
  );
}
