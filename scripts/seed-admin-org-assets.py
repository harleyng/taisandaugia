"""Sinh ảnh/tài liệu placeholder rồi nạp vào Supabase Storage cho tổ chức demo.

Đường dẫn phải KHỚP TUYỆT ĐỐI với migration 20260809000001_seed_admin_org_demo.sql
— bản ghi trong DB trỏ tới đúng các key này.
"""
import io
import os
import sys
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ORG = "ad000001-0000-4000-8000-000000000001"
SUPABASE_URL = "https://dvdpfjprncvkhfwcvqmp.supabase.co"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

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


def scan_png(title, subtitle=""):
    """Ảnh dạng bản quét A4 dọc."""
    w, h = 827, 1169
    img = Image.new("RGB", (w, h), "#F4F4F1")
    d = ImageDraw.Draw(img)
    d.rectangle([28, 28, w - 28, h - 28], outline="#C9C9C2", width=2)
    d.rectangle([28, 28, w - 28, 190], fill="#E8EDE9", outline="#C9C9C2", width=2)
    d.text((60, 66), "CÔNG TY ĐẤU GIÁ HỢP DANH MINH ĐỨC", font=font(24), fill="#1F6F54")
    d.text((60, 108), title, font=font(30), fill="#20242B")
    if subtitle:
        d.text((60, 150), subtitle, font=font(20), fill="#5B6472")
    y = 250
    for i in range(22):
        width = w - 120 if i % 5 != 4 else int((w - 120) * 0.55)
        d.rectangle([60, y, 60 + width, y + 12], fill="#D6D6D0")
        y += 34
    d.text((60, h - 110), "BẢN QUÉT MẪU — DỮ LIỆU DEMO, KHÔNG CÓ GIÁ TRỊ PHÁP LÝ",
           font=font(20), fill="#9A6B00")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


PALETTE = ["#1F6F54", "#2C5F8A", "#7A4B8C", "#8A5A2B", "#3D6E7A", "#8A3B4B", "#4A5A2B"]


def portrait_png(name, idx):
    w, h = 480, 640
    img = Image.new("RGB", (w, h), PALETTE[idx % len(PALETTE)])
    d = ImageDraw.Draw(img)
    # Bóng người đơn giản: đầu + vai
    d.ellipse([w // 2 - 88, 150, w // 2 + 88, 326], fill="#FFFFFF")
    d.ellipse([w // 2 - 165, 360, w // 2 + 165, 700], fill="#FFFFFF")
    initials = "".join(p[0] for p in name.split()[-2:]).upper()
    f = font(64)
    box = d.textbbox((0, 0), initials, font=f)
    d.text(((w - box[2]) / 2, 200), initials, font=f, fill=PALETTE[idx % len(PALETTE)])
    f2 = font(24)
    box2 = d.textbbox((0, 0), name, font=f2)
    d.text(((w - box2[2]) / 2, h - 58), name, font=f2, fill="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def photo_png(label, caption):
    w, h = 1200, 800
    img = Image.new("RGB", (w, h), "#DDE3DF")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 120], fill="#1F6F54")
    d.text((40, 42), "CÔNG TY ĐẤU GIÁ HỢP DANH MINH ĐỨC", font=font(30), fill="#FFFFFF")
    d.rectangle([60, 180, w - 60, h - 140], outline="#9FB2A8", width=4)
    f = font(44)
    box = d.textbbox((0, 0), label, font=f)
    d.text(((w - box[2]) / 2, h / 2 - 60), label, font=f, fill="#20242B")
    f2 = font(26)
    box2 = d.textbbox((0, 0), caption, font=f2)
    d.text(((w - box2[2]) / 2, h / 2 + 10), caption, font=f2, fill="#5B6472")
    d.text((70, h - 100), "ẢNH MINH CHỨNG MẪU — DỮ LIỆU DEMO", font=font(22), fill="#9A6B00")
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def simple_pdf(title):
    """PDF một trang viết tay — đủ chuẩn để trình duyệt mở được."""
    def esc(s):
        return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    # PDF chuẩn chỉ chắc chắn hiển thị ASCII với font base-14, nên bỏ dấu.
    ascii_title = title.encode("ascii", "ignore").decode() or "Demo document"
    content = (
        "BT\n/F1 16 Tf\n60 760 Td\n(%s) Tj\nET\n"
        "BT\n/F1 11 Tf\n60 730 Td\n(CONG TY DAU GIA HOP DANH MINH DUC - TAI LIEU MAU) Tj\nET\n"
        "BT\n/F1 11 Tf\n60 710 Td\n(DU LIEU DEMO, KHONG CO GIA TRI PHAP LY.) Tj\nET\n"
    ) % esc(ascii_title)
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        "<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += ("%d 0 obj\n%s\nendobj\n" % (i, body)).encode("latin-1")
    xref = len(out)
    out += ("xref\n0 %d\n" % (len(objs) + 1)).encode()
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += ("%010d 00000 n \n" % off).encode()
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (len(objs) + 1, xref)).encode()
    return bytes(out)


def upload(bucket, path, data, content_type):
    """Đẩy qua curl chứ không phải urllib: Python ở máy này không có bộ CA nào
    dùng được, còn curl thì dùng trust store của hệ điều hành."""
    url = "%s/storage/v1/object/%s/%s" % (SUPABASE_URL, bucket, path)
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(data)
        tmp = f.name
    try:
        out = subprocess.run(
            ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
             "-X", "POST", url,
             "-H", "Authorization: Bearer " + KEY,
             "-H", "Content-Type: " + content_type,
             "-H", "x-upsert: true",
             "--data-binary", "@" + tmp],
            capture_output=True, text=True, timeout=120)
        code = out.stdout.strip()
        return 200 if code == "200" else "HTTP %s %s" % (code, out.stderr[:200])
    finally:
        os.unlink(tmp)


# ── Danh sách đấu giá viên: id phải khớp migration ───────────────────────────
PEOPLE = [
    ("ad000002-0000-4000-8000-000000000001", "Nguyễn Minh Đức"),
    ("ad000002-0000-4000-8000-000000000002", "Lê Thị Thu Hà"),
    ("ad000002-0000-4000-8000-000000000003", "Trần Quốc Bảo"),
    ("ad000002-0000-4000-8000-000000000004", "Phạm Thanh Tùng"),
    ("ad000002-0000-4000-8000-000000000005", "Ngô Thị Mai Phương"),
    ("ad000002-0000-4000-8000-000000000006", "Bùi Đức Thắng"),
    ("ad000002-0000-4000-8000-000000000007", "Đặng Thị Kim Oanh"),
]

PERSON_DOCS = [
    ("the-dgv.png", "THẺ ĐẤU GIÁ VIÊN"),
    ("cchn.png", "CHỨNG CHỈ HÀNH NGHỀ ĐẤU GIÁ"),
    ("bang-cap.png", "BẰNG TỐT NGHIỆP"),
    ("lltp.png", "PHIẾU LÝ LỊCH TƯ PHÁP SỐ 1"),
    ("hop-dong.png", "HỢP ĐỒNG LAO ĐỘNG"),
    ("bd-2025.png", "CHỨNG NHẬN BỒI DƯỠNG NĂM 2025"),
    ("bd-2026.png", "CHỨNG NHẬN BỒI DƯỠNG NĂM 2026"),
]

INFRA = [
    ("II.1.1", "ad000004-0000-4000-8000-000000000001", "Trụ sở làm việc", "45 Tràng Tiền, Hoàn Kiếm, Hà Nội"),
    ("II.1.2", "ad000004-0000-4000-8000-000000000002", "Địa điểm tiếp người tham gia", "Quầy tiếp nhận hồ sơ tầng 1"),
    ("II.2.1", "ad000004-0000-4000-8000-000000000003", "Camera tại trụ sở", "12 mắt, lưu trữ 90 ngày"),
    ("II.2.2", "ad000004-0000-4000-8000-000000000004", "Camera tại nơi đấu giá", "Hội trường đấu giá tầng 2"),
    ("II.3", "ad000004-0000-4000-8000-000000000005", "Trang thông tin điện tử", "minhduc-auction.vn"),
    ("II.4", "ad000004-0000-4000-8000-000000000006", "Trang đấu giá trực tuyến", "daugia.minhduc-auction.vn"),
    ("II.5", "ad000004-0000-4000-8000-000000000007", "Kho lưu trữ hồ sơ", "Tầng 3 — 65 m², lưu trữ hỗn hợp"),
]

CABINET = [
    ("ad000005-0000-4000-8000-000000000001", "pdf", "Giay chung nhan dang ky doanh nghiep"),
    ("ad000005-0000-4000-8000-000000000002", "pdf", "Quyet dinh thanh lap 412/QD-STP"),
    ("ad000005-0000-4000-8000-000000000003", "pdf", "Quyet dinh 187/QD-BTP"),
    ("ad000005-0000-4000-8000-000000000004", "pdf", "Dieu le cong ty"),
    ("ad000005-0000-4000-8000-000000000005", "pdf", "Hop dong bao hiem trach nhiem nghe nghiep"),
    ("ad000005-0000-4000-8000-000000000006", "pdf", "To khai quyet toan thue TNDN 2025"),
    ("ad000005-0000-4000-8000-000000000007", "pdf", "To khai quyet toan thue TNDN 2024"),
    ("ad000005-0000-4000-8000-000000000008", "xlsx", "Bao cao tai chinh 2025"),
]

EXPORTS = [
    ("ho-so-nguyen-minh-duc.pdf", "Ho so nang luc dau gia vien - Nguyen Minh Duc"),
    ("ho-so-le-thi-thu-ha.docx", "Ho so nang luc dau gia vien - Le Thi Thu Ha"),
    ("ho-so-tran-quoc-bao.pdf", "Ho so nang luc dau gia vien - Tran Quoc Bao"),
]

failures = []


def do(bucket, path, data, ctype):
    res = upload(bucket, path, data, ctype)
    if res != 200:
        failures.append((bucket, path, res))
    print("%-22s %-90s %s" % (bucket, path, res))


for idx, (pid, name) in enumerate(PEOPLE):
    for fname, title in PERSON_DOCS:
        do("personnel-docs", "%s/%s/%s" % (ORG, pid, fname),
           scan_png(title, name), "image/png")
    do("personnel-portraits", "%s/%s/portrait.png" % (ORG, pid),
       portrait_png(name, idx), "image/png")

for section_id, photo_id, label, caption in INFRA:
    do("org-documents", "%s/infrastructure/%s/%s.png" % (ORG, section_id, photo_id),
       photo_png(label, caption), "image/png")

for doc_id, ext, title in CABINET:
    do("org-documents", "%s/tu-tai-lieu/%s.%s" % (ORG, doc_id, ext),
       simple_pdf(title), "application/pdf")

for fname, title in EXPORTS:
    do("personnel-exports", "%s/exports/%s" % (ORG, fname),
       simple_pdf(title),
       "application/pdf" if fname.endswith(".pdf")
       else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

print("\n%d lỗi" % len(failures))
for f in failures:
    print(f)
sys.exit(1 if failures else 0)
