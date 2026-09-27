// Đường dẫn menu "Hợp đồng" (cổng chủ tài sản) và "Pháp lý & Đấu giá" (admin).

export { ownerSaleContractPath } from "@/lib/saleContracts/files";

export const OWNER_CONTRACTS_PATH = "/chu-tai-san/hop-dong";

/** Loại hợp đồng = tab ?loai= của trang danh sách; cũng là đoạn URL chi tiết. */
export type ContractTypeKey = "ky-gui" | "mua-ban" | "dich-vu";
export type ContractTab = "tat-ca" | "can-xu-ly" | ContractTypeKey;

export const ownerContractsPath = (loai?: ContractTab) =>
  loai && loai !== "tat-ca" ? `${OWNER_CONTRACTS_PATH}?loai=${loai}` : OWNER_CONTRACTS_PATH;

/** Hợp đồng ký gửi — theo id HỢP ĐỒNG (một hồ sơ có thể có hợp đồng đã huỷ). */
export const ownerConsignmentContractPath = (contractId: string) => `${OWNER_CONTRACTS_PATH}/ky-gui/${contractId}`;
export const ownerServiceContractPath = (contractId: string) => `${OWNER_CONTRACTS_PATH}/dich-vu/${contractId}`;

export const ADMIN_CONTRACTS_PATH = "/admin/hop-dong";
export const adminContractPath = (type: ContractTypeKey, id: string) => `${ADMIN_CONTRACTS_PATH}/${type}/${id}`;

export const ADMIN_CONTRACT_TEMPLATES_PATH = "/admin/mau-hop-dong";
export const adminContractTemplatePath = (id: string) => `${ADMIN_CONTRACT_TEMPLATES_PATH}/${id}`;
export const adminContractTemplateCreatePath = (type: string, fromId?: string) => {
  const sp = new URLSearchParams({ type });
  if (fromId) sp.set("from", fromId);
  return `${ADMIN_CONTRACT_TEMPLATES_PATH}/tao?${sp.toString()}`;
};
