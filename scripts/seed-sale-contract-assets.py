"""Sinh tệp PDF placeholder cho bộ demo HỢP ĐỒNG MUA BÁN (phiên PDG000014).

Đường dẫn phải KHỚP TUYỆT ĐỐI với migration 20260914000010_seed_sale_contract_demo.sql
— `sale_contract_file_check` từ chối mọi path không có tệp thật trong bucket, nên
tệp phải nằm sẵn trong storage TRƯỚC khi áp migration.

    python3 scripts/seed-sale-contract-assets.py --out /tmp/hdmb
    npx supabase storage cp -r /tmp/hdmb/auction-sale-contracts \
        ss:///auction-sale-contracts --experimental

Có SUPABASE_SERVICE_ROLE_KEY thì script tự tải lên, khỏi bước `storage cp`:

    SUPABASE_SERVICE_ROLE_KEY=… python3 scripts/seed-sale-contract-assets.py

Gỡ: xoá thư mục hai hợp đồng trong bucket `auction-sale-contracts` (Storage API),
đúng như phần teardown ở đầu migration.
"""
import argparse
import io
import os
import sys
import urllib.error
import urllib.request

from PIL import Image, ImageDraw, ImageFont

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vewtnkewyawmkpeymdot.supabase.co").rstrip("/")
BUCKET = "auction-sale-contracts"

ORG = "c9d00002-0000-4000-8000-000000000001"          # Công ty Đấu giá Hợp danh Bảo Tín
CONTRACT_1 = "f10d000f-0000-4000-8000-000000000011"   # lô 1 — ký gửi, bên bán là chủ tài sản
CONTRACT_2 = "f10d000f-0000-4000-8000-000000000012"   # lô 2 — tin đăng, tổ chức ký thay

# Epoch cố định ⇒ path tất định, chạy lại không đẻ tệp mới.
T_DRAFT = 1789095600000    # 2026-09-11
T_SIGNED = 1789182000000   # 2026-09-12
T_RECEIPT = 1789268400000  # 2026-09-13

DEMO_STAMP = "DỮ LIỆU DEMO — KHÔNG CÓ GIÁ TRỊ PHÁP LÝ"

FONT_PATHS = [
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def doc_pdf(header, title, lines, signed=False):
    """Trang A4 dọc dạng bản scan, lưu PDF."""
    w, h = 1240, 1754
    img = Image.new("RGB", (w, h), "#F7F7F3")
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, w - 40, h - 40], outline="#C9C9C2", width=3)
    d.text((90, 100), header, font=font(30), fill="#1F6F54")
    d.text((90, 160), title, font=font(40), fill="#20242B")
    y = 270
    for line in lines:
        d.text((90, y), line, font=font(28), fill="#30343B")
        y += 52
    y += 20
    for i in range(10):
        width = w - 180 if i % 4 != 3 else int((w - 180) * 0.6)
        d.rectangle([90, y + 20, 90 + width, y + 36], fill="#DADAD4")
        y += 48
    if signed:
        # Hai ô chữ ký nguệch ngoạc cho giống bản scan giấy đã ký.
        for idx, label in enumerate(("BÊN BÁN", "BÊN MUA")):
            x = 130 + idx * 540
            d.text((x, h - 470), label, font=font(26), fill="#30343B")
            d.line([(x + 10, h - 360), (x + 90, h - 410), (x + 170, h - 345),
                    (x + 250, h - 400), (x + 330, h - 355)], fill="#1B3A8A", width=5)
            d.line([(x, h - 300), (x + 380, h - 300)], fill="#9A9A94", width=2)
    d.text((90, h - 150), DEMO_STAMP, font=font(30), fill="#9A6B00")
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=150)
    return buf.getvalue()


def files():
    """(path trong bucket, bytes) — mọi tệp mà migration trỏ tới."""
    lot1 = [
        "Phiên đấu giá: PDG000014 [DEMO]",
        "Lô 1 — Nhà phố 4 tầng hẻm xe hơi, Quận 5",
        "Giá trúng đấu giá: 12,700,000,000 VNĐ",
        # Cọc nộp theo PHIÊN (phủ cả 2 lô) nên toàn bộ 4,590,000,000 được cấn trừ.
        "Tiền đặt trước chuyển thành tiền mua: 4,590,000,000 VNĐ",
        "Còn phải thanh toán: 8,110,000,000 VNĐ",
        "Bên bán: chủ tài sản ký gửi (có tài khoản trên sàn)",
        "Bên mua: người trúng đấu giá — số báo danh 01",
        "Tổ chức đấu giá: Công ty Đấu giá Hợp danh Bảo Tín",
    ]
    lot2 = [
        "Phiên đấu giá: PDG000014 [DEMO]",
        "Lô 2 — Nhà mặt ngõ 421.3m² tại Trung tâm, Quảng Nam",
        "Giá trúng đấu giá: 33,800,000,000 VNĐ",
        "Tiền đặt trước chuyển thành tiền mua: 4,590,000,000 VNĐ",
        "Còn phải thanh toán: 29,210,000,000 VNĐ",
        "Bên bán: Công ty Đấu giá Hợp danh Bảo Tín ký thay chủ tài sản",
        "Bên mua: người trúng đấu giá — số báo danh 02",
    ]
    return [
        (f"{ORG}/{CONTRACT_1}/draft-{T_DRAFT}-du-thao-hop-dong-mua-ban.pdf",
         doc_pdf("DỰ THẢO — CHƯA KÝ", "HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ", lot1)),
        (f"{ORG}/{CONTRACT_1}/signed-{T_SIGNED}-ban-scan-hop-dong-da-ky.pdf",
         doc_pdf("BẢN SCAN ĐÃ KÝ", "HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ", lot1, signed=True)),
        (f"{ORG}/{CONTRACT_1}/receipt-{T_RECEIPT}-uy-nhiem-chi-5-ty.pdf",
         doc_pdf("CHỨNG TỪ THU TIỀN", "ỦY NHIỆM CHI", [
             "Số tiền: 5,000,000,000 VNĐ",
             "Nội dung: Thanh toán đợt 1 hợp đồng mua bán lô 1 PDG000014",
             "Người nộp: bên mua trúng đấu giá",
             "Người hưởng: Công ty Đấu giá Hợp danh Bảo Tín (thu hộ)",
         ])),
        (f"{ORG}/{CONTRACT_2}/draft-{T_DRAFT}-du-thao-hop-dong-mua-ban.pdf",
         doc_pdf("DỰ THẢO — CHƯA KÝ", "HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ", lot2)),
    ]


def upload(key, path, blob):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        data=blob, method="POST",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/pdf", "x-upsert": "true"})
    try:
        urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        print(f"  LỖI {e.code}: {e.read().decode()}", file=sys.stderr)
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="Ghi tệp ra thư mục thay vì tải lên "
                                  "(để dùng với `npx supabase storage cp -r`).")
    args = ap.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not args.out and not key:
        sys.exit("Cần --out <thư mục> hoặc biến môi trường SUPABASE_SERVICE_ROLE_KEY.")

    ok = True
    for path, blob in files():
        if args.out:
            dest = os.path.join(args.out, BUCKET, path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(blob)
            print(f"  ghi  {dest} ({len(blob):,} bytes)")
        else:
            ok = upload(key, path, blob) and ok
            print(f"  tải  {BUCKET}/{path} ({len(blob):,} bytes)")
    if not ok:
        sys.exit(1)
    print("Xong. Áp migration 20260914000010 SAU khi tệp đã nằm trong bucket.")


if __name__ == "__main__":
    main()
