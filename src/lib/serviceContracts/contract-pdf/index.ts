// Kết xuất hợp đồng cung ứng dịch vụ ra PDF — nạp ĐỘNG (pdfmake + font ~2MB),
// chỉ khi người dùng bấm tải.

import { loadPdfMake } from "@/lib/pdf/pdfmakeRuntime";
import { buildServiceContractDocDefinition, type ServiceContractPdfInput } from "./document";
import type { ServiceContractDetail } from "@/types/service-contract";

export async function serviceContractPdfBlob(input: ServiceContractPdfInput): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildServiceContractDocDefinition(input)).getBlob();
}

/** Dữ liệu vào từ chi tiết hợp đồng đã giao kết (RPC service_contract_detail). */
export function serviceContractPdfInput(detail: ServiceContractDetail, now = new Date()): ServiceContractPdfInput {
  const c = detail.contract;
  return {
    kind: c.service_kind,
    code: c.code,
    templateVersion: c.template_version,
    clauses: detail.template?.clauses ?? {},
    terms: c.terms,
    owner: c.owner_party,
    provider: c.provider_party,
    acceptedAt: c.accepted_at,
    acceptedByName: detail.accepted_by_name,
    contentHash: c.content_hash,
    generatedAt: now,
  };
}
