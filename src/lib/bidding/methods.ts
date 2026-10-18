// Ba phương thức trả giá của phiên đấu giá trực tuyến (auction_sessions.bidding_method,
// CHECK ở 20261018190000_descending_sealed_methods.sql). Một nguồn nhãn + quy tắc
// hiển thị cho form phiên, trang phiên công khai, phòng đấu giá và biên bản.

export type BiddingMethod = "ascending" | "descending" | "sealed";

export const BIDDING_METHODS: BiddingMethod[] = ["ascending", "descending", "sealed"];

export const BIDDING_METHOD_LABELS: Record<BiddingMethod, string> = {
  ascending: "Trả giá lên",
  descending: "Đặt giá xuống",
  sealed: "Bỏ phiếu kín",
};

export const BIDDING_METHOD_DESCRIPTIONS: Record<BiddingMethod, string> = {
  ascending: "Mỗi lượt trả cao hơn ít nhất một bước giá. Ai trả cao nhất khi hết giờ thì trúng.",
  descending: "Giá tự giảm theo nhịp đến giá sàn. Ai chấp nhận giá đầu tiên thì trúng.",
  sealed: "Mỗi người nộp một phiếu giá kín. Giá cao nhất trúng, bằng giá thì đấu vòng phụ.",
};

export const isBiddingMethod = (v: string | null | undefined): v is BiddingMethod =>
  v === "ascending" || v === "descending" || v === "sealed";

export const biddingMethodLabel = (v: string | null | undefined) =>
  isBiddingMethod(v) ? BIDDING_METHOD_LABELS[v] : v || "—";

/** Phương thức của phiên; giá trị lạ coi như trả giá lên (giá trị mặc định ở DB). */
export const biddingMethodOf = (v: string | null | undefined): BiddingMethod => (isBiddingMethod(v) ? v : "ascending");

/** "90 giây" / "2 phút" / "1 phút 30 giây". */
export function secondsText(total: number): string {
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} phút ${rest} giây` : `${m} phút`;
}

export interface MethodRulesSession {
  bidding_method: string;
  extension_seconds: number | null;
  max_bid_steps: number | null;
  price_drop_seconds?: number | null;
}

export interface MethodRuleRow {
  label: string;
  value: string;
}

/**
 * Các dòng "quy tắc trả giá" theo phương thức. Dòng đầu luôn là phương thức;
 * gia hạn + số bước tối đa chỉ có nghĩa với trả giá lên.
 */
export function methodRuleRows(s: MethodRulesSession): MethodRuleRow[] {
  const method = biddingMethodOf(s.bidding_method);
  const rows: MethodRuleRow[] = [{ label: "Phương thức", value: BIDDING_METHOD_LABELS[method] }];
  if (method === "ascending") {
    rows.push(
      {
        label: "Gia hạn khi có giá cuối",
        value: s.extension_seconds ? secondsText(s.extension_seconds) : "Không gia hạn",
      },
      { label: "Tối đa mỗi lượt", value: s.max_bid_steps ? `${s.max_bid_steps} bước giá` : "Không giới hạn" },
    );
  } else if (method === "descending") {
    rows.push(
      {
        label: "Nhịp giảm giá",
        value: s.price_drop_seconds ? `1 bước giá / ${secondsText(s.price_drop_seconds)}` : "—",
      },
      { label: "Người trúng", value: "Người đầu tiên chấp nhận giá" },
    );
  } else {
    rows.push(
      { label: "Số phiếu", value: "Một phiếu kín mỗi vòng, không sửa" },
      { label: "Bằng giá", value: "Mở vòng phụ cho những người bằng giá" },
    );
  }
  return rows;
}
