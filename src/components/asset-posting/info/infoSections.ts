import { getDeltaFields } from "@/constants/asset-delta-fields";
import { filled, type Requirement, type WizardValues } from "../wizardSchema";

/**
 * Mục con của bước 2 "Thông tin tài sản" (thiết kế So Hoa Tai San v3) — nguồn cho
 * rail trái, nhãn "Đã xong" và việc cuộn tới mục còn thiếu khi bấm "Tiếp tục".
 *
 * Điều kiện bắt buộc KHÔNG khai lại ở đây: mỗi mục chỉ gom các dòng requirements()
 * (wizardSchema.ts — cổng duy nhất) có key thuộc về nó.
 */
export type InfoSectionId = "anh" | "nhandien" | "vitri" | "thongso" | "mota";

export interface InfoSection {
  id: InfoSectionId;
  label: string;
  /** Các điều kiện bắt buộc thuộc mục (lọc từ requirements()). */
  req: Requirement[];
  /** Độ đầy đủ 0..1 — mục không có trường bắt buộc tính "xong" khi score > 0. */
  score: number;
}

/** Key requirement (bước 2) → mục chứa ô nhập tương ứng. */
export function sectionOfKey(key: string): InfoSectionId | undefined {
  if (key === "imageUrls") return "anh";
  if (key === "title" || key === "branchId") return "nhandien";
  if (key === "province") return "vitri";
  if (key.startsWith("delta.")) return "thongso";
  return undefined;
}

export function infoSections(f: WizardValues, reqs: Requirement[]): InfoSection[] {
  const step2 = reqs.filter((r) => r.step === 2);
  const of = (id: InfoSectionId) => step2.filter((r) => sectionOfKey(r.key) === id);
  const deltas = getDeltaFields(f.childSlug);
  const sections: InfoSection[] = [
    { id: "anh", label: "Ảnh & video", req: of("anh"), score: Math.min(f.imageUrls.length, 4) / 4 },
    { id: "nhandien", label: "Tên tài sản", req: of("nhandien"), score: f.title.trim().length >= 3 ? 1 : 0 },
    {
      id: "vitri",
      label: "Vị trí",
      req: of("vitri"),
      score: [f.province, f.district, f.ward, f.address].filter(Boolean).length / 4,
    },
    {
      id: "thongso",
      label: "Thông số",
      req: of("thongso"),
      score: deltas.length ? deltas.filter((d) => filled(f.deltaFields[d.key])).length / deltas.length : 1,
    },
    { id: "mota", label: "Mô tả", req: [], score: Math.min((f.description ?? "").trim().length / 120, 1) },
  ];
  // Loại tài sản không có thông số riêng ⇒ ẩn hẳn mục "Thông số".
  return deltas.length ? sections : sections.filter((s) => s.id !== "thongso");
}

/** Trạng thái chấm của mục trên rail: xanh khi đủ, rỗng khi còn thiếu / chưa nhập gì. */
export function sectionState(s: InfoSection): "ok" | "miss" | "" {
  if (s.req.length) return s.req.every((r) => r.ok) ? "ok" : "miss";
  return s.score > 0 ? "ok" : "";
}

/** Cuộn tới một mục của bước 2 và nháy viền để mắt bắt được. */
export function jumpToSection(id: string) {
  const el = document.getElementById(`sec-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("ring-[3px]", "ring-primary/20");
  window.setTimeout(() => el.classList.remove("ring-[3px]", "ring-primary/20"), 1200);
}
