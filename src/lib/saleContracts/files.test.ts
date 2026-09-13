// Đường dẫn tệp hợp đồng mua bán. Regex ở đây phải khớp ĐÚNG cái mà
// `sale_contract_file_check` và policy storage kiểm phía server — lệch một ký
// tự là tải lên xong RPC trả `invalid_path`.

import { describe, expect, it } from "vitest";
import {
  OWNER_SALE_CONTRACTS_PATH,
  SALE_BUCKET,
  SALE_FILE_KINDS,
  ownerSaleContractPath,
  portalSaleContractPath,
  saleContractPath,
  saleFileKindOf,
  saleFileName,
  saleObjectPath,
  saleSafeName,
  validateSaleFile,
} from "./files";

const ORG = "c9d00002-0000-4000-8000-000000000001";
const CT = "f10d000e-0000-4000-8000-000000000021";
/** Đúng biểu thức server dùng cho đoạn thứ 3 của path. */
const SERVER_NAME_RE = /^(draft|signed|receipt|handover|title)-\d+-[A-Za-z0-9._-]+$/;

describe("saleObjectPath — 3 đoạn, organization_id đứng ĐẦU", () => {
  it("đúng hình dạng {org}/{contract}/{kind}-{epoch}-{tên}", () => {
    const p = saleObjectPath(ORG, CT, "draft", "du-thao.pdf", 1_760_000_000_000);
    expect(p).toBe(`${ORG}/${CT}/draft-1760000000000-du-thao.pdf`);
    expect(p.split("/")).toHaveLength(3);
    expect(p.split("/")[0]).toBe(ORG);
    expect(p.split("/")[1]).toBe(CT);
  });

  it("mọi loại tệp đều sinh tên khớp regex của server", () => {
    for (const kind of SALE_FILE_KINDS) {
      const seg = saleObjectPath(ORG, CT, kind, "Biên bản bàn giao (bản chính).pdf").split("/")[2];
      expect(SERVER_NAME_RE.test(seg), `${kind} → ${seg}`).toBe(true);
    }
  });

  it("bucket đúng tên", () => {
    expect(SALE_BUCKET).toBe("auction-sale-contracts");
  });
});

describe("saleSafeName — bỏ dấu, không đẻ ký tự lạ", () => {
  it("giữ chữ đọc được thay vì thay hết bằng gạch dưới", () => {
    expect(saleSafeName("Hợp đồng mua bán.pdf")).toBe("Hop_dong_mua_ban.pdf");
  });

  it("đ/Đ thành d/D", () => {
    expect(saleSafeName("đấu giá Đợt 1.pdf")).toBe("dau_gia_Dot_1.pdf");
  });

  it("dấu cách, ngoặc, dấu cộng đều bị gom về một gạch dưới", () => {
    expect(SERVER_NAME_RE.test(`draft-1-${saleSafeName("a (b) + c.pdf")}`)).toBe(true);
  });

  it("tên rỗng vẫn ra tên hợp lệ", () => {
    expect(saleSafeName("")).toBe("tep");
    expect(saleSafeName("???")).toBe("tep");
  });

  it("tên dài bị cắt còn 80 ký tự cuối", () => {
    expect(saleSafeName(`${"a".repeat(200)}.pdf`).length).toBeLessThanOrEqual(80);
  });

  it("tên đã sạch thì giữ nguyên", () => {
    expect(saleSafeName("bien-ban_2026.pdf")).toBe("bien-ban_2026.pdf");
  });
});

describe("saleFileName / saleFileKindOf — đọc ngược tiền tố", () => {
  it("bỏ tiền tố khi hiển thị", () => {
    expect(saleFileName(`${ORG}/${CT}/signed-1760000000000-ban-ky.pdf`)).toBe("ban-ky.pdf");
  });

  it("nhận đúng loại tệp", () => {
    for (const kind of SALE_FILE_KINDS) {
      expect(saleFileKindOf(`${ORG}/${CT}/${kind}-1-x.pdf`), kind).toBe(kind);
    }
  });

  it("path lạ trả null chứ không đoán bừa", () => {
    expect(saleFileKindOf(`${ORG}/${CT}/khac-1-x.pdf`)).toBe(null);
  });
});

describe("validateSaleFile", () => {
  it("nhận pdf/jpeg/png", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png"]) {
      expect(validateSaleFile({ type, size: 1000 }), type).toBe(null);
    }
  });

  it("từ chối loại khác", () => {
    expect(validateSaleFile({ type: "image/gif", size: 10 })).toMatch(/PDF, JPG hoặc PNG/);
  });

  it("từ chối tệp quá 10MB", () => {
    expect(validateSaleFile({ type: "application/pdf", size: 11 * 1024 * 1024 })).toMatch(/10MB/);
  });

  it("đúng 10MB vẫn nhận", () => {
    expect(validateSaleFile({ type: "application/pdf", size: 10 * 1024 * 1024 })).toBe(null);
  });
});

describe("đường dẫn trang", () => {
  it("ba cổng vào khác nhau cho cùng một hợp đồng", () => {
    expect(saleContractPath(CT)).toBe(`/hop-dong-mua-ban/${CT}`);
    expect(portalSaleContractPath(CT)).toBe(`/portal/hop-dong-mua-ban/${CT}`);
    expect(ownerSaleContractPath(CT)).toBe(`/chu-tai-san/hop-dong-mua-ban/${CT}`);
  });

  it("đường dẫn con nằm dưới đường dẫn danh sách", () => {
    expect(ownerSaleContractPath(CT).startsWith(OWNER_SALE_CONTRACTS_PATH)).toBe(true);
  });
});
