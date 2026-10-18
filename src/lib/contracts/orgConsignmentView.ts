// Hợp đồng ký gửi theo góc nhìn TỔ CHỨC ĐẤU GIÁ → dạng hiển thị chung của trang chi
// tiết (detailView) — trang /portal/hop-dong/ky-gui/:id. Bản phía chủ tài sản ở
// consignmentView; thanh bước và bảng chi phí dùng lại của nó. THUẦN.

import { canConfirm, hasConfirmed } from "@/lib/consignment/contractState";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { ConsignmentContract, ContractEvent, MissingParty } from "@/types/consignment-contract";
import { formatMoneyShort } from "@/utils/money";
import { consignmentFee } from "./consignmentView";
import { fullDay, newestFirst, type ActivityItem, type NextStepView, type SummaryView } from "./detailView";

type Contract = Pick<
  ConsignmentContract,
  | "status"
  | "terms"
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

const OWNER = "Chủ tài sản";

/** `missing`: thông tin pháp lý còn thiếu (RPC) — chặn chia sẻ dự thảo / tải bản ký. */
export function orgConsignmentNextStep(c: Contract, missing: readonly MissingParty[]): NextStepView {
  const none = { mine: false, aux: null as string | null };
  switch (c.status) {
    case "cancelled":
      return {
        ...none,
        headline: "Hợp đồng đã huỷ",
        description: [
          `${c.cancelled_side === "org" ? "Bạn" : OWNER} huỷ ngày ${fullDay(c.cancelled_at) ?? "—"}`,
          c.cancel_reason ? `Lý do: ${c.cancel_reason}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "drafting":
      if (missing.includes("org_legal_rep")) {
        return {
          headline: "Khai người đại diện theo pháp luật",
          mine: true,
          aux: null,
          description: "Tổ chức chưa khai người đại diện nên chưa lập được dự thảo hợp đồng.",
        };
      }
      if (missing.includes("owner_address")) {
        return {
          ...none,
          headline: "Chờ chủ tài sản bổ sung địa chỉ",
          description: "Hồ sơ xác thực của chủ tài sản chưa có địa chỉ — chưa lập được dự thảo.",
        };
      }
      return {
        headline: "Soạn dự thảo hợp đồng",
        mine: true,
        aux: null,
        description: "Lập dự thảo theo phương án và chi phí đã chốt, rồi chia sẻ cho chủ tài sản.",
      };
    case "awaiting_signatures":
      return {
        headline: "Chờ hai bên ký hợp đồng",
        mine: true,
        aux: null,
        description: "Hai bên ký bản giấy, rồi tải bản scan đã ký lên để cùng xác nhận.",
      };
    case "awaiting_confirmation":
      if (canConfirm(c, "org")) {
        const who = c.signed_uploaded_side === "org" ? "Bạn" : OWNER;
        return {
          headline: "Xác nhận bản đã ký",
          mine: true,
          aux: null,
          description: `${who} đã tải bản scan. Đối chiếu với dự thảo rồi xác nhận để hợp đồng có hiệu lực.`,
        };
      }
      return {
        ...none,
        headline: "Chờ chủ tài sản xác nhận bản đã ký",
        description: hasConfirmed(c, "org") ? "Bạn đã xác nhận bản đã ký." : null,
      };
    case "signed":
      return {
        headline: "Hợp đồng có hiệu lực",
        mine: false,
        aux: c.signed_date || c.signed_at ? `Từ ${fullDay(c.signed_date ?? c.signed_at)}` : null,
        description: "Có thể đưa tài sản vào phiên đấu giá.",
      };
  }
}

export function orgConsignmentSummary(c: Contract, ownerName: string | null, startingPrice: number | null): SummaryView {
  const t = c.terms;
  const start = t.starting_price ?? startingPrice;
  const rows: SummaryView["rows"] = [
    { label: "Bên A", value: ownerName ?? "—" },
    { label: "Thù lao", value: t.commission_pct != null ? `${t.commission_pct}% giá khởi điểm` : "—" },
    { label: "Giá khởi điểm", value: start != null ? formatMoneyShort(start) : "—" },
  ];
  if (t.plan?.auction_format) rows.push({ label: "Hình thức", value: AUCTION_FORMAT_LABELS[t.plan.auction_format] });
  if (t.lead_time_days != null) rows.push({ label: "Thời gian", value: `${t.lead_time_days} ngày` });
  if (c.contract_no) rows.push({ label: "Số hợp đồng", value: c.contract_no, tone: "mono" });
  return { bigLabel: "Chi phí dịch vụ", bigValue: formatMoneyShort(consignmentFee(c)), rows };
}

export function orgConsignmentActivity(events: readonly ContractEvent[], cancelReason: string | null): ActivityItem[] {
  const who = (side: ContractEvent["side"]) => (side === "org" ? "Bạn" : OWNER);
  return newestFirst(
    events.map((e, i) => {
      const key = `${e.action}-${i}`;
      switch (e.action) {
        case "created":
          return { key, at: e.created_at, text: "Chủ tài sản chọn báo giá của bạn — hợp đồng được tạo" };
        case "draft_shared":
          return { key, at: e.created_at, text: "Bạn chia sẻ dự thảo" };
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
