// In tờ rơi: dựng một trang A4 trong iframe ẩn rồi gọi print() của iframe — layout
// portal không có CSS in nên không in thẳng window hiện tại.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Dòng VIẾT HOA toàn bộ (tên tổ chức, "TÀI SẢN", "LỊCH PHIÊN"…) in thành tiêu đề mục. */
const isHeading = (line: string) => line.trim().length > 2 && line === line.toUpperCase() && /\p{L}/u.test(line);

export function flyerHtml(text: string, title: string): string {
  const body = text
    .split("\n")
    .map((line, i) => {
      if (!line.trim()) return "<div class='gap'></div>";
      if (i === 2) return `<h1>${esc(line)}</h1>`;
      if (isHeading(line)) return `<h2>${esc(line)}</h2>`;
      return `<p>${esc(line)}</p>`;
    })
    .join("\n");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: Arial, "Helvetica Neue", sans-serif; color: #111; font-size: 12.5pt; line-height: 1.45; }
h1 { font-size: 20pt; margin: 4pt 0 8pt; }
h2 { font-size: 12pt; letter-spacing: .04em; margin: 10pt 0 2pt; color: #14532d; }
p { margin: 0 0 2pt; white-space: pre-wrap; }
.gap { height: 4pt; }
</style></head><body>${body}</body></html>`;
}

export function printFlyer(text: string, title: string): boolean {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(flyerHtml(text, title));
  doc.close();
  const cleanup = () => window.setTimeout(() => iframe.remove(), 1000);
  win.onafterprint = cleanup;
  window.setTimeout(() => {
    win.focus();
    win.print();
    cleanup();
  }, 150);
  return true;
}
