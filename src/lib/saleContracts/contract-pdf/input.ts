// Dữ liệu vào của dự thảo hợp đồng mua bán — dựng CHỈ từ bản chiếu của hợp
// đồng (RPC sale_contract_detail), không đọc bảng sống: giá và các bên đã được
// đóng băng lúc lập hợp đồng.

import type {
  SaleAssetSnapshot,
  SaleBuyerParty,
  SaleContract,
  SaleContractDetail,
  SaleInstallment,
  SaleOrgParty,
  SaleSellerParty,
} from "@/types/auction-sale-contract";

export interface SalePdfInstallment {
  seq: number;
  label: string | null;
  dueAt: string | null;
  amount: number;
}

export interface SalePdfInput {
  code: string | null;
  contractNo: string | null;
  buyer: SaleBuyerParty;
  seller: SaleSellerParty;
  org: SaleOrgParty;
  asset: SaleAssetSnapshot;
  price: number;
  depositCredit: number;
  /** price − depositCredit — tính MỘT chỗ, không lặp công thức trong renderer. */
  payable: number;
  installments: SalePdfInstallment[];
  payeeSide: SaleContract["payee_side"];
  payeeBankInfo: string | null;
  orgSigns: boolean;
  notarizationRequired: boolean;
  handoverDueAt: string | null;
  sellerIsRegistry: boolean;
  /** Nhãn loại tài sản tra sẵn — không kéo ASSET_CATEGORIES (lucide) vào renderer. */
  categoryLabel: string | null;
  generatedAt: Date;
}

const toInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export function buildSalePdfInput(
  detail: Pick<SaleContractDetail, "contract" | "installments">,
  opts: { categoryLabel?: string | null; now?: Date } = {},
): SalePdfInput {
  const c = detail.contract;
  if (c.status === "cancelled") {
    throw new Error("Hợp đồng đã huỷ — không tạo được dự thảo.");
  }
  const price = toInt(c.price);
  const depositCredit = toInt(c.deposit_credit);
  return {
    code: c.code,
    contractNo: c.contract_no,
    buyer: (c.buyer_party ?? {}) as SaleBuyerParty,
    seller: (c.seller_party ?? {}) as SaleSellerParty,
    org: (c.org_party ?? {}) as SaleOrgParty,
    asset: (c.asset_snapshot ?? {}) as SaleAssetSnapshot,
    price,
    depositCredit,
    payable: price - depositCredit,
    installments: [...(detail.installments ?? [])]
      .sort((a, b) => a.seq - b.seq)
      .map((i: SaleInstallment) => ({
        seq: i.seq,
        label: i.label,
        dueAt: i.due_at,
        amount: toInt(i.amount),
      })),
    payeeSide: c.payee_side,
    payeeBankInfo: c.payee_bank_info,
    orgSigns: c.org_signs,
    notarizationRequired: c.notarization_required,
    handoverDueAt: c.handover_due_at,
    sellerIsRegistry: c.seller_kind === "org_on_behalf",
    categoryLabel: opts.categoryLabel ?? null,
    generatedAt: opts.now ?? new Date(),
  };
}

export function saleDraftFileName(input: Pick<SalePdfInput, "code">): string {
  return `Du-thao-HDMB_${input.code ?? "hop-dong"}.pdf`;
}
