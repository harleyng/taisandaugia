// Bản PDF xem thử một phiên bản mẫu với DỮ LIỆU GIẢ (trang admin Mẫu hợp đồng).
// Dựng bằng đúng builder của hợp đồng thật để admin thấy câu chữ nằm ở đâu.
// Nạp ĐỘNG pdfmake (~2MB) — chỉ khi bấm "Xem PDF mẫu".

import type { ContractTemplateType } from "./schema";
import type { ServiceKindKey } from "@/lib/serviceRequests/kinds";

const NOW = () => new Date();

export async function templateSamplePdfBlob(
  type: ContractTemplateType,
  version: string,
  clauses: unknown,
): Promise<Blob> {
  const template = { version, clauses };

  if (type === "consignment") {
    const { contractPdfBlob } = await import("@/lib/consignment/contract-pdf");
    return contractPdfBlob({
      code: "HDKG-MAU",
      contractNo: null,
      owner: { kind: "individual", full_name: "Nguyễn Văn A", id_type: "cccd", id_number: "0000000000", address: "Địa chỉ mẫu", province: "TP. Hồ Chí Minh" },
      org: {
        name: "Công ty Đấu giá mẫu", tax_code: "0000000000", address: "Địa chỉ mẫu", ward: null, district: null,
        province: "Hà Nội", phone: null, email: null, legal_rep_name: "Trần Văn B", legal_rep_position: "Giám đốc",
      },
      asset: {
        title: "Tài sản mẫu", parent_slug: "bat-dong-san", child_slug: "nha-pho", address: null, ward: null, district: null,
        province: "TP. Hồ Chí Minh", starting_price: 1_000_000_000, pricing_mode: "self", auction_format: "truc_tiep",
        has_dispute: false, has_mortgage: false, is_seized: false, right_to_sell: true, legal_notes: null,
      },
      terms: {
        commission_pct: 1, service_fee: 5_000_000, starting_price: null, lead_time_days: 30, plan: null,
        fee_items: null, note: null, quote_doc_path: null, quoted_at: null,
      },
      categoryLabel: "Nhà phố",
      generatedAt: NOW(),
      template,
    });
  }

  if (type === "sale") {
    const { salePdfBlob } = await import("@/lib/saleContracts/contract-pdf");
    return salePdfBlob({
      code: "HDMB-MAU",
      contractNo: null,
      buyer: {
        full_name: "Nguyễn Văn Mua", id_type: "cccd", id_number: "0000000000", date_of_birth: null, phone: null,
        email: null, address: "Địa chỉ mẫu", bidder_no: 1, dossier_code: "HSDG-MAU",
      },
      seller: { kind: "individual", full_name: "Lê Thị Bán", id_type: "cccd", id_number: "0000000000", address: "Địa chỉ mẫu" },
      org: { name: "Công ty Đấu giá mẫu", tax_code: "0000000000", address: "Địa chỉ mẫu", legal_rep_name: "Trần Văn B", legal_rep_position: "Giám đốc" },
      asset: { lot_no: 1, title: "Tài sản mẫu", province: "TP. Hồ Chí Minh", starting_price: 1_000_000_000, session_code: "PDG-MAU" },
      price: 1_200_000_000,
      depositCredit: 100_000_000,
      payable: 1_100_000_000,
      installments: [{ seq: 1, label: "Đợt 1", dueAt: NOW().toISOString(), amount: 1_100_000_000 }],
      payeeSide: "org",
      payeeBankInfo: null,
      orgSigns: false,
      notarizationRequired: true,
      handoverDueAt: null,
      sellerIsRegistry: false,
      categoryLabel: "Nhà phố",
      generatedAt: NOW(),
      template,
    } as Parameters<typeof salePdfBlob>[0]);
  }

  const kind = type.slice("service:".length) as ServiceKindKey;
  const [{ serviceContractPdfBlob }, { SERVICE_CONTRACT_LABELS, providerPartyFromClauses }] = await Promise.all([
    import("@/lib/serviceContracts/contract-pdf"),
    import("@/lib/serviceContracts"),
  ]);
  const rec = (clauses ?? {}) as Record<string, unknown>;
  return serviceContractPdfBlob({
    kind,
    code: "HDCU-MAU",
    templateVersion: version,
    clauses: rec,
    terms: {
      service_label: SERVICE_CONTRACT_LABELS[kind],
      order_code: "MAU000001",
      package_name: "Gói mẫu",
      posting_title: "Tài sản mẫu",
      price: 2_000_000,
      quote_note: null,
      quoted_at: NOW().toISOString(),
      quote_expires_at: null,
      extra: null,
    },
    owner: { kind: "individual", full_name: "Nguyễn Văn A", address: "Địa chỉ mẫu", signatory: { user_id: "", name: "Nguyễn Văn A", email: "a@example.com" } },
    provider: providerPartyFromClauses(rec, "Đơn vị thực hiện mẫu", null),
    acceptedAt: NOW().toISOString(),
    acceptedByName: "Nguyễn Văn A",
    contentHash: "0".repeat(64),
    generatedAt: NOW(),
  });
}

export const templateSampleFileName = (version: string) => `Mau-hop-dong_${version}.pdf`;
