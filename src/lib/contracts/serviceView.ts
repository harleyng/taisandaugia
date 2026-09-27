// Hợp đồng cung ứng dịch vụ (chủ tài sản ↔ sàn) → dạng hiển thị chung của trang chi
// tiết. Không có bảng nhật ký — hoạt động dựng từ các mốc của đơn. THUẦN.

import { SERVICE_CONTRACT_LABELS, serviceContractStageOf, type ServiceContractStage } from "@/lib/serviceContracts";
import type { ServiceContractDetail } from "@/types/service-contract";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import {
  dayMonth,
  fullDay,
  newestFirst,
  type ActivityItem,
  type NextStepView,
  type StepperView,
  type SummaryView,
  type TermsView,
} from "./detailView";

type Detail = Pick<ServiceContractDetail, "contract" | "order" | "is_current" | "accepted_by_name">;

export const serviceStageOfDetail = (d: Pick<Detail, "order" | "is_current">): ServiceContractStage =>
  serviceContractStageOf(d.order?.status, true, d.is_current);

const STEP_LABELS = ["Đồng ý báo giá", "Thanh toán", "Thực hiện", "Hoàn tất"] as const;
const STEP_OF_STAGE: Partial<Record<ServiceContractStage, number>> = {
  awaiting_acceptance: 0,
  awaiting_payment: 1,
  in_progress: 2,
  completed: 3,
};

export function serviceStepper(d: Detail): StepperView {
  const o = d.order;
  const dates = [d.contract.accepted_at, o?.paid_at, o?.done_at, o?.done_at];
  const steps = STEP_LABELS.map((label, i) => ({ label, date: dayMonth(dates[i]) }));
  const stage = serviceStageOfDetail(d);
  if (stage === "cancelled" || stage === "requoted") {
    const current = o?.paid_at ? 2 : 1;
    return { steps, current, finished: false, cancelled: true };
  }
  return { steps, current: STEP_OF_STAGE[stage] ?? 2, finished: stage === "completed", cancelled: false };
}

export function serviceNextStep(d: Detail): NextStepView {
  const c = d.contract;
  const partner = c.provider_party.partner_name ?? c.provider_party.name ?? "Đơn vị thực hiện";
  const none = { mine: false, aux: null as string | null };
  switch (serviceStageOfDetail(d)) {
    case "awaiting_payment":
      return {
        headline: "Thanh toán phí dịch vụ",
        mine: true,
        aux: null,
        description: "Hợp đồng đã giao kết. Thanh toán để bắt đầu thực hiện dịch vụ.",
      };
    case "in_progress":
      return {
        ...none,
        headline: "Đang thực hiện dịch vụ",
        description: `${partner} đang thực hiện. Kết quả gắn vào hồ sơ tài sản khi hoàn tất.`,
      };
    case "completed":
      return { ...none, headline: "Dịch vụ đã hoàn tất", aux: fullDay(d.order?.done_at), description: null };
    case "requoted":
      return {
        ...none,
        headline: "Sàn đã báo giá lại",
        description: "Hợp đồng này không còn áp dụng — báo giá mới cần được đồng ý lại ở đơn dịch vụ.",
      };
    case "cancelled":
      return { ...none, headline: "Đơn dịch vụ đã huỷ", aux: fullDay(d.order?.cancelled_at), description: null };
    default:
      return { ...none, headline: "Chờ đồng ý báo giá", description: null };
  }
}

export function serviceTerms(d: Detail): TermsView {
  const t = d.contract.terms;
  const rows: TermsView["rows"] = [
    { key: "svc", title: t.package_name ? `${t.service_label} · ${t.package_name}` : t.service_label, sub: t.quote_note },
    { key: "total", title: "Phí dịch vụ", value: formatMoneyFull(d.contract.price), total: true },
  ];
  return { label: "Phạm vi dịch vụ", rows };
}

export function serviceSummary(d: Detail): SummaryView {
  const c = d.contract;
  const rows: SummaryView["rows"] = [
    { label: "Dịch vụ", value: SERVICE_CONTRACT_LABELS[c.service_kind] },
    { label: "Bên cung ứng", value: c.provider_party.name ?? "—" },
  ];
  if (c.provider_party.partner_name) rows.push({ label: "Đơn vị thực hiện", value: c.provider_party.partner_name });
  rows.push({ label: "Đơn", value: c.order_code, tone: "mono" });
  if (d.accepted_by_name) rows.push({ label: "Người đồng ý", value: d.accepted_by_name });
  rows.push({ label: "Mẫu hợp đồng", value: c.template_version });
  return { bigLabel: "Phí dịch vụ", bigValue: formatMoneyShort(c.price), rows };
}

export function serviceActivity(d: Detail): ActivityItem[] {
  const c = d.contract;
  const o = d.order;
  const items: ActivityItem[] = [
    { key: "quoted", at: c.quoted_at, text: `Sàn gửi báo giá ${c.terms.service_label.toLowerCase()}` },
    { key: "accepted", at: c.accepted_at, text: `${d.accepted_by_name ?? "Bạn"} đồng ý hợp đồng` },
  ];
  if (o?.paid_at) items.push({ key: "paid", at: o.paid_at, text: `Thanh toán ${formatMoneyFull(c.price)}` });
  if (o?.done_at) items.push({ key: "done", at: o.done_at, text: "Hoàn tất dịch vụ" });
  if (o?.cancelled_at) items.push({ key: "cancelled", at: o.cancelled_at, text: "Đơn dịch vụ đã huỷ" });
  if (!d.is_current) items.push({ key: "requoted", at: o?.quoted_at ?? c.accepted_at, text: "Sàn báo giá lại — hợp đồng này hết áp dụng" });
  return newestFirst(items);
}
