/** Lưu một Blob thành tệp tải về (PDF hợp đồng, bản xem trước mẫu…). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Thu hồi trễ: một số trình duyệt huỷ tải nếu URL bị thu hồi ngay sau click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
