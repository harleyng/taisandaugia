// Ghép lựa chọn "Đối tác riêng / Dịch vụ của sàn" của các dịch vụ vào các trường SẴN CÓ của wizard.
//
// "Dịch vụ của sàn" KHÔNG có dữ liệu riêng trong form — nó là luồng sẵn có:
//   · pháp lý   ⇒ tư vấn pháp lý (asset_legal_consultations)
//   · đấu giá   ⇒ orgMode / chosenOrgs / RFQ + tư vấn đấu giá
//   · thẩm định giá ⇒ đơn thẩm định giá (asset_valuation_orders)
//   · giám định     ⇒ đơn giám định (asset_authentication_orders)
// Mọi chỗ đổi nguồn phải đi qua các patch dưới đây để hai phía không lệch.

import type { AppraisalDraft, DraftSource } from "@/lib/dossier/draft";
import type { DossierKind } from "@/lib/dossier/types";
import type { WizardValues } from "../wizardSchema";

type Patch = Partial<WizardValues>;

/** Chọn nguồn cho một dịch vụ. */
export function sourcePatch(f: WizardValues, kind: DossierKind, source: DraftSource): Patch {
  const patch: Patch = { dossier: { ...f.dossier, [kind]: { ...f.dossier[kind], source } } };
  // Đã có tổ chức riêng ⇒ không gửi yêu cầu báo giá nào khi hoàn tất.
  if (kind === "auction" && source !== "marketplace") {
    patch.orgMode = "";
    patch.chosenOrgs = [];
  }
  return patch;
}

/**
 * Đổi "Bạn có muốn đưa tài sản ra đấu giá?". Giữ hành vi cũ (xoá chosenOrgs) và:
 *  · Có ⇒ tổ chức đấu giá mặc định "Dịch vụ của sàn" (luồng chọn tổ chức hiện ngay, như trước).
 *  · Chưa ⇒ bỏ lựa chọn tổ chức đấu giá (khối này ẩn đi, không lưu ngầm).
 */
export function wantsAuctionPatch(f: WizardValues, want: "yes" | "no"): Patch {
  const au = f.dossier.auction;
  const source: DraftSource = want === "yes" ? au.source || "marketplace" : "";
  return {
    wantsAuction: want,
    chosenOrgs: [],
    ...(want === "no" ? { orgMode: "" as const } : {}),
    dossier: { ...f.dossier, auction: { ...au, source } },
  };
}

/**
 * Sửa kết quả thẩm định của đối tác. Giá thẩm định điền sẵn giá khởi điểm khi giá
 * khởi điểm còn trống — hoặc vẫn đang là giá thẩm định cũ (đang gõ dở từng chữ số).
 */
export function appraisalPatch(f: WizardValues, next: Partial<AppraisalDraft>): Patch {
  const prev = f.dossier.appraisal;
  const patch: Patch = { dossier: { ...f.dossier, appraisal: { ...prev, ...next } } };
  if (next.value !== undefined && (!f.startingPrice || f.startingPrice === prev.value)) {
    patch.startingPrice = next.value;
  }
  return patch;
}
