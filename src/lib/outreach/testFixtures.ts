// Dữ liệu dùng chung cho test của src/lib/outreach — không import từ code chạy thật.

import { parseCaseFile } from "./caseFile";
import type { OutreachInput } from "./outreachInput";

export const LOT1 = "a1a1a1a1-0000-4000-8000-000000000001";
export const LOT2 = "a1a1a1a1-0000-4000-8000-000000000002";
export const LOT3 = "a1a1a1a1-0000-4000-8000-000000000003";

export function buildInput(over: Partial<OutreachInput> = {}): OutreachInput {
  return {
    session: {
      id: "5e551011-0000-4000-8000-000000000001",
      code: "PDG000123",
      title: "Phiên đấu giá nhà phố và xe công vụ",
      auction_format: "truc_tiep",
      venue: "Hội trường Công ty, 12 Lê Lợi, Quận 1",
      province: "TP. Hồ Chí Minh",
      registration_start_at: "2026-09-12T01:00:00Z",
      registration_end_at: "2026-09-25T10:00:00Z",
      viewing_start_at: "2026-09-15T01:00:00Z",
      viewing_end_at: "2026-09-17T10:00:00Z",
      starts_at: "2026-09-28T02:00:00Z",
      ends_at: "2026-09-28T05:00:00Z",
      dossier_fee: 500000,
    },
    org: { name: "Công ty Đấu giá Hợp danh Bảo Tín", address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh", phone: "02838221234" },
    lots: [
      {
        id: LOT2,
        lot_no: 2,
        title: "Xe ô tô Toyota Innova 2019",
        category_slug: "o-to",
        province: "TP. Hồ Chí Minh",
        district: null,
        starting_price: 450000000,
        deposit_amount: 45000000,
        bid_step: 5000000,
      },
      {
        id: LOT1,
        lot_no: 1,
        title: "Nhà phố Quận 5",
        category_slug: "nha-pho",
        province: "TP. Hồ Chí Minh",
        district: "Quận 5",
        starting_price: 12500000000,
        deposit_amount: 1250000000,
        bid_step: 50000000,
      },
    ],
    caseFile: parseCaseFile({
      owner_info: "Ngân hàng TMCP A, 1 Nguyễn Huệ, Quận 1",
      contact_person: "Chị Lan — 0901234567",
      lots: {
        [LOT1]: { description: "Nhà 1 trệt 3 lầu, diện tích đất 68m², hẻm xe hơi.", condition: "Đang bỏ trống" },
      },
    }),
    publicUrl: "https://taisandaugia.vn/sessions/5e551011",
    segments: [`lot:${LOT1}`, `lot:${LOT2}`, "multi"],
    ...over,
  };
}
