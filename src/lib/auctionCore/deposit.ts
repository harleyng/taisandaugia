// Quy đổi tiền đặt trước từ phương án báo giá (asset_service_requests.quote_plan)
// sang VNĐ để prefill lô tài sản trong phiên.
//
// quote_plan.deposit_mode = 'percent' ⇒ deposit_value là % giá khởi điểm;
// 'amount' ⇒ deposit_value đã là VNĐ. Thiếu giá khởi điểm thì KHÔNG đoán — trả
// null để tổ chức tự nhập, thay vì prefill một con số sai.

export function depositFromPlan(
  mode: "percent" | "amount" | null | undefined,
  value: number | null | undefined,
  startingPrice: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (mode === "percent") {
    if (startingPrice == null || !Number.isFinite(startingPrice) || startingPrice <= 0) return null;
    return Math.round((startingPrice * value) / 100);
  }
  return Math.round(value);
}
