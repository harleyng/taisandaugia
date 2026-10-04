"""Một hồ sơ số hoá ĐẦY ĐỦ DỮ LIỆU trong Trạm "ngân hàng" (4ca4be7b) của secsosoo@gmail.com.

Shophouse 2 tầng phố cổ TP. Nam Định — tài sản bảo đảm BIDV xử lý — đi hết các khối của màn
/chu-tai-san/dang-tai-san/:id:

  • Thông tin chung + 5 trường riêng của Shophouse, chi nhánh BIDV – CN Hà Nội
  • 5 ảnh (3 ảnh thật Wikimedia Commons CC BY-SA 4.0, ghi công trong mô tả + 2 mặt bằng tự vẽ),
    1 video giới thiệu (ghép từ ảnh), 2 giấy tờ sở hữu + 3 tài liệu đính kèm (PDF minh hoạ)
  • Pháp lý tự khai đủ 3 câu, nhu cầu đấu giá (giá tự đặt, hình thức cả hai, hoa hồng chấp nhận)
  • Sàn đã duyệt
  • Hồ sơ dịch vụ: thẩm định giá "Đã có đối tác" kèm chứng thư còn hiệu lực, pháp lý + tổ chức
    đấu giá "Tìm qua sàn" ⇒ điểm tin cậy 100/100, mức Hoàn chỉnh
  • Mô hình 3D (GLB tự dựng: mặt tiền dán ảnh thật) đã công khai
  • VR tour Silver Sea: yêu cầu → báo giá → thanh toán → hẹn chụp → giao → gắn (ảnh 360° MINH HOẠ)
  • Tư vấn pháp lý: hoàn tất, checklist 9 mục (1 mục cần làm rõ)
  • Tư vấn đấu giá: hoàn tất, phương án đã được người bán chấp nhận
  • Gửi 3 tổ chức → 3 báo giá → chốt Bảo Tín ⇒ hợp đồng dịch vụ đang chờ tổ chức soạn
  • 1 link chia sẻ hồ sơ online có lượt xem

Mọi ghi chép đi qua RLS/trigger/RPC thật bằng cách đổi `request.jwt.claims` sang từng người
(chủ, admin, tài khoản tổ chức) trong MỘT giao dịch. Mọi id có tiền tố fa11….

Địa chỉ trong hồ sơ là MINH HOẠ (không số nhà); ảnh chụp một dãy phố có thật nên mô tả ghi rõ
"ảnh minh hoạ". Thẩm định viên / giấy tờ là dữ liệu demo, có đóng dấu "BẢN MINH HOẠ".

    python3 scripts/seed-full-posting.py              # seed (dừng nếu đã seed)
    python3 scripts/seed-full-posting.py --dry-run    # sinh + tải tệp, chạy hết SQL rồi ROLLBACK
    python3 scripts/seed-full-posting.py --teardown   # gỡ sạch dữ liệu + tệp

Cần PIL; video cần ffmpeg (trên PATH hoặc gói imageio-ffmpeg) — thiếu thì bỏ qua video.
Đọc SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_URI từ .env.local.
"""
import io
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parent.parent
REF = "vewtnkewyawmkpeymdot"
SUPABASE_URL = f"https://{REF}.supabase.co"
POOLER = "aws-0-ap-southeast-1.pooler.supabase.com"
UA = "taisandaugia-seed/1.0 (harleyngx@gmail.com)"


def load_env():
    env = {}
    for line in (REPO / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
KEY = ENV["SUPABASE_SERVICE_ROLE_KEY"]
DB = urllib.parse.urlparse(ENV["SUPABASE_DB_URI"])

# ─── Định danh cố định ─────────────────────────────────────────────────────────
OWNER = "ae9bfef5-2694-466f-a97e-5efdf138ac43"       # secsosoo@gmail.com — Nguyễn Hoàng Long
ADMIN = "95d7e29c-f1f5-4361-a3af-e9aeaf792f3f"       # harleyngx — admin sàn + Chủ sở hữu Bảo Tín, Minh Khang
ADMIN_MD = "994e3bd8-800e-4d9e-b680-fb61304ca33e"    # admin@gmail.com — Chủ sở hữu Minh Đức
W = "4ca4be7b-34df-4cdd-b0b5-368d0cb78ae3"           # Trạm "ngân hàng" (trụ sở BIDV)
BRANCH = "aa1ecdbe-5644-448e-85e0-8c57f586f257"      # BIDV – Chi nhánh Hà Nội
HQ_ADDRESS = "Tháp BIDV, 194 Trần Quang Khải, phường Lý Thái Tổ, quận Hoàn Kiếm"   # trụ sở BIDV (công khai)
SILVER_SEA = "5115ea00-0000-4000-8000-000000000001"  # đối tác VR tour
TVPL_PARTNER = "7e9a0000-0000-4000-8000-000000000001"
TVDG_PARTNER = "8f2b0000-0000-4000-8000-000000000001"
ORG_BAO_TIN = "a2222222-2222-2222-2222-222222222222"
ORG_MINH_KHANG = "a0d90002-0000-4000-8000-000000000002"
ORG_MINH_DUC = "db4df616-759a-4d2b-88fd-8e9f8f502e20"


def fid(group, n):
    return f"fa11{group}-0000-4000-8000-{n:012d}"


POSTING = fid("0001", 1)

FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# ─── Nội dung hồ sơ ───────────────────────────────────────────────────────────
COMMONS_PHOTOS = [   # (tệp Commons, chú thích) — cùng 1 căn chụp 2 góc + dãy phố cùng khu
    ("140 Hàng Tiện, thành phố Nam Định, tỉnh Nam Định.jpg", "Mặt tiền"),
    ("140 Hàng Tiện, thành phố Nam Định, tỉnh Nam Định (2).jpg", "Mặt tiền — góc chéo"),
    ("Dãy nhà cũ phong cách Pháp ở phố Bến Ngự, thành phố Nam Định, tỉnh Nam Định.jpg", "Dãy phố cùng khu"),
]
TITLE = "Shophouse 2 tầng kiến trúc Pháp 86,5 m² – phố cổ TP. Nam Định"
DESCRIPTION = """Tài sản bảo đảm của khoản vay doanh nghiệp đã chuyển nợ xấu; BIDV – Chi nhánh Hà Nội đã thu giữ và bàn giao nguyên trạng ngày 12/09/2026, nay xử lý bằng hình thức đấu giá theo hợp đồng thế chấp.

Nhà mặt phố 2 tầng xây khoảng thập niên 1930, kiến trúc Pháp: mặt tiền 3 vòm, ban công tầng 2 lan can sắt, trần cao 4,2 m. Tầng 1 đang để trống (trước đây kinh doanh vải), tầng 2 gồm 2 phòng và 1 gác lửng phía sau. Kết cấu tường gạch chịu lực, sàn bê tông đã gia cố năm 2012; mái ngói phía sau cần chống thấm.

Vị trí lõi phố cổ, cách Chợ Rồng ~400 m, vỉa hè rộng đỗ xe máy; phù hợp cửa hàng, cà phê, homestay. Xem nhà theo lịch hẹn với cán bộ xử lý nợ.

Ảnh 1–3 là ẢNH MINH HOẠ dãy phố Pháp cổ tại TP. Nam Định (Wikimedia Commons, CC BY-SA 4.0); ảnh 4–5 là mặt bằng hiện trạng do ngân hàng đo vẽ."""
ADDRESS = "Phố cổ khu Chợ Rồng (địa chỉ minh hoạ)"
DELTA = {"land_area": 86.5, "floor_area": 164, "floors": 2,
         "business_type": "Cửa hàng, cà phê, homestay phố cổ", "legal_book": "so-do"}
LEGAL_NOTES = ("Tài sản đang thế chấp tại chính BIDV (HĐTC số 0217/2021/HĐTC-BIDV.HN, đã đăng ký giao dịch "
               "bảo đảm). Bên thế chấp đã ký văn bản đồng ý xử lý; ngân hàng giải chấp ngay khi người trúng "
               "đấu giá nộp đủ tiền.")
STARTING_PRICE = 8_650_000_000
APPRAISED = 8_900_000_000
ORG_MESSAGE = """Kính gửi Quý Công ty,

BIDV – Chi nhánh Hà Nội đề nghị báo giá dịch vụ đấu giá tài sản bảo đảm sau:
• Tài sản: Shophouse 2 tầng kiến trúc Pháp, đất 86,5 m², sàn 164 m², sổ đỏ — phố cổ TP. Nam Định
• Giá khởi điểm dự kiến: 8,650,000,000 ₫ (chứng thư thẩm định 8,900,000,000 ₫, còn hiệu lực tới 03/2027)
• Hình thức: trực tiếp hoặc trực tuyến; mong muốn mở phiên trong vòng 45 ngày
• Phí chấp nhận: hoa hồng tối đa 1.5% giá trúng

Hồ sơ đầy đủ (giấy tờ, ý kiến pháp lý của sàn, mô hình 3D, VR tour) có trên Sàn Tài sản đấu giá.
Trân trọng."""

QUOTES = [  # (auction_org_id, user trả lời, báo giá)
    (ORG_BAO_TIN, ADMIN, {
        "commission_pct": 1.2, "starting_price": STARTING_PRICE, "valid_until": "2026-10-25",
        "note": "Đấu giá viên có kinh nghiệm nhà phố cổ Nam Định; niêm yết tại chỗ + phường trong 15 ngày.",
        "fee_items": [
            {"key": "phi_ho_so", "label": "Phí lập hồ sơ", "amount": 5_000_000, "optional": False},
            {"key": "phi_niem_yet", "label": "Phí niêm yết & thông báo", "amount": 6_000_000, "optional": False},
            {"key": "phi_to_chuc", "label": "Phí tổ chức phiên", "amount": 15_000_000, "optional": False},
            {"key": "khac", "label": "Quay phim phiên đấu giá", "amount": 3_000_000, "optional": True}],
        "plan": {"venue": "Hội trường UBND phường + trực tuyến trên website Bảo Tín", "auction_format": "ca_hai",
                 "price_step": 50_000_000, "deposit_mode": "percent", "deposit_value": 15,
                 "channels": ["cong_tsdg", "bao_in", "website_tc", "san_tsdg"], "channels_other": None,
                 "milestones": {"niem_yet": 3, "ban_ho_so": 10, "mo_phien": 32},
                 "scope_included": ["ho_so", "niem_yet", "dau_gia_vien", "thu_tuc"],
                 "scope_excluded": ["van_chuyen", "tham_dinh_gia"]}}),
    (ORG_MINH_KHANG, ADMIN, {
        "commission_pct": 1.5, "starting_price": STARTING_PRICE, "valid_until": "2026-10-20",
        "note": "Phiên trực tiếp tại trụ sở Hà Nội, hỗ trợ khách xem nhà cuối tuần.",
        "fee_items": [
            {"key": "phi_ho_so", "label": "Phí lập hồ sơ", "amount": 4_000_000, "optional": False},
            {"key": "phi_niem_yet", "label": "Phí niêm yết & thông báo", "amount": 5_000_000, "optional": False},
            {"key": "phi_to_chuc", "label": "Phí tổ chức phiên", "amount": 12_000_000, "optional": False}],
        "plan": {"venue": "Trụ sở Công ty Đấu giá Hợp danh Minh Khang, Hà Nội", "auction_format": "truc_tiep",
                 "price_step": 100_000_000, "deposit_mode": "percent", "deposit_value": 10,
                 "channels": ["cong_tsdg", "website_tc", "mxh"], "channels_other": None,
                 "milestones": {"niem_yet": 5, "ban_ho_so": 12, "mo_phien": 38},
                 "scope_included": ["ho_so", "niem_yet", "dau_gia_vien", "thu_tuc"],
                 "scope_excluded": ["van_chuyen", "tham_dinh_gia"]}}),
    (ORG_MINH_DUC, ADMIN_MD, {
        "commission_pct": 1.0, "starting_price": 8_500_000_000, "valid_until": "2026-10-18",
        "note": "Đề xuất giảm giá khởi điểm 1.7% để rút ngắn thời gian bán; phiên trực tuyến 100%.",
        "fee_items": [
            {"key": "phi_ho_so", "label": "Phí lập hồ sơ", "amount": 6_000_000, "optional": False},
            {"key": "phi_niem_yet", "label": "Phí niêm yết & thông báo", "amount": 8_000_000, "optional": False},
            {"key": "phi_to_chuc", "label": "Phí tổ chức phiên", "amount": 18_000_000, "optional": False}],
        "plan": {"venue": "Trực tuyến tại website đấu giá Minh Đức", "auction_format": "truc_tuyen",
                 "price_step": 50_000_000, "deposit_mode": "percent", "deposit_value": 20,
                 "channels": ["cong_tsdg", "website_tc", "mxh", "san_tsdg"], "channels_other": None,
                 "milestones": {"niem_yet": 2, "ban_ho_so": 7, "mo_phien": 25},
                 "scope_included": ["ho_so", "niem_yet", "dau_gia_vien", "thu_tuc", "van_chuyen"],
                 "scope_excluded": ["tham_dinh_gia"]}}),
]

LEGAL_ITEMS = [  # mẫu checklist "bat-dong-san" (src/lib/legalConsult/checklistTemplates.ts)
    ("land_certificate", "Giấy chứng nhận QSDĐ / quyền sở hữu nhà (sổ đỏ / sổ hồng)", "sufficient",
     "Bản gốc GCN do ngân hàng giữ; thông tin thửa 112, tờ bản đồ 23 khớp trích lục địa chính.", None, ["own1"]),
    ("owner_identity", "Giấy tờ nhân thân / pháp nhân của chủ sở hữu (CCCD, ĐKKD)", "sufficient",
     "Đối chiếu CCCD bên thế chấp trong hồ sơ tín dụng.", None, []),
    ("co_owner_consent", "Văn bản đồng ý của đồng sở hữu / vợ chồng", "sufficient",
     "HĐTC có chữ ký của cả hai vợ chồng bên thế chấp, công chứng năm 2021.", None, ["own2"]),
    ("mortgage_release", "Xác nhận không thế chấp hoặc đã giải chấp", "needs_clarification",
     "Tài sản đang thế chấp tại chính BIDV — người bán là bên nhận thế chấp.",
     "Ngân hàng phát hành văn bản cam kết giải chấp ngay khi người trúng đấu giá nộp đủ tiền.", ["own2"]),
    ("construction_permit", "Giấy phép xây dựng / hoàn công (nếu có công trình)", "sufficient",
     "Công trình xây trước 1975, đã được công nhận trên GCN — không yêu cầu giấy phép.", None, ["own1"]),
    ("planning_info", "Thông tin quy hoạch, không thuộc diện thu hồi", "sufficient",
     "Phiếu cung cấp thông tin quy hoạch: đất ở đô thị, không nằm trong chỉ giới mở đường.", None, ["doc3"]),
    ("land_tax", "Chứng từ hoàn thành nghĩa vụ tài chính về đất", "sufficient",
     "Đã nộp thuế sử dụng đất phi nông nghiệp đến hết năm 2025.", None, []),
    ("no_dispute", "Tài sản không tranh chấp, không bị kê biên / hạn chế giao dịch", "sufficient",
     "Biên bản bàn giao tài sản bảo đảm không ghi nhận tranh chấp; không có quyết định kê biên.", None, ["doc1"]),
    ("authorization", "Văn bản uỷ quyền bán (nếu người bán không phải chủ sở hữu)", "sufficient",
     "Quyền xử lý TSBĐ phát sinh từ Điều 9 HĐTC — không cần uỷ quyền riêng.", None, ["own2"]),
]
LEGAL_SUMMARY = ("Hồ sơ pháp lý đủ điều kiện đưa ra đấu giá. Một điểm cần làm rõ: ngân hàng cần phát hành văn "
                 "bản cam kết giải chấp ngay khi người trúng đấu giá nộp đủ tiền, đính kèm hồ sơ mời đấu giá.")

TVDG_PROPOSAL = {
    "auction_format": "ca_hai", "bidding_method": "ascending", "starting_price": STARTING_PRICE,
    "reserve_price": 8_900_000_000, "bid_step": 50_000_000, "lot_duration_minutes": 60,
    "deposit_mode": "percent", "deposit_value": 15,
    "field_notes": {
        "starting_price": "Bằng 97% giá thẩm định — mức các phiên nhà phố Nam Định 2025 thường bán được ngay lần 1.",
        "bid_step": "~0.6% giá khởi điểm, đủ nhỏ để giữ người trả giá ở vòng cuối.",
        "deposit": "15% lọc khách nghiêm túc mà không chặn nhà đầu tư cá nhân.",
    },
}
TVDG_RATIONALE = ("Shophouse phố cổ có ít hàng cùng loại, cầu chủ yếu là người kinh doanh địa phương và nhà đầu "
                  "tư Hà Nội. Kết hợp trực tiếp + trực tuyến để mở rộng người tham gia; giá khởi điểm sát giá "
                  "thẩm định giúp bán trong lần 1 mà vẫn dưới mặt bằng rao bán quanh khu Chợ Rồng.")


# ─── HTTP / psql ──────────────────────────────────────────────────────────────
def api(method, path, body=None, *, raw=None, ctype="application/json", extra=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(SUPABASE_URL + path, data=data, method=method)
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("apikey", KEY)
    if data is not None:
        req.add_header("Content-Type", ctype)
    for k, v in (extra or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            txt = res.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:400]}") from None


def psql(sql, *, rows=False):
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(sql)
        path = f.name
    env = {**os.environ, "PGPASSWORD": urllib.parse.unquote(DB.password or "")}
    conn = f"host={POOLER} port=5432 user=postgres.{REF} dbname=postgres sslmode=require connect_timeout=15"
    cmd = ["psql", conn, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path]
    if rows:
        cmd[3:3] = ["-A", "-t"]
    try:
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
    finally:
        os.unlink(path)
    if r.returncode != 0:
        sys.exit(f"psql lỗi:\n{r.stdout[-3000:]}\n{r.stderr}")
    return [ln for ln in r.stdout.splitlines() if ln.strip()] if rows else r.stdout


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def arr(xs):
    return "array[" + ", ".join(lit(x) for x in xs) + "]::text[]"


def as_user(uid):
    return f"select set_config('request.jwt.claims', {lit(json.dumps({'sub': uid, 'role': 'authenticated'}))}, true);"


AS_SYSTEM = "select set_config('request.jwt.claims', '', true);"
AS_ANON = "select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true);"


def public_url(bucket, path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


# ─── Tệp: đường dẫn trong storage ─────────────────────────────────────────────
PHOTO_PATHS = [f"{OWNER}/{fid('000d', k)}.jpg" for k in range(1, 6)]           # asset-media
VIDEO_PATH = f"{OWNER}/video/{fid('000d', 11)}.mp4"                              # asset-media
PANO_PATH = f"{OWNER}/vr/{fid('000d', 21)}-360.jpg"                              # asset-media
OWN_PATHS = {"own1": f"{OWNER}/ownership/{fid('000e', 1)}.pdf",                  # asset-docs
             "own2": f"{OWNER}/ownership/{fid('000e', 2)}.pdf"}
DOC_PATHS = {"doc1": f"{OWNER}/docs/{fid('000e', 11)}.pdf",
             "doc2": f"{OWNER}/docs/{fid('000e', 12)}.pdf",
             "doc3": f"{OWNER}/docs/{fid('000e', 13)}.pdf"}
EVIDENCE_PATH = f"{POSTING}/appraisal/{fid('000e', 21)}.pdf"                     # posting-dossier-evidence
MODEL_PATH = f"{POSTING}/{fid('000f', 1)}.glb"                                    # asset-3d
POSTER_PATH = f"{POSTING}/{fid('000f', 1)}.jpg"
PANO_SRC = ("https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Mapillary_%281000378727852112%2C_"
            "Yh9tzqFokRmQsaAUdPGJT0%29_%28bemaps_hn_kien%29_2023-09-19_11H09M10S962.jpg/3840px-Mapillary_"
            "%281000378727852112%2C_Yh9tzqFokRmQsaAUdPGJT0%29_%28bemaps_hn_kien%29_2023-09-19_11H09M10S962.jpg")


def vr_url():
    frag = urllib.parse.urlencode({
        "panorama": public_url("asset-media", PANO_PATH),
        "autoLoad": "true",
        "title": "Khu phố cổ — ảnh 360° minh hoạ",
        "author": "Wikimedia Commons · CC BY-SA 4.0",
    }, quote_via=urllib.parse.quote)
    return f"https://cdn.pannellum.org/2.5/pannellum.htm#{frag}"


# ─── Sinh tệp ─────────────────────────────────────────────────────────────────
def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def fetch(url):
    for wait in (0, 5, 15, 30, 60):
        time.sleep(wait or 1)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    sys.exit(f"Wikimedia vẫn trả 429: {url}")


def commons_photos():
    """[(PIL.Image, tác giả, giấy phép)] — bản 1600 px đọc thẳng từ Commons để ghi công đúng."""
    titles = "|".join("File:" + f for f, _ in COMMONS_PHOTOS)
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1600, "titles": titles})
    d = json.loads(fetch(f"https://commons.wikimedia.org/w/api.php?{q}"))
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    meta = {}
    for p in d["query"]["pages"].values():
        ii = p["imageinfo"][0]
        m = ii.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip() or "không rõ tác giả"
        meta[norm.get(p["title"], p["title"])[5:]] = (ii["thumburl"], artist[:80],
                                                      m.get("LicenseShortName", {}).get("value", "CC BY-SA 4.0"))
    out = []
    for f, _ in COMMONS_PHOTOS:
        url, artist, lic = meta[f]
        out.append((Image.open(io.BytesIO(fetch(url))).convert("RGB"), artist, lic))
    return out


def jpeg(im, q=85):
    b = io.BytesIO()
    im.save(b, "JPEG", quality=q, optimize=True, progressive=True)
    return b.getvalue()


def floor_plan(level):
    """Mặt bằng hiện trạng 1600×1200 — nét kỹ thuật đơn giản, kích thước theo GCN (4,6 × 18,8 m)."""
    W_, H_ = 1600, 1200
    im = Image.new("RGB", (W_, H_), "#fbfaf6")
    d = ImageDraw.Draw(im)
    for x in range(0, W_, 40):
        d.line([(x, 0), (x, H_)], fill="#efede4")
    for y in range(0, H_, 40):
        d.line([(0, y), (W_, y)], fill="#efede4")
    s = 70                                   # px / m — nhà nằm ngang: chiều sâu 18,8 m theo trục x
    x0, y0 = 220, 420
    depth, width = 18.8, 4.6
    X = lambda m: x0 + m * s
    Y = lambda m: y0 + m * s
    wall = "#2d3a33"
    d.rectangle([X(0), Y(0), X(depth), Y(width)], outline=wall, width=10)
    rooms = ({1: [(0, 6.2, "Gian bán hàng 26 m²"), (6.2, 11.4, "Sảnh + cầu thang"), (11.4, 15.6, "Bếp 17 m²"),
                  (15.6, 18.8, "WC · sân phơi")],
              2: [(0, 6.2, "Phòng 1 + ban công"), (6.2, 11.4, "Phòng 2 · 22 m²"), (11.4, 15.6, "Gác lửng 16 m²"),
                  (15.6, 18.8, "Sân thượng")]})[level]
    f_room, f_dim = font(26), font(24)
    for a, b, name in rooms:
        if a > 0:
            d.line([(X(a), Y(0)), (X(a), Y(width))], fill=wall, width=6)
            d.rectangle([X(a) - 3, Y(1.6), X(a) + 3, Y(2.8)], fill="#fbfaf6")   # cửa thông phòng
        cx = (X(a) + X(b)) / 2
        d.text((cx, Y(width / 2)), name, font=f_room, fill="#1f2a24", anchor="mm")
    # cửa chính / ban công phía mặt phố (x = 0)
    d.rectangle([X(0) - 6, Y(1.1), X(0) + 6, Y(3.5)], fill="#fbfaf6")
    d.line([(X(0), Y(1.1)), (X(0) - 60, Y(1.1) + 60)], fill="#8a6d3b", width=4)
    # thang
    for i in range(10):
        d.line([(X(7.0 + i * 0.32), Y(3.2)), (X(7.0 + i * 0.32), Y(4.4))], fill="#7c8a83", width=3)
    # kích thước
    d.line([(X(0), Y(width) + 70), (X(depth), Y(width) + 70)], fill="#a33", width=3)
    d.text(((X(0) + X(depth)) / 2, Y(width) + 98), "18,80 m", font=f_dim, fill="#a33", anchor="mm")
    d.line([(X(0) - 70, Y(0)), (X(0) - 70, Y(width))], fill="#a33", width=3)
    d.text((X(0) - 84, Y(width / 2)), "4,60 m", font=f_dim, fill="#a33", anchor="rm")
    d.text((X(-0.9), Y(-1.3)), "← MẶT PHỐ", font=font(28, True), fill="#8a6d3b")
    d.text((70, 60), f"MẶT BẰNG HIỆN TRẠNG — TẦNG {level}", font=font(52, True), fill="#1f2a24")
    d.text((70, 130), ("Diện tích sàn 82,0 m² · trần cao 4,2 m" if level == 1
                       else "Diện tích sàn 82,0 m² · ban công 3 vòm hướng Nam"), font=font(32), fill="#4b5a52")
    d.text((70, H_ - 90), "BIDV – Chi nhánh Hà Nội đo vẽ 15/09/2026 · bản vẽ minh hoạ, không dùng thay hồ sơ "
                          "kỹ thuật thửa đất", font=font(24), fill="#7c8a83")
    return im


A4 = (1240, 1754)


def stamp(im):
    """Dấu nước chéo trang "BẢN MINH HOẠ"."""
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((im.width / 2, im.height / 2), "BẢN MINH HOẠ — DỮ LIỆU DEMO", font=font(60, True),
           fill=(200, 40, 40, 46), anchor="mm")
    layer = layer.rotate(32, resample=Image.BICUBIC, center=(im.width / 2, im.height / 2))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def page(heading, sub, lines, *, extra=None):
    im = Image.new("RGB", A4, "white")
    d = ImageDraw.Draw(im)
    d.text((A4[0] / 2, 110), "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", font=font(30, True), fill="black", anchor="mm")
    d.text((A4[0] / 2, 152), "Độc lập – Tự do – Hạnh phúc", font=font(28), fill="black", anchor="mm")
    d.line([(A4[0] / 2 - 160, 178), (A4[0] / 2 + 160, 178)], fill="black", width=2)
    d.text((A4[0] / 2, 270), heading, font=font(38, True), fill="black", anchor="mm")
    if sub:
        d.text((A4[0] / 2, 322), sub, font=font(26), fill="#333", anchor="mm")
    y = 400
    for ln in lines:
        if ln == "":
            y += 22
            continue
        bold = ln.startswith("# ")
        txt = ln[2:] if bold else ln
        # xuống dòng thủ công theo bề rộng trang
        words, cur = txt.split(" "), ""
        f = font(27, bold)
        for w_ in words:
            trial = (cur + " " + w_).strip()
            if d.textlength(trial, font=f) > A4[0] - 220:
                d.text((110, y), cur, font=f, fill="black")
                y += 42
                cur = w_
            else:
                cur = trial
        d.text((110, y), cur, font=f, fill="black")
        y += 44
    if extra:
        extra(d, y)
    return stamp(im)


def pdf(pages):
    b = io.BytesIO()
    pages[0].save(b, "PDF", resolution=150, save_all=True, append_images=pages[1:])
    return b.getvalue()


def lot_sketch(d, y):
    x0, s = 300, 34
    d.rectangle([x0, y + 40, x0 + 18.8 * s, y + 40 + 4.6 * s], outline="black", width=4)
    d.text((x0 + 18.8 * s / 2, y + 40 + 4.6 * s / 2), "Thửa 112 · 86,5 m²", font=font(26, True),
           fill="black", anchor="mm")
    d.text((x0 - 20, y + 40 + 4.6 * s / 2), "Mặt phố", font=font(22), fill="black", anchor="rm")
    d.text((x0 + 18.8 * s / 2, y + 40 + 4.6 * s + 30), "18,80 m", font=font(22), fill="black", anchor="mm")


def documents():
    own1 = pdf([
        page("GIẤY CHỨNG NHẬN", "Quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất", [
            "Số phát hành: DM 000000 (demo) · Số vào sổ cấp GCN: CS 00000",
            "",
            "# I. Người sử dụng đất, chủ sở hữu nhà ở",
            "Ông/bà: [đã ẩn — bên thế chấp] · CCCD: [đã ẩn]",
            "",
            "# II. Thửa đất, nhà ở và tài sản khác gắn liền với đất",
            "1. Thửa đất số: 112 · Tờ bản đồ số: 23",
            "   Địa chỉ: khu phố cổ Chợ Rồng, TP. Nam Định, tỉnh Nam Định",
            "   Diện tích: 86,5 m² (Tám mươi sáu phẩy năm mét vuông) · Hình thức sử dụng: riêng",
            "   Mục đích sử dụng: Đất ở tại đô thị · Thời hạn sử dụng: Lâu dài",
            "   Nguồn gốc sử dụng: Công nhận QSDĐ như giao đất có thu tiền sử dụng đất",
            "2. Nhà ở: Nhà ở riêng lẻ · Diện tích xây dựng: 82,0 m² · Diện tích sàn: 164,0 m²",
            "   Kết cấu: tường gạch chịu lực, sàn bê tông · Số tầng: 2 · Năm hoàn thành: trước 1975",
            "",
            "Nam Định, ngày 14 tháng 3 năm 2016",
            "TM. ỦY BAN NHÂN DÂN (bản minh hoạ — không có giá trị pháp lý)",
        ]),
        page("SƠ ĐỒ THỬA ĐẤT", "Những thay đổi sau khi cấp Giấy chứng nhận", [
            "# III. Sơ đồ thửa đất, nhà ở và tài sản khác gắn liền với đất",
            "", "", "", "", "", "",
            "# IV. Những thay đổi sau khi cấp Giấy chứng nhận",
            "05/04/2021 — Thế chấp bằng QSDĐ và tài sản gắn liền với đất tại Ngân hàng TMCP Đầu tư và",
            "Phát triển Việt Nam (BIDV) – Chi nhánh Hà Nội theo HĐTC số 0217/2021/HĐTC-BIDV.HN.",
            "Đăng ký thế chấp ngày 06/04/2021 tại Văn phòng đăng ký đất đai tỉnh Nam Định.",
        ], extra=lambda d, y: lot_sketch(d, 470)),
    ])
    own2 = pdf([page("HỢP ĐỒNG THẾ CHẤP", "Số 0217/2021/HĐTC-BIDV.HN · trích các điều khoản xử lý tài sản", [
        "Bên nhận thế chấp: BIDV – Chi nhánh Hà Nội",
        "Bên thế chấp: [đã ẩn] cùng vợ/chồng — cùng ký, công chứng ngày 05/04/2021",
        "Tài sản thế chấp: QSDĐ thửa 112, tờ bản đồ 23 và nhà ở 2 tầng gắn liền với đất",
        "",
        "# Điều 9. Xử lý tài sản thế chấp",
        "9.1. Khi bên vay không trả được nợ đến hạn, bên nhận thế chấp có quyền thu giữ và xử lý tài",
        "sản thế chấp, bao gồm bán đấu giá thông qua tổ chức hành nghề đấu giá tài sản.",
        "9.2. Bên thế chấp có nghĩa vụ bàn giao tài sản và phối hợp thực hiện thủ tục chuyển nhượng",
        "cho người mua trúng đấu giá.",
        "9.3. Số tiền thu được ưu tiên thanh toán nghĩa vụ được bảo đảm; phần còn thừa trả bên thế chấp.",
        "",
        "# Đăng ký thế chấp",
        "Văn phòng đăng ký đất đai tỉnh Nam Định xác nhận đăng ký ngày 06/04/2021.",
    ])])
    doc1 = pdf([page("BIÊN BẢN BÀN GIAO TÀI SẢN BẢO ĐẢM", "Ngày 12/09/2026", [
        "Thành phần: đại diện BIDV – Chi nhánh Hà Nội; bên thế chấp; đại diện UBND phường; công an khu vực.",
        "",
        "# Tình trạng tài sản khi bàn giao",
        "• Nhà 2 tầng, tầng 1 để trống, không còn hàng hoá; tầng 2 còn 1 tủ gỗ cũ (bên thế chấp xin để lại).",
        "• Điện, nước đã tạm ngắt; công tơ điện số 0000 (demo) chỉ số 18.432 kWh.",
        "• Mái ngói phía sau thấm dột nhẹ ở gác lửng; tường mặt tiền bong vữa cục bộ.",
        "• Chìa khoá: 3 chùm (cửa chính, cửa sau, cửa ban công) — ngân hàng giữ.",
        "",
        "# Xác nhận",
        "Không có tranh chấp, không có người đang cư trú; các bên thống nhất nội dung biên bản.",
    ])])
    doc2 = pdf([stamp(_plan_page())])
    doc3 = pdf([page("PHIẾU CUNG CẤP THÔNG TIN QUY HOẠCH", "Thửa 112 · tờ bản đồ 23 · TP. Nam Định", [
        "Chức năng sử dụng đất theo quy hoạch chung: Đất ở đô thị hiện trạng cải tạo — khu phố cổ.",
        "Chỉ giới đường đỏ: trùng ranh giới thửa đất phía mặt phố; không bị thu hồi để mở đường.",
        "Tầng cao tối đa: 4 tầng · Mật độ xây dựng tối đa: 90% · Giữ nguyên hình thức mặt tiền",
        "theo quy chế quản lý kiến trúc khu phố cổ.",
        "",
        "Thửa đất không nằm trong danh mục dự án thu hồi đất đã được phê duyệt.",
    ])])
    evidence = pdf([page("CHỨNG THƯ THẨM ĐỊNH GIÁ", "Số 2609/2026/CT-SH · ngày 20/09/2026", [
        "Đơn vị thẩm định: Công ty CP Thẩm định giá Sông Hồng (demo)",
        "Khách hàng: BIDV – Chi nhánh Hà Nội · Mục đích: xác định giá khởi điểm đấu giá TSBĐ",
        "",
        "# Tài sản thẩm định",
        "QSDĐ 86,5 m² thửa 112, tờ bản đồ 23 và nhà ở 2 tầng (sàn 164 m²), khu phố cổ TP. Nam Định.",
        "",
        "# Phương pháp",
        "So sánh (6 giao dịch nhà mặt phố khu Chợ Rồng 2025–2026) kết hợp chi phí cho công trình.",
        "",
        "# Kết quả thẩm định",
        "Giá trị tài sản: 8,900,000,000 đồng (Tám tỷ chín trăm triệu đồng)",
        "Trong đó: QSDĐ 8,610,000,000 đồng · công trình 290,000,000 đồng",
        "",
        "Chứng thư có hiệu lực 6 tháng kể từ ngày phát hành (đến 20/03/2027).",
        "Thẩm định viên: [demo] · Thẻ thẩm định viên số [demo]",
    ])])
    return {"own1": own1, "own2": own2, "doc1": doc1, "doc2": doc2, "doc3": doc3, "evidence": evidence}


def _plan_page():
    im = Image.new("RGB", A4, "white")
    d = ImageDraw.Draw(im)
    d.text((A4[0] / 2, 110), "BẢN VẼ HIỆN TRẠNG NHÀ Ở", font=font(40, True), fill="black", anchor="mm")
    d.text((A4[0] / 2, 160), "Thửa 112 · tờ bản đồ 23 · tỷ lệ minh hoạ", font=font(26), fill="#333", anchor="mm")
    for i, lv in enumerate((1, 2)):
        p = floor_plan(lv).resize((1120, 840))
        im.paste(p, (60, 220 + i * 760))
    return im


def facade_crop(im):
    """Mặt tiền căn nhà trong ảnh dọc 140 Hàng Tiện (vùng giữa ảnh)."""
    w, h = im.size
    return im.crop((int(w * 0.12), int(h * 0.12), int(w * 0.80), int(h * 0.92)))


def build_glb(facade):
    """GLB tối giản: khối nhà 4,6 × 18,8 × 8,4 m, mặt tiền dán ảnh thật, tường/mái màu."""
    tex = io.BytesIO()
    f = facade.copy()
    f.thumbnail((1024, 1024))
    f = f.resize((1024, 1024))
    f.save(tex, "JPEG", quality=85)
    tex = tex.getvalue()
    wdt, dep, hgt = 4.6, 18.8, 8.4
    x0, x1, z0, z1 = -wdt / 2, wdt / 2, 0.0, -dep
    # (vị trí 4 góc, pháp tuyến, chất liệu); uv chỉ dùng cho mặt tiền
    quads = [
        ([(x0, 0, z0), (x1, 0, z0), (x1, hgt, z0), (x0, hgt, z0)], (0, 0, 1), 0),        # mặt tiền
        ([(x1, 0, z0), (x1, 0, z1), (x1, hgt, z1), (x1, hgt, z0)], (1, 0, 0), 1),
        ([(x0, 0, z1), (x0, 0, z0), (x0, hgt, z0), (x0, hgt, z1)], (-1, 0, 0), 1),
        ([(x1, 0, z1), (x0, 0, z1), (x0, hgt, z1), (x1, hgt, z1)], (0, 0, -1), 1),
        ([(x0, hgt, z0), (x1, hgt, z0), (x1, hgt, z1), (x0, hgt, z1)], (0, 1, 0), 2),    # mái bằng
        ([(-6, 0, 3), (6, 0, 3), (6, 0, -22), (-6, 0, -22)], (0, 1, 0), 3),              # vỉa hè / nền
    ]
    uv = [(0, 1), (1, 1), (1, 0), (0, 0)]
    bins, views, accessors, prims = bytearray(), [], [], []

    def add_view(data, target=None):
        while len(bins) % 4:
            bins.append(0)
        off = len(bins)
        bins.extend(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target:
            v["target"] = target
        views.append(v)
        return len(views) - 1

    for corners, n, mat in quads:
        pos = b"".join(struct.pack("<3f", *c) for c in corners)
        nor = struct.pack("<3f", *n) * 4
        idx = struct.pack("<6H", 0, 1, 2, 0, 2, 3)
        mins = [min(c[i] for c in corners) for i in range(3)]
        maxs = [max(c[i] for c in corners) for i in range(3)]
        a_pos = len(accessors)
        accessors.append({"bufferView": add_view(pos, 34962), "componentType": 5126, "count": 4, "type": "VEC3",
                          "min": mins, "max": maxs})
        a_nor = len(accessors)
        accessors.append({"bufferView": add_view(nor, 34962), "componentType": 5126, "count": 4, "type": "VEC3"})
        attrs = {"POSITION": a_pos, "NORMAL": a_nor}
        if mat == 0:
            attrs["TEXCOORD_0"] = len(accessors)
            accessors.append({"bufferView": add_view(b"".join(struct.pack("<2f", *t) for t in uv), 34962),
                              "componentType": 5126, "count": 4, "type": "VEC2"})
        a_idx = len(accessors)
        accessors.append({"bufferView": add_view(idx, 34963), "componentType": 5123, "count": 6, "type": "SCALAR"})
        prims.append({"attributes": attrs, "indices": a_idx, "material": mat})
    img_view = add_view(tex)
    while len(bins) % 4:
        bins.append(0)
    gltf = {
        "asset": {"version": "2.0", "generator": "taisandaugia seed-full-posting"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "Shophouse"}],
        "meshes": [{"primitives": prims}],
        "materials": [
            {"name": "Mặt tiền", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0,
                                                           "roughnessFactor": 0.9}, "doubleSided": True},
            {"name": "Tường vữa vàng", "pbrMetallicRoughness": {"baseColorFactor": [0.86, 0.74, 0.47, 1],
                                                                  "metallicFactor": 0, "roughnessFactor": 0.95}},
            {"name": "Mái", "pbrMetallicRoughness": {"baseColorFactor": [0.42, 0.24, 0.18, 1],
                                                       "metallicFactor": 0, "roughnessFactor": 1}},
            {"name": "Vỉa hè", "pbrMetallicRoughness": {"baseColorFactor": [0.62, 0.62, 0.6, 1],
                                                          "metallicFactor": 0, "roughnessFactor": 1}},
        ],
        "textures": [{"source": 0, "sampler": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987}],
        "images": [{"bufferView": img_view, "mimeType": "image/jpeg"}],
        "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": len(bins)}],
    }
    js = json.dumps(gltf, ensure_ascii=False).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bins)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
            + struct.pack("<II", len(bins), 0x004E4942) + bytes(bins))


def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def slide(im, caption):
    """Khung 1280×720: nền mờ cùng ảnh + ảnh vừa khung + chú thích."""
    W_, H_ = 1280, 720
    bg = im.copy().resize((W_, H_)).filter(ImageFilter.GaussianBlur(28))
    fg = im.copy()
    fg.thumbnail((W_ - 80, H_ - 60))
    bg.paste(fg, ((W_ - fg.width) // 2, (H_ - fg.height) // 2))
    d = ImageDraw.Draw(bg, "RGBA")
    d.rectangle([0, H_ - 76, W_, H_], fill=(0, 0, 0, 150))
    d.text((32, H_ - 38), caption, font=font(30, True), fill="white", anchor="lm")
    return bg


def title_card(lines):
    im = Image.new("RGB", (1280, 720), "#173d2e")
    d = ImageDraw.Draw(im)
    d.text((640, 300), lines[0], font=font(46, True), fill="white", anchor="mm")
    for i, ln in enumerate(lines[1:]):
        d.text((640, 380 + i * 50), ln, font=font(30), fill="#f5c84c" if i == 0 else "#d6e4dc", anchor="mm")
    return im


def build_video(frames, tmp):
    exe = ffmpeg_exe()
    if not exe:
        print("  video: không có ffmpeg — bỏ qua")
        return None
    inputs, filters = [], []
    for i, (im, secs) in enumerate(frames):
        p = tmp / f"f{i}.png"
        im.save(p)
        inputs += ["-i", str(p)]          # 1 khung vào ⇒ zoompan sinh đúng d khung ra
        n = int(secs * 25)
        filters.append(f"[{i}:v]scale=1600:900,zoompan=z='min(zoom+0.0007,1.10)':d={n}:"
                       f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720:fps=25,setsar=1[v{i}]")
    concat = "".join(f"[v{i}]" for i in range(len(frames))) + f"concat=n={len(frames)}:v=1:a=0,format=yuv420p[out]"
    out = tmp / "tour.mp4"
    cmd = [exe, "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filters + [concat]),
           "-map", "[out]", "-c:v", "libx264", "-preset", "medium", "-crf", "28", "-movflags", "+faststart",
           str(out)]
    subprocess.run(cmd, check=True)
    return out.read_bytes()


def build_files():
    """{(bucket, path): (bytes, content-type)} + tác giả ảnh Commons."""
    print("  tải ảnh Commons…")
    photos = commons_photos()
    plans = [floor_plan(1), floor_plan(2)]
    files, credits = {}, []
    imgs = []
    for k, (im, artist, lic) in enumerate(photos):
        im = im.copy()
        im.thumbnail((1600, 1600))
        imgs.append(im)
        files[("asset-media", PHOTO_PATHS[k])] = (jpeg(im), "image/jpeg")
        credits.append(f"• Ảnh {k + 1} ({COMMONS_PHOTOS[k][1].lower()}) — {artist}, {lic}")
    for k, im in enumerate(plans, start=3):
        files[("asset-media", PHOTO_PATHS[k])] = (jpeg(im, 90), "image/jpeg")
    with tempfile.TemporaryDirectory() as td:
        video = build_video([
            (title_card(["Shophouse 2 tầng kiến trúc Pháp", "Phố cổ TP. Nam Định · 86,5 m² · sổ đỏ",
                         "Tài sản bảo đảm BIDV – CN Hà Nội xử lý"]), 3),
            (slide(imgs[0], "Mặt tiền 3 vòm, ban công lan can sắt (ảnh minh hoạ)"), 4),
            (slide(imgs[1], "Góc chéo — vỉa hè rộng đỗ xe máy (ảnh minh hoạ)"), 4),
            (slide(imgs[2], "Dãy phố Pháp cổ cùng khu (ảnh minh hoạ)"), 4),
            (slide(plans[0], "Tầng 1 — gian bán hàng 26 m², trần 4,2 m"), 4),
            (slide(plans[1], "Tầng 2 — 2 phòng, gác lửng, sân thượng"), 4),
            (title_card(["Xem nhà theo lịch hẹn", "Giá khởi điểm dự kiến 8,650,000,000 ₫",
                         "Ảnh: Wikimedia Commons, CC BY-SA 4.0"]), 3),
        ], Path(td))
    if video:
        files[("asset-media", VIDEO_PATH)] = (video, "video/mp4")
        print(f"  video: {len(video) // 1024} KB")
    for key, data in documents().items():
        if key == "evidence":
            files[("posting-dossier-evidence", EVIDENCE_PATH)] = (data, "application/pdf")
        else:
            path = OWN_PATHS.get(key) or DOC_PATHS[key]
            files[("asset-docs", path)] = (data, "application/pdf")
    face = facade_crop(photos[0][0])
    files[("asset-3d", MODEL_PATH)] = (build_glb(face), "model/gltf-binary")
    poster = face.copy()
    poster.thumbnail((900, 900))
    files[("asset-3d", POSTER_PATH)] = (jpeg(poster), "image/jpeg")
    files[("asset-media", PANO_PATH)] = (fetch(PANO_SRC), "image/jpeg")
    return files, credits, bool(video)


def upload_files(files):
    for (bucket, path), (data, ctype) in files.items():
        if len(data) > 10 * 1024 * 1024 and bucket != "asset-3d":
            sys.exit(f"{path} vượt 10MB")
        api("POST", f"/storage/v1/object/{bucket}/{path}", raw=data, ctype=ctype, extra={"x-upsert": "true"})
    print(f"  tệp: {len(files)} đã tải lên storage")


def remove_files():
    by_bucket = {}
    for bucket, path in ([("asset-media", p) for p in PHOTO_PATHS + [VIDEO_PATH, PANO_PATH]]
                         + [("asset-docs", p) for p in list(OWN_PATHS.values()) + list(DOC_PATHS.values())]
                         + [("posting-dossier-evidence", EVIDENCE_PATH)]
                         + [("asset-3d", MODEL_PATH), ("asset-3d", POSTER_PATH)]):
        by_bucket.setdefault(bucket, []).append(path)
    for bucket, paths in by_bucket.items():
        api("DELETE", f"/storage/v1/object/{bucket}", {"prefixes": paths})
    print("  tệp: đã xoá")


# ─── SQL ──────────────────────────────────────────────────────────────────────
def seed_sql(commit, credits, has_video):
    desc = DESCRIPTION + "\n\nNguồn ảnh (Wikimedia Commons):\n" + "\n".join(credits)
    imgs = [public_url("asset-media", p) for p in PHOTO_PATHS]
    videos = [public_url("asset-media", VIDEO_PATH)] if has_video else []
    s = ["\\set ON_ERROR_STOP 1", "begin;", """
create function pg_temp.ok(j jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce((j->>'ok')::boolean, false) is not true then raise exception 'RPC trả lỗi: %', j; end if;
  return j;
end $$;""", f"""
select case when exists (select 1 from asset_postings where id = {lit(POSTING)})
  then pg_temp.ok('{{"ok":false,"reason":"da_seed_roi_chay_teardown_truoc"}}') end;"""]

    # 1) Chủ tài sản số hoá + gửi sàn duyệt (insert qua RLS thật)
    s += [as_user(OWNER), "set local role authenticated;", f"""
insert into asset_postings (id, user_id, workspace_id, branch_id, parent_slug, child_slug, title, description,
  province, district, ward, address, pricing_mode, starting_price, auction_format, commission_pct, expected_timeline,
  ownership_proof_urls, has_dispute, has_mortgage, is_seized, right_to_sell, legal_notes, delta_fields, image_urls,
  video_urls, doc_urls, status, submitted_at, created_at)
values ({lit(POSTING)}, {lit(OWNER)}, {lit(W)}, {lit(BRANCH)}, 'bat-dong-san', 'shophouse', {lit(TITLE)},
  {lit(desc)}, 'Nam Định', 'TP. Nam Định', 'Phường Bà Triệu', {lit(ADDRESS)}, 'self', {STARTING_PRICE},
  'ca_hai', 1.5, 'normal', {arr(OWN_PATHS.values())}, false, true, false, true, {lit(LEGAL_NOTES)}, {lit(DELTA)},
  {arr(imgs)}, {arr(videos)}, {arr(DOC_PATHS.values())}, 'active', '2026-09-24 10:02+07', '2026-09-24 09:15+07');""",
          # Hồ sơ dịch vụ (wizard bước 4): thẩm định đã có đối tác, pháp lý + tổ chức tìm qua sàn
          f"""
insert into asset_posting_dossier_items (posting_id, kind, source, partner_name, issued_at, valid_until,
  appraised_value, show_appraised_value, evidence_urls, created_by)
values ({lit(POSTING)}, 'appraisal', 'external_partner', 'Công ty CP Thẩm định giá Sông Hồng (demo)',
  '2026-09-20', '2027-03-20', {APPRAISED}, true, {arr([EVIDENCE_PATH])}, {lit(OWNER)}),
  ({lit(POSTING)}, 'legal', 'marketplace', null, null, null, null, false, '{{}}', {lit(OWNER)}),
  ({lit(POSTING)}, 'auction', 'marketplace', null, null, null, null, false, '{{}}', {lit(OWNER)});""",
          "reset role;"]

    # 2) Sàn duyệt
    s += [as_user(ADMIN), f"""
update asset_postings set review_status = 'approved', reviewed_at = '2026-09-25 14:30+07', reviewed_by = {lit(ADMIN)},
  review_notes = 'Đủ giấy tờ sở hữu + HĐTC có điều khoản xử lý TSBĐ. Ảnh 1–3 là ảnh minh hoạ, đã ghi nguồn.'
where id = {lit(POSTING)};"""]

    # 3) Mô hình 3D: chủ mở phiên quét → đối tác xử lý → nhận GLB → admin công khai
    model, poster = public_url("asset-3d", MODEL_PATH), public_url("asset-3d", POSTER_PATH)
    s += [as_user(OWNER),
          f"select (pg_temp.ok(start_asset_3d_scan({lit(POSTING)}))) as r3 \\gset",
          "select (:'r3'::jsonb)->>'scan_id' as scan, (:'r3'::jsonb)->>'scan_token' as scan_tok \\gset",
          f"select pg_temp.ok(mock_partner_deliver_asset_3d_scan(:'scan', {lit(POSTING)}, :'scan_tok', 'processing'));",
          AS_SYSTEM,
          f"select pg_temp.ok(attach_asset_3d_model(:'scan', {lit(POSTING)}, 'mock-' || :'scan', {lit(model)}, "
          f"{lit(poster)}, 'glb'));",
          as_user(ADMIN), "select pg_temp.ok(admin_publish_asset_3d_model(:'scan'));"]

    # 4) VR tour Silver Sea — hết chuỗi RPC thật
    s += [as_user(OWNER),
          f"select (pg_temp.ok(owner_request_vr_tour({lit(POSTING)}, 'vr_tour_basic', {lit(SILVER_SEA)}, "
          f"'Phố cổ khu Chợ Rồng, TP. Nam Định', 'Sáng thứ Bảy, liên hệ cán bộ xử lý nợ trước 1 ngày', "
          f"'Chụp cả 2 tầng, ban công và mặt phố.')))->>'order_id' as vr \\gset",
          as_user(ADMIN),
          "select pg_temp.ok(admin_quote_vr_tour(:'vr', 5000000, 'Gói cơ bản — nhà 2 tầng dưới 300 m².', 7));",
          as_user(OWNER), "select pg_temp.ok(pay_vr_tour_order(:'vr', 'DEMO-FA11-VR', 5000000));",
          as_user(ADMIN),
          "select pg_temp.ok(admin_schedule_vr_tour(:'vr', now() - interval '3 days', "
          "'Đã chụp 2 tầng + mặt phố (demo).'));",
          f"select pg_temp.ok(admin_deliver_vr_tour(:'vr', {lit(vr_url())}));",
          "select pg_temp.ok(admin_attach_vr_tour(:'vr'));"]

    # 5) Tư vấn pháp lý — rà soát 4 tài liệu, checklist 9 mục
    submitted = [OWN_PATHS["own1"], OWN_PATHS["own2"], DOC_PATHS["doc1"], DOC_PATHS["doc3"]]
    paths = {**OWN_PATHS, **DOC_PATHS}
    items = [{"template_key": k, "label": lb, "status": st, "expert_note": note, "required_action": act,
              "doc_paths": [paths[x] for x in docs]} for k, lb, st, note, act, docs in LEGAL_ITEMS]
    s += [as_user(OWNER),
          f"select (pg_temp.ok(owner_request_legal_consult({lit(POSTING)}, {arr(submitted)}, "
          f"'Nhờ rà soát trước khi gửi tổ chức đấu giá, nhất là điều khoản xử lý TSBĐ.')))->>'consultation_id' "
          f"as tvpl \\gset",
          as_user(ADMIN),
          f"select pg_temp.ok(admin_quote_legal_consult(:'tvpl', {lit(TVPL_PARTNER)}, 'LS. Phạm Đức Minh', 2000000, "
          f"'Rà soát 4 tài liệu, trả kết quả trong 3 ngày làm việc.', 7));",
          as_user(OWNER), "select pg_temp.ok(pay_legal_consult(:'tvpl', 'DEMO-FA11-TVPL', 2000000));",
          as_user(ADMIN), "select pg_temp.ok(admin_start_legal_consult(:'tvpl'));",
          f"select pg_temp.ok(admin_complete_legal_consult(:'tvpl', {lit(items)}, {lit(LEGAL_SUMMARY)}));"]

    # 6) Tư vấn đấu giá — phương án được người bán chấp nhận
    s += [as_user(OWNER),
          f"select (pg_temp.ok(owner_request_auction_consult({lit(POSTING)}, 'balanced', 9200000000, 8400000000, "
          f"'normal', '2026-12-31', 'Muốn bán trong năm 2026, ưu tiên không phải đấu lại.')))->>'consultation_id' "
          f"as tvdg \\gset",
          as_user(ADMIN),
          f"select pg_temp.ok(admin_quote_auction_consult(:'tvdg', {lit(TVDG_PARTNER)}, 'ThS. Lê Thu Hà', 3000000, "
          f"'Đề xuất phương án trong 5 ngày làm việc.', 7));",
          as_user(OWNER), "select pg_temp.ok(pay_auction_consult(:'tvdg', 'DEMO-FA11-TVDG', 3000000));",
          as_user(ADMIN), "select pg_temp.ok(admin_start_auction_consult(:'tvdg'));",
          f"select pg_temp.ok(admin_complete_auction_consult(:'tvdg', {lit(TVDG_PROPOSAL)}, {lit(TVDG_RATIONALE)}));",
          as_user(OWNER),
          "select pg_temp.ok(owner_decide_auction_consult(:'tvdg', 'accepted', "
          "'Đồng ý, dùng phương án này khi làm việc với tổ chức đấu giá.'));"]

    # 7) Gửi 3 tổ chức (insert qua RLS như useSendServiceRequests) → 3 báo giá → chốt Bảo Tín
    s += [as_user(OWNER), "set local role authenticated;",
          "insert into asset_service_requests (id, asset_posting_id, auction_org_id, user_id, status, origin, "
          "message, match_score) values " + ",\n  ".join(
              f"({lit(fid('0010', i))}, {lit(POSTING)}, {lit(org)}, {lit(OWNER)}, 'sent', 'owner', "
              f"{lit(ORG_MESSAGE)}, {score})"
              for i, ((org, _u, _q), score) in enumerate(zip(QUOTES, (92, 88, 81)), start=1)) + ";",
          "reset role;"]
    for i, (_org, user, quote) in enumerate(QUOTES, start=1):
        rid = lit(fid("0010", i))
        s += [as_user(user),
              f"select pg_temp.ok(org_respond_service_request({rid}, 'seen'));",
              f"select pg_temp.ok(org_respond_service_request({rid}, 'quote', {lit(quote)}));"]
    s += [as_user(OWNER), f"select pg_temp.ok(owner_select_service_quote({lit(fid('0010', 1))}));",
          # Bên A của hợp đồng dịch vụ = KYC tổ chức của Trạm; thiếu địa chỉ trụ sở thì luồng dừng ở
          # "Bổ sung địa chỉ". Điền như hộp thoại OwnerAddressDialog — chỉ khi đang trống (dùng chung cả Trạm).
          f"""select pg_temp.ok(owner_ws_update_org_address({lit(W)}, {lit(HQ_ADDRESS)}, 'Hà Nội'))
  from asset_owner_workspaces w join asset_owner_org_kyc k on k.id = w.org_kyc_id
 where w.id = {lit(W)} and coalesce(btrim(k.head_office_address), '') = '';"""]

    # 8) Link chia sẻ hồ sơ online + vài lượt xem ẩn danh
    s += [as_user(OWNER),
          f"select (pg_temp.ok(create_posting_share_link({lit(POSTING)}, 'Gửi nhà đầu tư Hà Nội', "
          f"'Trần Minh Quân', '0912345678', true, false, true, 30)))->'link'->>'code' as share_code \\gset",
          AS_ANON] + [
          f"select (get_shared_posting(:'share_code', 'demo-visitor-{v}', '{dev}'))->>'ok';"
          for v, dev in ((1, "mobile"), (2, "desktop"), (3, "mobile"))] + [
          "select track_posting_share_event(:'share_code', 'demo-visitor-1', 'cta_pdf', 'mobile');",
          "select track_posting_share_event(:'share_code', 'demo-visitor-2', 'cta_call', 'desktop');"]

    # 9) Kiểm tra dưới quyền secsosoo (RLS thật)
    s += [as_user(OWNER), "set local role authenticated;", f"""
\\echo '── Kiểm tra dưới quyền secsosoo ──'
select code, title, review_status, status from asset_postings where id = {lit(POSTING)};
select (asset_posting_dossier_trust({lit(POSTING)}))->>'score' as diem,
       (asset_posting_dossier_trust({lit(POSTING)}))->>'level' as muc;
select 'ảnh/video/tài liệu/giấy tờ' as k, cardinality(image_urls) || '/' || cardinality(video_urls) || '/' ||
       cardinality(doc_urls) || '/' || cardinality(ownership_proof_urls) as v from asset_postings where id = {lit(POSTING)}
union all select '3D', status || case when published_at is not null then ' · công khai' else '' end from asset_3d_scans where asset_posting_id = {lit(POSTING)}
union all select 'VR', code || ' ' || status from asset_vr_tour_orders where asset_posting_id = {lit(POSTING)}
union all select 'TVPL', code || ' ' || status from asset_legal_consultations where asset_posting_id = {lit(POSTING)}
union all select 'TVĐG', code || ' ' || status || ' · ' || seller_decision from asset_auction_consultations
  where asset_posting_id = {lit(POSTING)}
union all select 'yêu cầu tổ chức', string_agg(status, ', ') from asset_service_requests where asset_posting_id = {lit(POSTING)}
union all select 'hợp đồng dịch vụ', string_agg(status, ', ') from consignment_contracts where asset_posting_id = {lit(POSTING)};""",
          "reset role;",   # bảng link không cấp SELECT cho authenticated (app đọc qua RPC) ⇒ kiểm bằng quyền hệ thống
          f"select code as link_chia_se, view_count as luot_xem, cta_pdf_count as tai_pdf, cta_call_count as goi "
          f"from posting_share_links where posting_id = {lit(POSTING)};",
          "commit;" if commit else "rollback;"]
    return "\n".join(s)


def teardown_sql():
    p = lit(POSTING)
    return f"""\\set ON_ERROR_STOP 1
begin;
create temp table t_ord on commit drop as
  select commission_order_id as id from asset_vr_tour_orders where asset_posting_id = {p}
  union select commission_order_id from asset_legal_consultations where asset_posting_id = {p}
  union select commission_order_id from asset_auction_consultations where asset_posting_id = {p};
delete from payment_claims where unlock_param in (
  select 'vr_order:' || id from asset_vr_tour_orders where asset_posting_id = {p}
  union select 'legal_consult:' || id from asset_legal_consultations where asset_posting_id = {p}
  union select 'auction_consult:' || id from asset_auction_consultations where asset_posting_id = {p});
-- Lượt quét 3D trừ vào hạn mức gói thuê bao của Trạm ⇒ trả lại hạn mức.
delete from owner_subscription_usage where ref_type = 'asset_3d_scan' and ref_id in (
  select id from asset_3d_scans where asset_posting_id = {p});
delete from consignment_contract_events where contract_id in (select id from consignment_contracts where asset_posting_id = {p});
delete from consignment_contracts where asset_posting_id = {p};
delete from opportunities where asset_posting_id = {p};
delete from leads where asset_posting_id = {p};
delete from asset_vr_tour_orders where asset_posting_id = {p};
delete from asset_legal_consultations where asset_posting_id = {p};
-- Phương án đã hoàn tất bị trigger khoá vĩnh viễn (BR-CNS-05) ⇒ tắt trigger cho riêng lệnh này.
set local session_replication_role = replica;
delete from asset_auction_consult_proposals where consultation_id in (
  select id from asset_auction_consultations where asset_posting_id = {p});
set local session_replication_role = origin;
delete from asset_auction_consultations where asset_posting_id = {p};
delete from orders where id in (select id from t_ord where id is not null);
delete from asset_postings where id = {p};
commit;"""


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--teardown":
        print(psql(teardown_sql()))
        remove_files()
        return
    if arg not in ("", "--dry-run"):
        sys.exit(__doc__)
    files, credits, has_video = build_files()
    upload_files(files)
    print(psql(seed_sql(commit=arg != "--dry-run", credits=credits, has_video=has_video)))
    print("Xong." if arg != "--dry-run" else "Dry-run: đã ROLLBACK (tệp vẫn nằm trên storage — --teardown để xoá).")


if __name__ == "__main__":
    main()
