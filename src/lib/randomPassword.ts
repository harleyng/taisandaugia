// Sinh mật khẩu ngẫu nhiên cho popup "Đặt lại mật khẩu" của admin.
// Bỏ ký tự dễ nhầm (0/O, 1/l/I) để đọc/gõ tay dễ hơn; đảm bảo có đủ 3 nhóm ký tự.
export function randomPassword(len = 12): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += all[bytes[i] % all.length];
  return (
    out.slice(0, len - 3) +
    lower[bytes[0] % lower.length] +
    upper[bytes[1] % upper.length] +
    digits[bytes[2] % digits.length]
  );
}
