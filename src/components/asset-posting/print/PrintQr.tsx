import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Mã QR dạng SVG vẽ đồng bộ (QRCode.create) — không phải chờ ảnh nên hộp thoại in
 * tự mở được ngay khi dữ liệu xong. Viền trắng do khung .qr của thiết kế lo.
 */
export function PrintQr({ value, label }: { value: string; label: string }) {
  const path = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = modules.size;
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
    }
    return { d, n };
  }, [value]);

  return (
    <svg viewBox={`0 0 ${path.n} ${path.n}`} shapeRendering="crispEdges" role="img" aria-label={label}>
      <path d={path.d} fill="hsl(222 47% 11%)" />
    </svg>
  );
}
