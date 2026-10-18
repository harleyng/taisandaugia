// Chuyển khoản tiền đặt trước (trang /ho-so-cua-toi/:code/dat-truoc): nội dung
// chuyển khoản để tổ chức khớp tiền với hồ sơ, và mã VietQR (chuẩn EMVCo của
// NAPAS) điền sẵn số tài khoản + số tiền + nội dung.
//
// org_bank_accounts.bank_name là chữ tự do ⇒ đoán mã BIN từ tên ngân hàng; không
// đoán được thì trang chỉ hiện thông tin chuyển tay, không vẽ mã sai.

/** Bỏ dấu tiếng Việt, đ → d. */
export function stripVietnamese(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Ngân hàng chỉ nhận ký tự ASCII trong nội dung chuyển khoản; giữ ≤ 50 ký tự. */
const MEMO_MAX = 50;

/** "HSDG000017 NGUYEN VAN AN" — mã hồ sơ (bỏ ký tự lạ) + họ tên viết hoa không dấu. */
export function transferMemo(code: string, fullName: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const n = stripVietnamese(fullName)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${c} ${n}`.trim().slice(0, MEMO_MAX).trim();
}

/** "0071001234567" → "0071 0012 34567" cho dễ đọc; sao chép vẫn dùng bản gốc. */
export function groupAccountNumber(no: string): string {
  const d = no.replace(/\s/g, "");
  return d.length <= 8 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`.trim();
}

// Mã BIN NAPAS của các ngân hàng phổ biến. Khoá là tên đã bỏ dấu, viết thường.
const BANK_BINS: [RegExp, string][] = [
  [/vietcombank|ngoai thuong|\bvcb\b/, "970436"],
  [/vietinbank|cong thuong|\bctg\b/, "970415"],
  [/\bbidv\b|dau tu va phat trien/, "970418"],
  [/agribank|nong nghiep/, "970405"],
  [/techcombank|ky thuong|\btcb\b/, "970407"],
  [/\bmb\b|mbbank|mb bank|quan doi/, "970422"],
  [/\bacb\b|a chau/, "970416"],
  [/vpbank|viet nam thinh vuong/, "970432"],
  [/sacombank|sai gon thuong tin/, "970403"],
  [/tpbank|tien phong/, "970423"],
  [/hdbank|phat trien tp/, "970437"],
  [/\bvib\b|quoc te/, "970441"],
  [/\bshb\b|sai gon ha noi/, "970443"],
  [/\bocb\b|phuong dong/, "970448"],
  [/\bmsb\b|hang hai/, "970426"],
  [/seabank|dong nam a/, "970440"],
  [/eximbank|xuat nhap khau/, "970431"],
  [/lpbank|lienvietpostbank|loc phat/, "970449"],
  [/nam a bank|namabank|nam a/, "970428"],
  [/bac a bank|bacabank|bac a/, "970409"],
];

export function bankBinOf(bankName: string | null | undefined): string | null {
  const n = stripVietnamese(bankName ?? "").toLowerCase();
  if (!n) return null;
  return BANK_BINS.find(([re]) => re.test(n))?.[1] ?? null;
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — trường 63 của EMVCo. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface VietQrInput {
  bin: string;
  accountNumber: string;
  amount: number;
  memo: string;
}

/** Chuỗi VietQR động (point of initiation 12) chuyển nhanh 24/7 tới số tài khoản. */
export function vietQrPayload({ bin, accountNumber, amount, memo }: VietQrInput): string {
  const beneficiary = tlv("00", bin) + tlv("01", accountNumber.replace(/\s/g, ""));
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amount > 0 ? tlv("54", String(Math.round(amount))) : "") +
    tlv("58", "VN") +
    (memo ? tlv("62", tlv("08", memo)) : "") +
    "6304";
  return body + crc16(body);
}
