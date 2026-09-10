// Định dạng số tiền cho wizard số hoá — nhóm 3 chữ số bằng dấu phẩy (quy ước tiền của dự án).

import type { DeltaFieldDescriptor } from "@/constants/asset-delta-fields";

export const groupNumber = (s: string | number): string => {
  const digits = String(s).replace(/[^\d]/g, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
};

export const parseNumber = (s: string): string => s.replace(/[^\d]/g, "");

/** Hiển thị một delta field theo descriptor. Dùng chung cho màn chủ tài sản và màn duyệt của admin. */
export function renderDeltaValue(d: DeltaFieldDescriptor, raw: unknown): string {
  if (raw === null || raw === undefined || String(raw).trim() === "") return "—";
  if (d.type === "select") return d.options?.find((o) => o.value === raw)?.label ?? String(raw);
  if (d.type === "boolean") return raw ? "Có" : "Không";
  const base = d.type === "number" ? Number(raw).toLocaleString("vi-VN") : String(raw);
  return d.unit ? `${base} ${d.unit}` : base;
}

export function vnWords(s: string | number): string {
  const n = Number(String(s).replace(/[^\d]/g, ""));
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ đồng`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đồng`;
  return `${n.toLocaleString("vi-VN")} đồng`;
}
