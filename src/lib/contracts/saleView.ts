// Hợp đồng mua bán (bên bán ↔ người trúng) → dạng hiển thị chung của trang chi tiết
// trong cổng chủ tài sản. THUẦN — luật thao tác vẫn ở lib/saleContracts/stage.

import {
  SALE_STEPS,
  canConfirmHandover,
  canConfirmSigned,
  hasConfirmedHandover,
  saleOverdueOf,
  saleStageOf,
  saleStepIndex,
} from "@/lib/saleContracts/stage";
import type {
  SaleAssetSnapshot,
  SaleBuyerParty,
  SaleContractDetail,
  SaleContractEvent,
  SaleOrgParty,
  SaleSide,
} from "@/types/auction-sale-contract";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import {
  cancelledStepIndex,
  dayMonth,
  fullDay,
  newestFirst,
  type ActivityItem,
  type NextStepView,
  type StepperView,
  type SummaryView,
  type TermsView,
} from "./detailView";

type Detail = Pick<SaleContractDetail, "contract" | "installments" | "net_paid" | "balance" | "events">;

/** Các vai người xem được thao tác ở CỔNG CHỦ TÀI SẢN (bên tổ chức thao tác ở cổng tổ chức). */
export const ownerSides = (canAct: SaleContractDetail["can_act"]): SaleSide[] =>
  (["seller", "buyer"] as SaleSide[]).filter((s) => canAct[s]);

export function saleStepper(d: Pick<Detail, "contract">): StepperView {
  const c = d.contract;
  const dates = [c.signed_at, c.paid_at, c.handed_over_at, c.completed_at];
  const steps = SALE_STEPS.map((s, i) => ({ label: s.label, date: dayMonth(dates[i]) }));
  const stage = saleStageOf(c);
  if (stage === "cancelled") {
    // Bước đang dở lúc huỷ = bước ngay sau bước cuối đã xong.
    const reached = steps.some((s) => s.date) ? cancelledStepIndex(steps) + 1 : 0;
    return { steps, current: Math.min(reached, steps.length - 1), finished: false, cancelled: true };
  }
  return { steps, current: saleStepIndex(stage), finished: stage === "completed", cancelled: false };
}

const nextDue = (installments: Detail["installments"]) =>
  installments
    .filter((i) => Number(i.paid_amount) < Number(i.amount) && i.due_at)
    .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))[0] ?? null;

export function saleNextStep(d: Detail, sides: readonly SaleSide[]): NextStepView {
  const c = d.contract;
  const stage = saleStageOf(c);
  const overdue = saleOverdueOf(c, d.installments);
  const none = { mine: false, aux: null as string | null };
  switch (stage) {
    case "cancelled":
      return { ...none, headline: "Hợp đồng đã huỷ", description: c.cancel_reason ? `Lý do: ${c.cancel_reason}` : null };
    case "completed":
      return { ...none, headline: "Hợp đồng đã hoàn tất", aux: fullDay(c.completed_at), description: null };
    case "paying": {
      const due = nextDue(d.installments);
      return {
        headline: "Chờ bên mua thanh toán",
        mine: false,
        aux: due?.due_at ? `Hạn đợt tới ${fullDay(due.due_at)}` : null,
        description: `Tổ chức đấu giá ghi nhận từng khoản thu vào hợp đồng.${overdue.payment ? " Có kỳ thanh toán đã quá hạn." : ""}`,
      };
    }
    case "handover": {
      if (sides.some((s) => canConfirmHandover(c, s))) {
        return {
          headline: "Xác nhận bàn giao tài sản",
          mine: true,
          aux: null,
          description: `Bên mua đã thanh toán đủ. Sau khi hai bên ký biên bản bàn giao, xác nhận để hoàn tất.${overdue.handover ? " Đã quá hạn bàn giao." : ""}`,
        };
      }
      const confirmedByMe = sides.some((s) => hasConfirmedHandover(c, s));
      return {
        ...none,
        headline: "Chờ bàn giao tài sản",
        aux: c.handover_scheduled_at ? `Hẹn ${fullDay(c.handover_scheduled_at)}` : null,
        description: confirmedByMe
          ? "Bạn đã xác nhận bàn giao — chờ bên còn lại xác nhận."
          : c.handover_scheduled_at
            ? "Hai bên xác nhận đã bàn giao tài sản."
            : "Tổ chức hẹn lịch bàn giao tài sản.",
      };
    }
    default:
      break;
  }
  // Giai đoạn ký.
  const late = overdue.sign ? " Đã quá hạn ký hợp đồng." : "";
  if (sides.some((s) => canConfirmSigned(c, s))) {
    return {
      headline: "Xác nhận bản đã ký",
      mine: true,
      aux: null,
      description: `Bản hợp đồng đã ký đã được tải lên. Đối chiếu với dự thảo rồi xác nhận.${late}`,
    };
  }
  if (c.status === "drafting") {
    return { ...none, headline: "Tổ chức đang soạn dự thảo", description: `Dự thảo lập từ kết quả phiên đấu giá.${late}` };
  }
  if (c.status === "awaiting_signatures") {
    return {
      headline: "Chờ các bên ký hợp đồng",
      mine: false,
      aux: "Ký bản giấy",
      description: `Các bên ký bản giấy, rồi một bên tải bản scan đã ký lên đây.${late}`,
    };
  }
  return { ...none, headline: "Chờ các bên xác nhận bản đã ký", description: late.trim() || null };
}

export function saleTerms(d: Pick<Detail, "installments">, now: Date = new Date()): TermsView {
  const t = now.toISOString();
  return {
    label: "Lịch thanh toán",
    rows: [...d.installments]
      .sort((a, b) => a.seq - b.seq)
      .map((i) => {
        const paid = Number(i.paid_amount);
        const amount = Number(i.amount);
        const note =
          paid >= amount
            ? { text: "Đã thu", tone: "ok" as const }
            : paid > 0
              ? { text: `Đã thu ${formatMoneyShort(paid)}`, tone: "warn" as const }
              : i.due_at && i.due_at < t
                ? { text: "Quá hạn", tone: "warn" as const }
                : { text: "Chưa đến hạn", tone: "muted" as const };
        return {
          key: i.id,
          title: i.label ?? `Đợt ${i.seq}`,
          sub: i.due_at ? `Hạn ${dayMonth(i.due_at)}` : null,
          value: formatMoneyFull(amount),
          note,
        };
      }),
  };
}

export function saleSummary(d: Detail): SummaryView {
  const c = d.contract;
  const price = Number(c.price);
  const paid = Number(d.net_paid);
  const pct = price > 0 ? Math.max(0, Math.min(100, Math.round((paid / price) * 100))) : 0;
  const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
  const org = (c.org_party ?? {}) as SaleOrgParty;
  const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
  const rows: SummaryView["rows"] = [
    { label: "Bên mua", value: buyer.full_name ?? "—" },
    { label: "Còn lại", value: formatMoneyShort(Math.max(0, Number(d.balance))) },
  ];
  if (asset.session_code) {
    rows.push({ label: "Phiên", value: [asset.session_code, asset.lot_no ? `Lô ${asset.lot_no}` : null].filter(Boolean).join(" · ") });
  }
  if (org.name) rows.push({ label: "Tổ chức", value: org.name.replace(/^Công ty /, "") });
  if (c.contract_no) rows.push({ label: "Số hợp đồng", value: c.contract_no });
  return {
    bigLabel: "Giá bán",
    bigValue: formatMoneyShort(price),
    progress: pct,
    progressNote: `Đã thu ${formatMoneyShort(paid)} · ${pct}%`,
    rows,
  };
}

const SIDE_WHO: Record<SaleSide, string> = { buyer: "Bên mua", seller: "Bạn", org: "Tổ chức" };

export function saleActivity(events: readonly SaleContractEvent[]): ActivityItem[] {
  return newestFirst(
    events.map((e, i) => {
      const key = `${e.action}-${i}`;
      const who = e.side ? SIDE_WHO[e.side] : "Hệ thống";
      const data = (e.data ?? {}) as Record<string, unknown>;
      const amount = typeof data.amount === "number" || typeof data.amount === "string" ? formatMoneyFull(Number(data.amount)) : null;
      const reason = typeof data.reason === "string" && data.reason ? data.reason : null;
      const text: Record<SaleContractEvent["action"], string> = {
        created: "Tổ chức lập hợp đồng từ kết quả phiên",
        terms_updated: "Tổ chức cập nhật điều khoản",
        draft_shared: "Tổ chức chia sẻ dự thảo",
        signed_uploaded: `${who} tải bản đã ký`,
        confirmed: `${who} xác nhận bản đã ký`,
        signed: "Các bên xác nhận — hợp đồng có hiệu lực",
        payment: `Ghi nhận khoản thu${amount ? ` · ${amount}` : ""}`,
        payment_reversed: `Hoàn bút toán${amount ? ` · ${amount}` : ""}`,
        handover_scheduled: "Tổ chức hẹn lịch bàn giao",
        handover_confirmed: `${who} xác nhận bàn giao`,
        handed_over: "Đã bàn giao tài sản",
        title_transfer: "Cập nhật thủ tục sang tên",
        completed: "Hợp đồng hoàn tất",
        cancelled: `${who} huỷ hợp đồng`,
      };
      return {
        key,
        at: e.at,
        text: text[e.action] ?? "Cập nhật hợp đồng",
        sub: e.action === "payment" && data.settled === true ? "Đã thu đủ" : reason,
      };
    }),
  );
}
