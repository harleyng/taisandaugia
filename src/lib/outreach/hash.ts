/** FNV-1a 32-bit → 8 ký tự hex. Dùng làm chữ ký đầu vào (phát hiện bản nháp cũ)
 *  và khoá câu chữ mẫu thông báo trong test. Không dùng cho bảo mật. */
export function fnv1aHex(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
