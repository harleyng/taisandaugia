// Dựng lại payload đăng ký (start_bidding_contract / resubmit_bidding_contract)
// từ bản chụp đã lưu trên một hồ sơ.
//
// Dùng khi "Tiếp tục thanh toán" gia hạn giữ chỗ: từ 20261008100100 server đòi
// ảnh giấy tờ cho mọi hồ sơ không khớp VNeID, nên gửi lại chỉ họ tên + số giấy tờ
// (như bản cũ) sẽ bị từ chối. Chép NGUYÊN các đường dẫn ảnh / tổ chức / uỷ quyền
// đã nộp — chúng vẫn nằm trong thư mục của người mua và bị policy chặn xoá.

import type {
  BiddingContract,
  IdentityPayload,
  ProxyPayload,
  RegistrationPayload,
} from "@/types/bidding-contract";

type ContractParties = Pick<
  BiddingContract,
  | "buyer_kind"
  | "phone"
  | "email"
  | "full_name"
  | "id_type"
  | "id_number"
  | "date_of_birth"
  | "gender"
  | "address"
  | "id_front_path"
  | "id_back_path"
  | "id_read_method"
  | "id_edited_fields"
  | "org_name"
  | "org_tax_code"
  | "org_address"
  | "org_reg_doc_path"
  | "has_proxy"
  | "proxy_full_name"
  | "proxy_id_type"
  | "proxy_id_number"
  | "proxy_date_of_birth"
  | "proxy_gender"
  | "proxy_phone"
  | "proxy_address"
  | "proxy_id_front_path"
  | "proxy_id_back_path"
  | "proxy_id_read_method"
  | "proxy_id_edited_fields"
  | "poa_doc_path"
>;

export function contractToRegistrationPayload(c: ContractParties): RegistrationPayload {
  const principal: IdentityPayload = {
    full_name: c.full_name,
    id_type: c.id_type,
    id_number: c.id_number,
    date_of_birth: c.date_of_birth,
    gender: c.gender,
    address: c.address,
    id_front_path: c.id_front_path,
    id_back_path: c.id_back_path,
    read_method: c.id_read_method,
    edited_fields: c.id_edited_fields ?? [],
  };

  const organization =
    c.buyer_kind === "organization" && c.org_name && c.org_tax_code && c.org_address && c.org_reg_doc_path
      ? { name: c.org_name, tax_code: c.org_tax_code, address: c.org_address, reg_doc_path: c.org_reg_doc_path }
      : null;

  const proxy: ProxyPayload | null =
    c.has_proxy && c.proxy_full_name && c.proxy_id_type && c.proxy_id_number && c.proxy_phone && c.proxy_address
      && c.proxy_id_front_path && c.poa_doc_path
      ? {
          full_name: c.proxy_full_name,
          id_type: c.proxy_id_type,
          id_number: c.proxy_id_number,
          date_of_birth: c.proxy_date_of_birth,
          gender: c.proxy_gender,
          phone: c.proxy_phone,
          address: c.proxy_address,
          id_front_path: c.proxy_id_front_path,
          id_back_path: c.proxy_id_back_path,
          read_method: c.proxy_id_read_method,
          edited_fields: c.proxy_id_edited_fields ?? [],
          poa_doc_path: c.poa_doc_path,
        }
      : null;

  return { buyer_kind: c.buyer_kind, phone: c.phone, email: c.email, principal, organization, proxy };
}
