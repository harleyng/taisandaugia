// Personalization variables (merge tags) available in the email body.
// Limited to what the recipient snapshot actually carries today (campaign_recipients
// / resolve_campaign_audience return only `name` + `email`). Richer variables would
// require expanding the snapshot + the RPC return columns.
export interface EmailVariable {
  key: string;
  label: string;
  /** Giá trị thay thế khi dữ liệu người nhận rỗng. */
  fallback: string;
}

export const EMAIL_VARIABLES: EmailVariable[] = [
  { key: "name", label: "Họ và tên", fallback: "Quý khách" },
  { key: "email", label: "Email", fallback: "" },
];

/**
 * Thay biến trong HTML nội dung bằng giá trị thực của một người nhận. Nhận cả hai
 * dạng token: chip `<span data-var="name">…</span>` và literal `{{name}}`.
 * Dùng cho preview và (sau này) edge function gửi thật.
 */
export function interpolateVariables(
  html: string,
  values: Record<string, string | null | undefined>,
): string {
  let out = html;
  for (const v of EMAIL_VARIABLES) {
    const raw = (values[v.key] ?? "").toString().trim();
    const val = raw || v.fallback;
    // chip: <span ... data-var="name" ...>label</span>
    out = out.replace(
      new RegExp(`<span[^>]*data-var=["']${v.key}["'][^>]*>.*?</span>`, "gi"),
      val,
    );
    // literal token: {{name}}
    out = out.replace(new RegExp(`\\{\\{\\s*${v.key}\\s*\\}\\}`, "g"), val);
  }
  return out;
}
