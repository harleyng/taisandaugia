import { describe, expect, it } from "vitest";
import { parseCccdQr, parseQrDate } from "./cccdQr";

const ADDRESS = "Số 12 Ngõ 34 Phố Huế, Phường Phố Huế, Quận Hai Bà Trưng, Hà Nội";

describe("parseCccdQr", () => {
  it("đọc đủ 7 trường của CCCD gắn chip", () => {
    const raw = `001099012345|013456789|Nguyễn Văn An|12041985|Nam|${ADDRESS}|15082021`;
    expect(parseCccdQr(raw)).toEqual({
      id_number: "001099012345",
      old_id_number: "013456789",
      full_name: "Nguyễn Văn An",
      date_of_birth: "1985-04-12",
      gender: "male",
      address: ADDRESS,
      id_issued_on: "2021-08-15",
    });
  });

  it("trường CMND rỗng ⇒ old_id_number null", () => {
    const r = parseCccdQr(`079190654321||Trần Thị Mai|20071990|Nữ|${ADDRESS}|01032022`);
    expect(r?.old_id_number).toBeNull();
    expect(r?.full_name).toBe("Trần Thị Mai");
    expect(r?.gender).toBe("female");
    expect(r?.id_issued_on).toBe("2022-03-01");
  });

  it("thiếu hẳn trường CMND (6 trường) vẫn đọc đúng vị trí", () => {
    const r = parseCccdQr(`079190654321|Trần Thị Mai|20071990|Nữ|${ADDRESS}|01032022`);
    expect(r).toMatchObject({
      id_number: "079190654321",
      old_id_number: null,
      full_name: "Trần Thị Mai",
      date_of_birth: "1990-07-20",
      gender: "female",
      address: ADDRESS,
      id_issued_on: "2022-03-01",
    });
  });

  it("Nữ dạng tổ hợp (NFD) vẫn nhận ra", () => {
    const r = parseCccdQr(`079190654321||Trần Thị Mai|20071990|${"Nữ".normalize("NFD")}|${ADDRESS}|01032022`);
    expect(r?.gender).toBe("female");
  });

  it("bỏ trường thừa, dấu | cuối, khoảng trắng và xuống dòng", () => {
    const raw = `  001099012345|013456789|  Nguyễn   Văn An |12041985|Nam|${ADDRESS}|15082021|extra|\r\n`;
    const r = parseCccdQr(raw);
    expect(r?.full_name).toBe("Nguyễn Văn An");
    expect(r?.id_issued_on).toBe("2021-08-15");
  });

  it("thiếu ngày cấp ⇒ id_issued_on null", () => {
    const r = parseCccdQr(`001099012345|013456789|Nguyễn Văn An|12041985|Nam|${ADDRESS}`);
    expect(r?.id_issued_on).toBeNull();
    expect(r?.address).toBe(ADDRESS);
  });

  it("ngày / giới tính hỏng ⇒ null từng trường, không bỏ cả bản ghi", () => {
    const r = parseCccdQr(`001099012345||Nguyễn Văn An|31021985|Khác|${ADDRESS}|15082021`);
    expect(r?.date_of_birth).toBeNull();
    expect(r?.gender).toBeNull();
    expect(r?.id_number).toBe("001099012345");
  });

  it("không phải QR CCCD ⇒ null", () => {
    expect(parseCccdQr("")).toBeNull();
    expect(parseCccdQr(null)).toBeNull();
    expect(parseCccdQr("https://example.com/abc")).toBeNull();
    expect(parseCccdQr("12345|abc|def")).toBeNull();
    // Số CCCD sai độ dài.
    expect(parseCccdQr(`00109901234|013456789|Nguyễn Văn An|12041985|Nam|${ADDRESS}|15082021`)).toBeNull();
    // Họ tên chứa số = lệch cột.
    expect(parseCccdQr(`001099012345|013456789|12041985|Nam|${ADDRESS}|15082021`)).toBeNull();
  });
});

describe("parseQrDate", () => {
  it("ddmmyyyy → ISO, chặn ngày không có thật", () => {
    expect(parseQrDate("29022000")).toBe("2000-02-29");
    expect(parseQrDate("29022001")).toBeNull();
    expect(parseQrDate("1985-04-12")).toBeNull();
  });
});
