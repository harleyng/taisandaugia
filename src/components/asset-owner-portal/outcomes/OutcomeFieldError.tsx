/** Dòng lỗi ngắn dưới một ô của form khai kết quả. */
export function OutcomeFieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}
