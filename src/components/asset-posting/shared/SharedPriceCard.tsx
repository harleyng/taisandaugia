import { CalendarClock, CalendarX, ExternalLink, Hourglass, ShoppingBag, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatShareDayTime } from "@/lib/postingShare/status";
import type { SharedPosting, SharedPostingSession } from "@/lib/postingShare/types";
import {
  heroPriceParts,
  initialsOf,
  priceAreaBasis,
  registrationLeft,
  sessionSubline,
  sessionTimeline,
  type SessionCta,
} from "@/lib/postingShare/view";
import { formatMoneyFull, moneyShortParts } from "@/utils/money";
import { SharedFollowButton, type FollowState } from "./SharedFollowButton";
import { InitialsMark } from "./sharedParts";

const FOLLOW_STEPS = [
  "Nhận thông báo khi tổ chức đấu giá công bố phiên",
  "Mua hồ sơ trực tuyến, nộp tiền đặt trước",
  "Tham gia trả giá vào ngày đấu giá",
];

function Price({ posting: p, hasSender }: { posting: SharedPosting; hasSender: boolean }) {
  if (!p.startingPrice) {
    return (
      <>
        <p className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">Liên hệ</p>
        <p className="text-[13px] text-muted-foreground">
          {hasSender ? "Gọi cán bộ phụ trách để được báo giá" : "Liên hệ chủ tài sản để được báo giá"}
        </p>
      </>
    );
  }
  const price = heroPriceParts(p.startingPrice);
  const basis = priceAreaBasis(p.specs);
  const perM2 = basis ? moneyShortParts(p.startingPrice / basis.m2) : null;
  const perM2Label = perM2
    ? `≈ ${perM2.value} ${perM2.unit === "tr" ? "triệu" : perM2.unit}/m²${basis?.land ? " đất" : ""}`
    : null;
  return (
    <>
      <p className="mt-1 text-[34px] font-bold leading-[1.15] tracking-[-0.02em] tabular-nums text-foreground">
        {price.value}
        <small className="ml-1 text-[17px] font-semibold text-muted-foreground">{price.unit}</small>
      </p>
      <p className="text-[13px] tabular-nums text-muted-foreground">
        {[formatMoneyFull(p.startingPrice), perM2Label].filter(Boolean).join(" · ")}
      </p>
    </>
  );
}

function SessionBlock({ session, ended }: { session: SharedPostingSession; ended: boolean }) {
  const left = registrationLeft(session);
  const steps = sessionTimeline(session);
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border pb-4">
        {session.organizationLogoUrl ? (
          <img
            src={session.organizationLogoUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-[10px] border border-border bg-background object-contain"
          />
        ) : (
          <InitialsMark
            text={initialsOf(session.organizationName ?? "Tổ chức đấu giá")}
            className="h-11 w-11 rounded-[10px] border border-border bg-primary/10 text-[13px] text-primary"
          />
        )}
        <div className="min-w-0">
          <b className="block text-[14.5px] font-semibold text-foreground">{session.organizationName ?? "Tổ chức đấu giá"}</b>
          <span className="text-[12.5px] text-muted-foreground">{sessionSubline(session)}</span>
        </div>
      </div>

      {ended ? (
        <div className="my-4 flex items-center gap-3 rounded-xl bg-muted px-3.5 py-3 text-muted-foreground">
          <CalendarX className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <span className="text-[13px] font-medium">Phiên này đã hết hạn đăng ký.</span>
        </div>
      ) : (
        left && (
          <div className="my-4 flex items-center gap-3 rounded-xl bg-warning/10 px-3.5 py-3 text-foreground">
            <Hourglass className="h-[18px] w-[18px] shrink-0 text-warning" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <b className="text-xl font-bold leading-none tabular-nums">{left}</b>{" "}
              <span className="text-[13px] font-medium">còn lại để đăng ký</span>
            </div>
          </div>
        )
      )}

      {steps.length > 0 && (
        <ul className={cn("mb-4", (ended || !left) && "mt-4")}>
          {steps.map((s, i) => (
            <li key={s.label} className="relative grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 py-[7px] text-sm">
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn("absolute -bottom-2 left-[7px] top-[22px] w-0.5", s.state === "done" ? "bg-primary" : "bg-border")}
                />
              )}
              <i
                aria-hidden="true"
                className={cn(
                  "relative z-[1] mt-[3px] h-4 w-4 rounded-full border-2",
                  s.state === "done" && "border-primary bg-primary",
                  s.state === "now" && "border-accent bg-card ring-4 ring-accent/20",
                  s.state === "todo" && "border-border bg-card",
                )}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="text-right font-semibold tabular-nums text-foreground">{formatShareDayTime(s.at)}</span>
            </li>
          ))}
        </ul>
      )}

      {!ended && (session.dossierFee != null || session.depositAmount != null) && (
        <dl className="mb-4 grid grid-cols-2 gap-2.5">
          {session.dossierFee != null && (
            <div className="min-w-0 rounded-xl border border-border px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Giá hồ sơ</dt>
              <dd className="text-[14.5px] font-semibold tabular-nums text-foreground">{formatMoneyFull(session.dossierFee)}</dd>
            </div>
          )}
          {session.depositAmount != null && (
            <div className="min-w-0 rounded-xl border border-border px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">Tiền đặt trước</dt>
              <dd className="text-[14.5px] font-semibold tabular-nums text-foreground">
                {formatMoneyFull(session.depositAmount)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

interface SharedPriceCardProps {
  posting: SharedPosting;
  cta: SessionCta;
  follow: FollowState;
  onBuyDossier: () => void;
  onFollow: () => void;
  /** Tin trên sàn: mở trang tin đầy đủ. */
  onOpenListing?: () => void;
}

/** Tin trên sàn chưa gắn phiên: thông báo đấu giá đầy đủ nằm ở trang tin. */
function ListingBlock({ onOpenListing }: { onOpenListing?: () => void }) {
  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-primary/5 p-3.5 text-foreground">
        <Store className="h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" />
        <div>
          <b className="block text-[14.5px] font-semibold">Tài sản đang đấu giá trên sàn</b>
          <span className="text-[13px] text-foreground/75">
            Lịch phiên, tổ chức đấu giá và điều kiện tham gia có đầy đủ trên trang tin.
          </span>
        </div>
      </div>
      {onOpenListing && (
        <Button variant="outline" onClick={onOpenListing} className="mb-2.5 h-[46px] w-full gap-2 rounded-xl font-semibold">
          <ExternalLink className="h-4 w-4" strokeWidth={1.7} />
          Xem tin trên sàn
        </Button>
      )}
    </>
  );
}

/** Giá khởi điểm + phiên đấu giá (hoặc lời mời nhận thông báo khi chưa có phiên) + nút chính. */
export function SharedPriceCard({ posting: p, cta, follow, onBuyDossier, onFollow, onOpenListing }: SharedPriceCardProps) {
  const listing = p.kind === "listing";
  return (
    <section className="rounded-2xl bg-card p-[18px] shadow-card sm:p-[22px]">
      <p className="text-[13px] text-muted-foreground">
        Giá khởi điểm{cta !== "follow" ? " (theo thông báo đấu giá)" : ""}
      </p>
      <Price posting={p} hasSender={!!p.sender?.phone} />
      <div className="my-5 h-px bg-border" />

      {listing && (cta === "follow" || !p.session) ? (
        <ListingBlock onOpenListing={onOpenListing} />
      ) : cta === "follow" || !p.session ? (
        <>
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-warning/10 p-3.5 text-foreground">
            <CalendarClock className="h-[18px] w-[18px] shrink-0 text-warning" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <b className="block text-[14.5px] font-semibold">Sắp lên phiên đấu giá</b>
              <span className="text-[13px] text-foreground/75">
                Tài sản chưa có lịch phiên. Đăng ký để được báo ngay khi mở bán hồ sơ.
              </span>
            </div>
          </div>
          <ol className="mb-[18px] flex flex-col gap-2.5 text-sm">
            {FOLLOW_STEPS.map((s, i) => (
              <li key={s} className="flex items-start gap-2.5">
                <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <SessionBlock session={p.session} ended={cta === "ended"} />
      )}

      {cta === "dossier" ? (
        <Button onClick={onBuyDossier} className="h-[50px] w-full gap-2 rounded-xl text-[15px] font-semibold">
          <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.6} />
          Mua hồ sơ trực tuyến
        </Button>
      ) : (
        <SharedFollowButton state={follow} onFollow={onFollow} save={listing} />
      )}
    </section>
  );
}
