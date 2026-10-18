import { useNavigate, useParams } from "react-router-dom";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown } from "@/components/auction-sessions/detail/ui";
import { BuyerPageShell, PageTitle, TwoColumn } from "@/components/buyer-contracts/BuyerPageShell";
import { OrgContactCard } from "@/components/buyer-contracts/OrgContactCard";
import { DepositMethodCard } from "@/components/buyer-contracts/deposit/DepositMethodCard";
import { DepositReportCard } from "@/components/buyer-contracts/deposit/DepositReportCard";
import { CheckList, Crumbs, TagPill } from "@/components/buyer-contracts/ui";
import { useContractDepositInfo, useMyContractByCode } from "@/hooks/useBuyerContracts";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BUYER_DEPOSIT_TAGS, buyerDepositStateOf } from "@/lib/biddingContracts/buyerContract";
import { countdownParts } from "@/lib/biddingContracts/buyerHistory";
import { MY_CONTRACTS_PATH, myContractPath, sessionRegistrationPath } from "@/lib/biddingContracts/paths";

/** /ho-so-cua-toi/:code/dat-truoc — hướng dẫn nộp tiền đặt trước của một hồ sơ. */
export default function ContractDepositPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { data: c, isLoading } = useMyContractByCode(code);
  const { data: info, isLoading: infoLoading } = useContractDepositInfo(c?.status === "paid" ? c.id : null);

  if (isLoading || (c?.status === "paid" && infoLoading)) {
    return (
      <BuyerPageShell>
        <Skeleton className="mb-6 h-12 w-80" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[520px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </BuyerPageShell>
    );
  }

  if (!c || c.status !== "paid" || !info) {
    return (
      <BuyerPageShell>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center">
          <Landmark className="h-10 w-10 text-muted-foreground" />
          <p className="text-foreground">
            {c?.status === "pending_payment"
              ? "Thanh toán phí hồ sơ trước, rồi mới nộp tiền đặt trước."
              : "Hồ sơ này không cần nộp tiền đặt trước."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate(c ? myContractPath(c.code) : MY_CONTRACTS_PATH)}>
              Về hồ sơ
            </Button>
            {c?.status === "pending_payment" && c.auction_sessions && (
              <Button onClick={() => navigate(sessionRegistrationPath(c.auction_sessions!.id))}>Tiếp tục thanh toán</Button>
            )}
          </div>
        </div>
      </BuyerPageShell>
    );
  }

  const s = c.auction_sessions;
  const state = buyerDepositStateOf(c);
  const showDeadline = (state === "pending" || state === "sent") && info.deadline && Date.parse(info.deadline) > Date.now();

  return (
    <BuyerPageShell>
      <Crumbs
        items={[
          { label: "Hồ sơ đấu giá", to: MY_CONTRACTS_PATH },
          { label: c.code, to: myContractPath(c.code) },
          { label: "Nộp tiền đặt trước" },
        ]}
      />
      <PageTitle
        title="Nộp tiền đặt trước"
        sub={
          <>
            Hồ sơ <span className="font-mono">{c.code}</span>
            {s ? ` · ${s.title}` : ""}
          </>
        }
      />
      <TwoColumn
        main={
          <>
            <section className="rounded-2xl bg-card p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Số tiền cần nộp</span>
                    <TagPill tag={BUYER_DEPOSIT_TAGS[state]} />
                  </div>
                  <div className="mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
                    {formatVnd(info.deposit_due)}
                  </div>
                </div>
                {showDeadline && (
                  <div className="min-w-[220px]">
                    <Countdown caption={`Hạn nộp ${formatDateTime(info.deadline)}`} parts={countdownParts(info.deadline!)} />
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-[13px]">
                {info.lots.map((l) => (
                  <div key={l.item_id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Tài sản {l.lot_no} · {l.title}
                    </span>
                    <span className="shrink-0 text-foreground">{formatVnd(l.deposit_amount ?? 0)}</span>
                  </div>
                ))}
              </div>
            </section>
            <DepositMethodCard contract={c} info={info} />
            <section className="flex flex-col gap-3 rounded-2xl bg-card p-6">
              <h2 className="text-lg font-bold text-foreground">Hoàn trả và mất tiền đặt trước</h2>
              <CheckList
                items={[
                  { children: <><b>Không trúng:</b> tổ chức hoàn trả sau khi phiên kết thúc, về đúng tài khoản đã chuyển.</> },
                  { children: <><b>Trúng:</b> tiền đặt trước được trừ vào tiền mua tài sản.</> },
                  {
                    ok: false,
                    children: (
                      <>
                        <b>Mất tiền đặt trước</b> nếu không điểm danh, bỏ phiên, rút lại giá đã trả hoặc trúng nhưng từ
                        chối ký biên bản / hợp đồng.
                      </>
                    ),
                  },
                ]}
              />
            </section>
          </>
        }
        aside={
          <>
            <DepositReportCard contract={c} due={info.deposit_due} />
            {s && (
              <OrgContactCard name={info.org.name} phone={info.org.phone} address={info.org.address} logoUrl={info.org.logo_url} sessionId={s.id} />
            )}
          </>
        }
      />
    </BuyerPageShell>
  );
}
