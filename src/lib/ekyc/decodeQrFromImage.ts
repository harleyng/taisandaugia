// Đọc mã QR từ ẢNH CHỤP (không phải camera trực tiếp) — mã QR in ở góc trên bên
// phải mặt trước CCCD gắn chip / thẻ Căn cước.
//
// Mã QR trên thẻ dày đặc, ảnh điện thoại lại to và hay chụp nghiêng/xoay ⇒ thử
// nhiều "ứng viên" từ rẻ tới đắt và dừng ở cái đầu tiên đọc được:
//   1. cả ảnh, thu về cạnh dài 1600 px;
//   2. góc trên-phải (chỗ in mã) — phóng to vì mã chỉ chiếm ~1/6 mặt thẻ;
//   3. ba góc còn lại — ảnh bị xoay 90°/180°/270° thì mã nằm ở góc khác;
//   4. cả ảnh xoay 90° / 180°, và cả ảnh ở độ phân giải cao hơn.
//
// PHẢI đọc từ tệp GỐC, trước khi nén để tải lên — nén JPEG làm vỡ mô-đun QR.
// @zxing/browser nặng ~400 KB ⇒ import động, chỉ tải khi người dùng chọn ảnh.

import type { DecodeHintType as HintKey } from "@zxing/library";

type Box = { sx: number; sy: number; sw: number; sh: number };
type Candidate = { box: (w: number, h: number) => Box; maxDim: number; rotate?: 0 | 90 | 180 };

const FULL = (w: number, h: number): Box => ({ sx: 0, sy: 0, sw: w, sh: h });
/** Góc của ảnh, rộng 55% × cao 60% — đủ trùm mã QR kể cả khi thẻ không lấp đầy khung. */
const corner = (right: boolean, bottom: boolean) => (w: number, h: number): Box => ({
  sx: right ? w * 0.45 : 0,
  sy: bottom ? h * 0.4 : 0,
  sw: w * 0.55,
  sh: h * 0.6,
});

const CANDIDATES: Candidate[] = [
  { box: FULL, maxDim: 1600 },
  { box: corner(true, false), maxDim: 1400 },
  { box: corner(false, true), maxDim: 1400 },
  { box: corner(true, true), maxDim: 1400 },
  { box: corner(false, false), maxDim: 1400 },
  { box: FULL, maxDim: 1600, rotate: 90 },
  { box: FULL, maxDim: 1600, rotate: 180 },
  { box: FULL, maxDim: 2600 },
];

async function loadImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap tự xoay theo EXIF (ảnh dọc chụp từ điện thoại).
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Không mở được ảnh"));
    img.src = url;
  });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

function draw(img: { source: CanvasImageSource; width: number; height: number }, c: Candidate): HTMLCanvasElement {
  const { sx, sy, sw, sh } = c.box(img.width, img.height);
  // Chỉ phóng to tối đa 2× — phóng hơn nữa chỉ làm nhoè thêm.
  const scale = Math.min(c.maxDim / Math.max(sw, sh), 2);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const quarter = c.rotate === 90;

  const canvas = document.createElement("canvas");
  canvas.width = quarter ? dh : dw;
  canvas.height = quarter ? dw : dh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = "high";
  if (c.rotate) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((c.rotate * Math.PI) / 180);
    ctx.translate(-dw / 2, -dh / 2);
  }
  ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas;
}

/**
 * Chuỗi trong mã QR đầu tiên đọc được, hoặc null (không có mã / ảnh quá mờ /
 * không phải ảnh). Không bao giờ ném lỗi — nơi gọi lùi về OCR / gõ tay.
 */
export async function decodeQrFromImage(file: Blob): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const [{ BrowserQRCodeReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map<HintKey, unknown>([
      [DecodeHintType.TRY_HARDER, true],
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
      // Họ tên / địa chỉ có dấu — để zxing tự đoán dễ ra mojibake.
      [DecodeHintType.CHARACTER_SET, "UTF-8"],
    ]);
    const reader = new BrowserQRCodeReader(hints);

    const img = await loadImage(file);
    try {
      for (const c of CANDIDATES) {
        try {
          const text = reader.decodeFromCanvas(draw(img, c)).getText();
          if (text) return text;
        } catch {
          // NotFound / Checksum / Format — thử ứng viên tiếp theo.
        }
      }
    } finally {
      img.close();
    }
  } catch {
    // Không tải được thư viện hoặc không mở được ảnh (HEIC trên Chrome…).
  }
  return null;
}
