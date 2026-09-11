"""Nạp ảnh / PDF placeholder cho bộ demo xuyên luồng (số hoá → báo giá → hợp đồng →
phiên → tiếp thị → hỗ trợ khách hàng) vào Supabase Storage.

Đường dẫn phải KHỚP TUYỆT ĐỐI với migration 20260912000200_seed_flow_demo.sql — bản
ghi trong DB trỏ tới đúng các key này.

    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python3 scripts/seed-flow-demo-assets.py
    … python3 scripts/seed-flow-demo-assets.py --teardown   # gỡ toàn bộ tệp demo

Chạy lần đầu cũng xoá 2 PDF của phiên thử nghiệm cũ PDG000010 (migration đã xoá phiên).
"""
import io
import json
import os
import sys
import urllib.error
import urllib.request

from PIL import Image, ImageColor, ImageDraw, ImageFont

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vewtnkewyawmkpeymdot.supabase.co").rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

OWNER = "ae9bfef5-2694-466f-a97e-5efdf138ac43"
BT_ORG = "c9d00002-0000-4000-8000-000000000001"
CONTRACT = "f10d0004-0000-4000-8000-000000000001"
SESSION = "f10d0006-0000-4000-8000-000000000001"
DOC_NOTICE = "f10d0007-0000-4000-8000-000000000001"
DOC_DEPOSIT = "f10d0007-0000-4000-8000-000000000002"
PDG10 = "af5b80fd-f5bf-4e92-a8df-b5bf7c9f2432"


def fid(group, n):
    return f"f10d{group}-0000-4000-8000-{n:012d}"


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


DEMO_STAMP = "DỮ LIỆU DEMO — KHÔNG CÓ GIÁ TRỊ PHÁP LÝ"


def photo_png(caption, subtitle, color):
    """Ảnh minh hoạ 4:3 cho tài sản."""
    w, h = 1200, 900
    base = ImageColor.getrgb(color)
    img = Image.new("RGB", (w, h), color)
    d = ImageDraw.Draw(img)
    for i in range(0, h, 6):
        shade = int(40 * i / h)
        d.rectangle([0, i, w, i + 6], fill=tuple(max(0, c - shade) for c in base))
    d.rectangle([60, h - 230, w - 60, h - 60], fill="#FFFFFF")
    d.text((96, h - 205), caption, font=font(46), fill="#20242B")
    d.text((96, h - 140), subtitle, font=font(28), fill="#5B6472")
    d.text((96, 70), "ẢNH MINH HOẠ — DEMO", font=font(30), fill="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def doc_pdf(header, title, lines):
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
    for i in range(14):
        width = w - 180 if i % 4 != 3 else int((w - 180) * 0.6)
        d.rectangle([90, y + 20, 90 + width, y + 36], fill="#DADAD4")
        y += 48
    d.text((90, h - 150), DEMO_STAMP, font=font(30), fill="#9A6B00")
    buf = io.BytesIO()
    img.save(buf, "PDF", resolution=150)
    return buf.getvalue()


def files():
    """(bucket, path, bytes, content-type) — mọi tệp mà migration trỏ tới."""
    out = []
    photos = [
        (1, "Mặt tiền Tô Hiến Thành", "Nhà phố 4 tầng · Quận 10", "#3D6E7A"),
        (2, "Phòng khách tầng 2", "Nhà phố 4 tầng · Quận 10", "#8A5A2B"),
        (3, "Sân thượng", "Nhà phố 4 tầng · Quận 10", "#4A5A2B"),
        (4, "Mercedes-Benz GLC 300", "Ngoại thất · 2021", "#2C5F8A"),
        (5, "Khoang lái GLC 300", "Nội thất · 38.500 km", "#7A4B8C"),
        (6, "Komatsu PC200-8", "Máy xúc bánh xích · 2016", "#8A3B4B"),
    ]
    for n, cap, sub, color in photos:
        out.append(("asset-media", f"{OWNER}/{fid('000d', n)}.png", photo_png(cap, sub, color), "image/png"))

    proofs = [
        (1, "GIẤY CHỨNG NHẬN QSDĐ, QSH NHÀ Ở", ["Địa chỉ: 312 Tô Hiến Thành, Phường 15, Quận 10", "Diện tích đất: 72 m² · Sàn: 268 m²"]),
        (2, "GIẤY CHỨNG NHẬN ĐĂNG KÝ XE Ô TÔ", ["Nhãn hiệu: Mercedes-Benz GLC 300 4MATIC", "Năm sản xuất: 2021 · Màu sơn: Trắng"]),
        (3, "GIẤY CHỨNG NHẬN QSDĐ", ["Phường Long Trường, TP. Thủ Đức", "Diện tích: 120 m² · Đất ở đô thị"]),
        (4, "HOÁ ĐƠN / CHỨNG TỪ SỞ HỮU MÁY", ["Máy xúc Komatsu PC200-8", "Số khung: DEMO-PC200-2016"]),
    ]
    for n, title, lines in proofs:
        out.append(("asset-docs", f"{OWNER}/ownership/{fid('000c', n)}.pdf",
                    doc_pdf("BẢN SCAN GIẤY TỜ SỞ HỮU", title, ["Chủ sở hữu: Nguyễn Hoàng Long", *lines]), "application/pdf"))

    contract_lines = [
        "Số: HĐDV-BT/2026/087",
        "Bên A (chủ tài sản): Nguyễn Hoàng Long",
        "Bên B: Công ty Đấu giá Hợp danh Bảo Tín",
        "Tài sản: Nhà phố 4 tầng mặt tiền Tô Hiến Thành, Quận 10",
        "Giá khởi điểm: 12,800,000,000₫ · Phí dịch vụ: 60,000,000₫",
    ]
    out.append(("consignment-contracts", f"{BT_ORG}/{CONTRACT}/draft-1756113600000-Du_thao_HDDV_Bao_Tin.pdf",
                doc_pdf("CÔNG TY ĐẤU GIÁ HỢP DANH BẢO TÍN", "DỰ THẢO HỢP ĐỒNG DỊCH VỤ ĐẤU GIÁ", contract_lines), "application/pdf"))
    out.append(("consignment-contracts", f"{BT_ORG}/{CONTRACT}/signed-1756353600000-HDDV_da_ky_2_ben.pdf",
                doc_pdf("CÔNG TY ĐẤU GIÁ HỢP DANH BẢO TÍN", "HỢP ĐỒNG DỊCH VỤ ĐẤU GIÁ — ĐÃ KÝ",
                        [*contract_lines, "Ngày ký: 27/08/2026", "(Chữ ký và dấu của hai bên)"]), "application/pdf"))

    out.append(("case-documents", f"{BT_ORG}/{SESSION}/{DOC_NOTICE}/1756710000000-thong-bao-dau-gia-PDG000012.pdf",
                doc_pdf("CÔNG TY ĐẤU GIÁ HỢP DANH BẢO TÍN", "THÔNG BÁO ĐẤU GIÁ TÀI SẢN số 087/2026/TB-BT",
                        ["Phiên PDG000012 · 09:00 ngày 16/10/2026", "Lô 1: Nhà phố Tô Hiến Thành, Quận 10 — 12,800,000,000₫",
                         "Lô 2: Nhà riêng 750 m² Đường số 65 — 37,650,000,000₫", "Xem tài sản: 22/09 – 24/09/2026",
                         "Bán hồ sơ đến 17:00 ngày 13/10/2026 · 500,000₫/hồ sơ"]), "application/pdf"))
    out.append(("case-documents", f"{BT_ORG}/{SESSION}/{DOC_DEPOSIT}/1756710300000-quy-dinh-tien-dat-truoc-PDG000012.pdf",
                doc_pdf("CÔNG TY ĐẤU GIÁ HỢP DANH BẢO TÍN", "QUY ĐỊNH VỀ TIỀN ĐẶT TRƯỚC — PDG000012",
                        ["Lô 1: 1,280,000,000₫ · Lô 2: 3,765,000,000₫", "Nộp từ 08:00 10/10 đến 17:00 13/10/2026",
                         "Tài khoản: DEMO-0000-1111 (dữ liệu mẫu)", "Hoàn trả trong 03 ngày làm việc sau cuộc đấu giá"]), "application/pdf"))
    return out


LEGACY = [
    ("case-documents", f"{BT_ORG}/{PDG10}/88c85938-35eb-47bf-8800-6eaf5c6a4e5c/deposit_terms-thu-nghiem.pdf"),
    ("case-documents", f"{BT_ORG}/{PDG10}/06dedf3a-bb0d-4f57-a2f8-030b1adee2f3/notice-thu-nghiem.pdf"),
]


def request(method, url, data=None, content_type=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("apikey", KEY)
    if content_type:
        req.add_header("Content-Type", content_type)
    if method == "POST" and content_type != "application/json":
        req.add_header("x-upsert", "true")
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def remove(pairs):
    by_bucket = {}
    for bucket, path in pairs:
        by_bucket.setdefault(bucket, []).append(path)
    for bucket, paths in by_bucket.items():
        status, body = request("DELETE", f"{SUPABASE_URL}/storage/v1/object/{bucket}",
                               json.dumps({"prefixes": paths}).encode(), "application/json")
        print(f"xoá {bucket}: {len(paths)} tệp → {status}")
        if status >= 300:
            print(body)


def main():
    teardown = "--teardown" in sys.argv
    items = files()
    if teardown:
        remove([(b, p) for b, p, _, _ in items])
        return
    failed = 0
    for bucket, path, data, ctype in items:
        status, body = request("POST", f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}", data, ctype)
        print(f"{status} {bucket}/{path}")
        if status >= 300:
            failed += 1
            print(body)
    remove(LEGACY)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
