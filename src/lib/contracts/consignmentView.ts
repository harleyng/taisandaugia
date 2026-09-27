// Hợp đồng ký gửi (chủ tài sản ↔ tổ chức đấu giá) → dạng hiển thị chung của trang chi
// tiết (detailView). THUẦN — luật thao tác vẫn ở lib/consignment/contractState.

import { canConfirm, hasConfirmed } from "@/lib/consignment/contractState";
import { feeTotalRequired } from "@/lib/quotePlan";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { ConsignmentContract, ContractEvent } from "@/types/consignment-contract";
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

type Contract = Pick<
  ConsignmentContract,
  | "status"
  | "terms"
  | "created_at"
  | "draft_uploaded_at"
  | "signed_uploaded_at"
  | "signed_uploaded_side"
  | "signed_doc_path"
  | "owner_confirmed_at"
  | "org_confirmed_at"
  | "signed_at"
  | "signed_date"
  | "cancelled_at"
  | "cancelled_side"
  | "cancel_reason"
  | "contract_no"
>;

const STEP_LABELS = ["Soạn dự thảo", "Hai bên ký", "Xác nhận bản ký", "Có hiệu lực"] as const;
const STEP_OF_STATUS: Record<Exclude<ConsignmentContract["status"], "cancelled">, number> = {
  drafting: 0,
  awaiting_signatures: 1,
  awaiting_confirmation: 2,
  signed: 3,
};

export function consignmentStepper(c: Contract): StepperView {
  const dates = [c.created_at, c.draft_uploaded_at, c.signed_uploaded_at, c.signed_at];
  const steps = STEP_LABELS.map((label, i) => ({ label, date: dayMonth(dates[i]) }));
  if (c.status === "cancelled") {
    return { steps, current: cancelledStepIndex(steps), finished: false, cancelled: true };
  }
  return { steps, current: STEP_OF_STATUS[c.status], finished: c.status === "signed", cancelled: false };
}

/** `missingAddress`: hồ sơ xác thực chưa có địa chỉ Bên A (tổ chức chưa lập được dự thảo). */
export function consignmentNextStep(c: Contract, orgName: string, missingAddress: boolean): NextStepView {
  const none = { mine: false, aux: null as string | null };
  switch (c.status) {
    case "cancelled":
      return {
        ...none,
        headline: "Hợp đồng đã huỷ",
        description: [
          `${c.cancelled_side === "org" ? orgName : "Bạn"} huỷ ngày ${fullDay(c.cancelled_at) ?? "—"}`,
          c.cancel_reason ? `Lý do: ${c.cancel_reason}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "drafting":
      return missingAddress
        ? {
            headline: "Bổ sung địa chỉ Bên A",
            mine: true,
            aux: null,
            description: `Hồ sơ xác thực chưa có địa chỉ trụ sở nên ${orgName} chưa lập được dự thảo.`,
          }
        : { ...none, headline: `${orgName} đang soạn dự thảo`, description: "Dự thảo lập theo báo giá bạn đã chốt." };
    case "awaiting_signatures":
      return {
        headline: "Chờ hai bên ký hợp đồng",
        mine: false,
        aux: "Ký bản giấy",
        description: "Hai bên ký bản giấy, rồi một bên tải bản scan đã ký lên đây.",
      };
    case "awaiting_confirmation":
      if (canConfirm(c, "owner")) {
        const who = c.signed_uploaded_side === "owner" ? "Bạn" : orgName;
        return {
          headline: "Xác nhận bản đã ký",
          mine: true,
          aux: null,
          description: `${who} đã tải bản scan. Đối chiếu với dự thảo rồi xác nhận để hợp đồng có hiệu lực.`,
        };
      }
      return {
        ...none,
        headline: `Chờ ${orgName} xác nhận bản đã ký`,
        description: hasConfirmed(c, "owner") ? "Bạn đã xác nhận bản đã ký." : null,
      };
    case "signed":
      return {
        headline: "Hợp đồng có hiệu lực",
        mine: false,
        aux: c.signed_date || c.signed_at ? `Từ ${fullDay(c.signed_date ?? c.signed_at)}` : null,
        description: `${orgName} có thể đưa tài sản vào phiên đấu giá.`,
      };
  }
}

/** Tổng chi phí dịch vụ = các khoản bắt buộc (khoản tuỳ chọn không tính). */
export function consignmentFee(c: Pick<Contract, "terms">): number | null {
  const items = c.terms.fee_items ?? [];
  return c.terms.service_fee ?? (items.length ? feeTotalRequired(items) : null);
}

export function consignmentTerms(c: Pick<Contract, "terms">): TermsView {
  const items = c.terms.fee_items ?? [];
  const fee = consignmentFee(c);
  const rows = items.length
    ? items.map((i, idx) => ({
        key: `f${idx}`,
        title: i.label,
        sub: i.optional ? "Tuỳ chọn · không tính vào tổng" : null,
        value: formatMoneyFull(i.amount),
        dim: i.optional,
      }))
    : c.terms.commission_pct != null
      ? [{ key: "pct", title: `Thù lao đấu giá (${c.terms.commission_pct}% giá khởi điểm)` }]
      : [];
  return {
    label: "Chi phí theo báo giá đã chốt",
    rows: [...rows, { key: "total", title: "Tổng chi phí dịch vụ", value: formatMoneyFull(fee), total: true }],
  };
}

export function consignmentSummary(
  c: Contract,
  orgName: string,
  startingPrice: number | null,
  missingAddress: boolean,
): SummaryView {
  const t = c.terms;
  const start = t.starting_price ?? startingPrice;
  const rows: SummaryView["rows"] = [
    { label: "Bên B", value: orgName },
    { label: "Thù lao", value: t.commission_pct != null ? `${t.commission_pct}% giá khởi điểm` : "—" },
    { label: "Giá khởi điểm", value: start != null ? formatMoneyShort(start) : "—" },
  ];
  if (t.plan?.auction_format) rows.push({ label: "Hình thức", value: AUCTION_FORMAT_LABELS[t.plan.auction_format] });
  if (t.lead_time_days != null) rows.push({ label: "Thời gian", value: `${t.lead_time_days} ngày` });
  if (c.status !== "cancelled" && c.status !== "signed") {
    rows.push(missingAddress ? { label: "Địa chỉ Bên A", value: "Chưa có", tone: "warn" } : { label: "Địa chỉ Bên A", value: "Đã có" });
  }
  if (c.contract_no) rows.push({ label: "Số hợp đồng", value: c.contract_no });
  return { bigLabel: "Chi phí dịch vụ", bigValue: formatMoneyShort(consignmentFee(c)), rows };
}

export function consignmentActivity(events: readonly ContractEvent[], orgName: string, cancelReason: string | null): ActivityItem[] {
  const who = (side: ContractEvent["side"]) => (side === "org" ? orgName : "Bạn");
  return newestFirst(
    events.map((e, i) => {
      const key = `${e.action}-${i}`;
      switch (e.action) {
        case "created":
          return { key, at: e.created_at, text: "Bạn chốt báo giá — hợp đồng được tạo" };
        case "draft_shared":
          return { key, at: e.created_at, text: `${orgName} chia sẻ dự thảo` };
        case "signed_uploaded":
          return { key, at: e.created_at, text: `${who(e.side)} tải bản đã ký` };
        case "confirmed":
          return { key, at: e.created_at, text: `${who(e.side)} xác nhận bản đã ký` };
        case "signed":
          return { key, at: e.created_at, text: "Hai bên xác nhận — hợp đồng có hiệu lực" };
        case "cancelled":
          return { key, at: e.created_at, text: `${who(e.side)} huỷ hợp đồng`, sub: cancelReason };
        default:
          return { key, at: e.created_at, text: "Cập nhật hợp đồng" };
      }
    }),
  );
}
