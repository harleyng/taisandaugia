"""Dữ liệu demo cho bản đồ làng nghề /lang-nghe — 100 làng nghề đi đúng luồng thật.

12 làng gốc (danh sách dưới đây) có VR tour; 88 làng bổ sung ở scripts/craft_villages_more.py
KHÔNG có VR và phần lớn ảnh là minh hoạ dòng sản phẩm (ghi rõ trong mô tả hồ sơ).

Mỗi làng:
  • 1 tài khoản demo.langnghe.<slug>@example.com (mật khẩu ghi vào scripts/craft-village-accounts.local)
  • KYC tổ chức org_type = 'craft_village' → admin duyệt → trigger tạo không gian (Trạm Điều Hành)
  • 1 hồ sơ số hoá (asset_postings) nhóm Thủ công mỹ nghệ, đã duyệt, ảnh sản phẩm thật từ
    Wikimedia Commons (giấy phép tự do, ghi công trong mô tả) tải lên bucket asset-media
  • (chỉ 12 làng gốc) 1 đơn VR tour Silver Sea đi hết chuỗi RPC thật: yêu cầu → báo giá → thanh toán (mô phỏng)
    → hẹn chụp → giao link → gắn vào hồ sơ. Việc giao link ghi 1 dòng hoa hồng vào `orders`.
  • Bật "Công khai lên bản đồ làng nghề" qua owner_set_craft_map_publication

VR tour ở đây là ẢNH 360° MINH HOẠ (Mapillary/Commons, CC BY-SA 4.0, chép về asset-media) mở bằng
trình xem Pannellum
— KHÔNG chụp tại chính làng đó; tiêu đề trong trình xem ghi rõ "minh hoạ". Đối tác giao tour thật
thì admin giao lại link mới (tour cũ tự chuyển superseded).

Mọi dòng seed có id tiền tố c4af…. Ghi đi qua trigger/RPC thật bằng cách đổi
`request.jwt.claims` sang từng người trong MỘT giao dịch.

    python3 scripts/seed-craft-villages.py              # seed các làng CHƯA có (chạy lại an toàn)
    python3 scripts/seed-craft-villages.py --dry-run    # chạy hết SQL rồi ROLLBACK (không tải ảnh)
    python3 scripts/seed-craft-villages.py --teardown   # gỡ sạch: dữ liệu, ảnh, tài khoản
    python3 scripts/seed-craft-villages.py --refresh-photos [slug…]
        # làng ĐÃ seed: tải lại ảnh + ghi image_urls/mô tả theo danh sách trong script
        # (không slug = mọi làng có số ảnh lệch với script). Ghi dưới quyền admin
        # duyệt nên hồ sơ giữ trạng thái đã duyệt.

Đọc SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_URI từ .env.local.
"""
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from craft_villages_more import MORE_VILLAGES

REPO = Path(__file__).resolve().parent.parent
REF = "vewtnkewyawmkpeymdot"
SUPABASE_URL = f"https://{REF}.supabase.co"
POOLER = "aws-0-ap-southeast-1.pooler.supabase.com"
ACCOUNTS_FILE = REPO / "scripts" / "craft-village-accounts.local"
TERMS_VERSION = "2026-05-17"
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

ADMIN = "95d7e29c-f1f5-4361-a3af-e9aeaf792f3f"        # harleyngx — duyệt KYC/hồ sơ, xử lý đơn VR
SILVER_SEA = "5115ea00-0000-4000-8000-000000000001"   # đối tác VR tour (hợp đồng hiệu lực)
VR_PACKAGE = "vr_tour_basic"
VR_PRICE = 5_000_000


def sid(group, n):
    return f"c4af{group}-0000-4000-8000-{n:012d}"


COMMONS = "https://upload.wikimedia.org/wikipedia/commons/thumb/"
# Ảnh 360° minh hoạ (equirectangular 2:1, bản 3840 px vừa giới hạn texture GPU di động).
PANO_HN = COMMONS + "{p}/Mapillary_%28{id}%2C_Yh9tzqFokRmQsaAUdPGJT0%29_%28bemaps_hn_kien%29_2023-09-19_{t}.jpg/3840px-Mapillary_%28{id}%2C_Yh9tzqFokRmQsaAUdPGJT0%29_%28bemaps_hn_kien%29_2023-09-19_{t}.jpg"
PANOS = [
    PANO_HN.format(p="0/06", id="1000378727852112", t="11H09M10S962"),
    PANO_HN.format(p="6/6d", id="1005513790708245", t="11H06M13S743"),
    PANO_HN.format(p="4/42", id="1015630459746641", t="11H09M47S707"),
    PANO_HN.format(p="2/2c", id="1022693579050333", t="11H03M38S421"),
    PANO_HN.format(p="f/f9", id="1026872208733002", t="11H04M13S623"),
    PANO_HN.format(p="3/31", id="1029974011619703", t="11H03M24S699"),
    PANO_HN.format(p="1/15", id="1032138551154113", t="11H11M02S782"),
    PANO_HN.format(p="f/f8", id="1038505640835773", t="11H04M22S632"),
    PANO_HN.format(p="6/68", id="1043567647087122", t="11H08M37S053"),
    PANO_HN.format(p="1/17", id="1046100266419858", t="11H04M56S457"),
    PANO_HN.format(p="f/f9", id="1050708945953723", t="11H08M16S824"),
]
PANO_MEKONG = COMMONS + "3/37/Mekong_Delta_2024_360.jpg/3840px-Mekong_Delta_2024_360.jpg"

# Tour thật đã có ⇒ giao link này thay ảnh 360° minh hoạ. Tour tự host ở public/vr/ (nhúng
# được ngay trong dialog; lib/vrTour/embed.ts nạp theo origin đang chạy).
VR_OVERRIDE = {
    # tour 3D 7 công đoạn làm gốm — bản gốc artifact claude.ai U5YrpwygMxo2RruTB76ZLF
    "bat-trang": "https://taisandaugia.vn/vr/bat-trang.html",
    # tour 3D 8 công đoạn làm nón (16 vòng tre, 3 lớp lá, in & thêu hình)
    "lang-chuong": "https://taisandaugia.vn/vr/lang-chuong.html",
}


def vr_url(pano, village):
    frag = urllib.parse.urlencode({
        "panorama": pano,
        "autoLoad": "true",
        "title": f"{village} — ảnh 360° minh hoạ",
        "author": "Wikimedia Commons · CC BY-SA 4.0",
    }, quote_via=urllib.parse.quote)
    return f"https://cdn.pannellum.org/2.5/pannellum.htm#{frag}"


# Ảnh sản phẩm = tên tệp Wikimedia Commons; tác giả + giấy phép đọc từ Commons lúc chạy.
# `local` = ảnh sàn tự có (tệp trong repo, kèm chú thích) — xếp TRƯỚC ảnh Commons.
# Ảnh đầu = ảnh bìa (thẻ ảnh trên bản đồ). Trang công khai chỉ lấy 6 ảnh đầu. Người đại diện là tên HƯ CẤU (không dùng tên nghệ nhân thật).
VILLAGES = [
    dict(slug="bat-trang", name="Làng gốm Bát Tràng", province="Hà Nội", district="Gia Lâm", ward="Bát Tràng",
         lat=20.976, lng=105.912, child="gom-su", product="Gốm sứ", rep="Nguyễn Văn Hưng",
         title="Bộ gốm men lam Bát Tràng vẽ tay",
         desc="Làng gốm hơn 700 năm bên sông Hồng. Bộ sưu tập bình, đĩa, ấm chén men lam vẽ tay "
              "của các lò gia đình trong làng, nung lò ga nhiệt độ cao.",
         photos=["Bát Tràng DSC 0091.JPG",
                 "Bát Tràng DSC 0096.JPG",
                 "Bát Tràng DSC 0097.JPG",
                 "Bat-Trang-Ceramic-Village1.jpg"]),
    dict(slug="van-phuc", name="Làng lụa Vạn Phúc", province="Hà Nội", district="Hà Đông", ward="Vạn Phúc",
         lat=20.979, lng=105.770, child="lua", product="Lụa tơ tằm", rep="Triệu Thị Lan",
         title="Lụa vân hoa Vạn Phúc dệt trên khung cửi",
         desc="Làng dệt lụa lâu đời bậc nhất Hà Đông; lụa vân hoa từng được dùng may trang phục cung đình. "
              "Hồ sơ gồm khung cửi, cuộn tơ và các mẫu lụa dệt hoa văn truyền thống.",
         photos=["Silk weaving, 2003 Ha Dong.jpg",
                 "Silk weaving, 2003 Ha Dong 12.jpg",
                 "Silk weaving, 2003 Ha Dong 16.jpg"]),
    dict(slug="lang-chuong", name="Làng nón Chuông", province="Hà Nội", district="Thanh Oai", ward="Phương Trung",
         lat=20.858, lng=105.778, child="may-tre", product="Nón lá", rep="Đỗ Thị Hoa",
         title="Nón lá làng Chuông — chằm tay từ lá cọ và khung tre",
         desc="Mỗi chiếc nón qua hàng chục công đoạn: phơi lá, là lá, chuốt vành tre, chằm chỉ. "
              "Nón Chuông nổi tiếng thanh, nhẹ và bền.",
         photos=["Conical hat, Viet, Thanh Oai, Hanoi, 1999, palm leaves with bamboo frame - Vietnamese Women's Museum - Hanoi, Vietnam - DSC03996.JPG",
                 "Vietnamese conical hat nonla.jpg",
                 "Hat-making display - Vietnam Museum of Ethnology - Hanoi, Vietnam - DSC02609.JPG",
                 "Conical hat.jpg",
                 "Nón lá đồ chơi.jpg"],
         illus=["Conical hat.jpg", "Nón lá đồ chơi.jpg"],
         local=[("scripts/assets/craft-villages/lang-chuong-trien-lam.jpg",
                 "Gian trưng bày nón Chuông tại triển lãm làng nghề Thanh Oai")]),
    dict(slug="quang-phu-cau", name="Làng hương Quảng Phú Cầu", province="Hà Nội", district="Ứng Hòa",
         ward="Quảng Phú Cầu", lat=20.7765, lng=105.7925, child="may-tre", product="Hương (nhang) thủ công",
         rep="Lê Văn Tuấn", title="Hương vòng, hương nén làng Quảng Phú Cầu",
         desc="Làng làm tăm hương và hương thủ công gần trăm năm. Những bó chân hương nhuộm đỏ phơi kín sân "
              "tạo thành cảnh sắc đặc trưng thu hút khách tham quan.",
         photos=["Incense in Vietnam.jpg",
                 "Drying incense 05.jpg",
                 "Drying incense 20.jpg"]),
    dict(slug="dong-ho", name="Làng tranh Đông Hồ", province="Bắc Ninh", district="Thuận Thành", ward="Song Hồ",
         lat=21.058, lng=106.088, child="tranh", product="Tranh dân gian", rep="Nguyễn Văn Khánh",
         title="Tranh khắc gỗ Đông Hồ in trên giấy điệp",
         desc="Tranh in từ ván khắc gỗ trên giấy điệp với màu tự nhiên (son, nghệ, lá chàm, than lá tre). "
              "Các mẫu kinh điển: Đám cưới chuột, Gà mái, Phù Đổng Thiên Vương.",
         photos=["Mice's wedding, Dong Ho picture, paper - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05290.JPG",
                 "Rooster and hen, Dong Ho picture, paper - Vietnam National Museum of Fine Arts - Hanoi, Vietnam - DSC05287.JPG",
                 "Tranh Đông Hồ vẽ Phù Đổng Thiên Vương.jpg"]),
    dict(slug="chu-dau", name="Làng gốm Chu Đậu", province="Hải Dương", district="Nam Sách", ward="Thái Tân",
         lat=20.9555, lng=106.381, child="gom-su", product="Gốm men lam", rep="Phạm Văn Bình",
         title="Gốm hoa lam Chu Đậu phục dựng theo mẫu cổ",
         desc="Dòng gốm hoa lam danh tiếng thế kỷ 15–16, từng xuất khẩu khắp châu Á. Làng phục dựng các mẫu "
              "bình, lọ, đĩa theo hiện vật cổ, vẽ tay men lam trên nền trắng ngà.",
         photos=["Chu Dau Ceramics, 15th-16th century (9980825105).jpg",
                 "Chu Dau Ceramics, 15th-16th century (9980846874).jpg",
                 "Chu Dau Ceramics, 15th-16th century (9980890376).jpg"]),
    dict(slug="phuoc-tich", name="Làng gốm Phước Tích", province="Thừa Thiên Huế", district="Phong Điền",
         ward="Phong Hòa", lat=16.618, lng=107.330, child="gom-su", product="Gốm đất nung", rep="Hồ Văn Minh",
         title="Gốm nồi đất Phước Tích — gốm tiến vua",
         desc="Làng cổ bên sông Ô Lâu; nồi gốm Phước Tích từng được tiến vua dùng nấu cơm trong cung đình Huế. "
              "Làng còn giữ nhiều nhà rường cổ và lò gốm truyền thống.",
         photos=["Phước Tích - panoramio (19).jpg",
                 "Phước Tích - panoramio (3).jpg",
                 "Phước Tích - panoramio.jpg"]),
    dict(slug="non-nuoc", name="Làng đá mỹ nghệ Non Nước", province="Đà Nẵng", district="Ngũ Hành Sơn",
         ward="Hòa Hải", lat=16.004, lng=108.264, child="da-my-nghe", product="Đá mỹ nghệ", rep="Huỳnh Bá Cường",
         title="Tượng đá cẩm thạch Non Nước",
         desc="Làng điêu khắc đá dưới chân Ngũ Hành Sơn, tạc tượng Phật, linh vật và đồ trang trí từ đá "
              "cẩm thạch, giữ kỹ thuật chạm tay qua nhiều thế hệ.",
         photos=["Marble statues in Hoà Hải 1.jpg",
                 "Marble statues in Hoà Hải 2.jpg",
                 "Marble statues in Hoà Hải 3.jpg"]),
    dict(slug="kim-bong", name="Làng mộc Kim Bồng", province="Quảng Nam", district="Hội An", ward="Cẩm Kim",
         lat=15.870, lng=108.328, child="do-go", product="Mộc chạm khắc", rep="Trương Công Lợi",
         title="Tượng gỗ và phù điêu chạm khắc Kim Bồng",
         desc="Làng mộc đã góp tay dựng nhiều nhà cổ Hội An, nổi tiếng với nghề đóng ghe và chạm khắc gỗ "
              "tinh xảo; nghệ nhân làm việc ngay tại xưởng ven sông Thu Bồn.",
         photos=["Three Heads in Kim Bong.JPG",
                 "Wood Carver Kim Bong.JPG",
                 "Kim Bong village gate.JPG"]),
    dict(slug="den-long-hoi-an", name="Làng đèn lồng Hội An", province="Quảng Nam", district="Hội An",
         ward="Minh An", lat=15.8795, lng=108.3345, child="may-tre", product="Đèn lồng", rep="Trần Văn Đức",
         title="Đèn lồng Hội An khung tre bọc lụa",
         desc="Đèn lồng làm từ khung tre uốn tay, bọc vải lụa nhiều màu — biểu tượng của phố cổ Hội An. "
              "Khách có thể tự tay làm một chiếc đèn tại xưởng.",
         photos=["Making lanterns in Hoi An (45693469494).jpg",
                 "Making lanterns in Hoi An (44599876490).jpg"]),
    dict(slug="bau-truc", name="Làng gốm Bàu Trúc", province="Ninh Thuận", district="Ninh Phước", ward="Phước Dân",
         lat=11.513, lng=108.928, child="gom-su", product="Gốm Chăm", rep="Đàng Thị Mai",
         title="Gốm Chăm Bàu Trúc nặn tay, nung lộ thiên",
         desc="Làng gốm của người Chăm, nặn tay không dùng bàn xoay và nung lộ thiên bằng rơm, củi — "
              "di sản văn hoá phi vật thể cần bảo vệ khẩn cấp được UNESCO ghi danh.",
         photos=["Gốm Bàu Trúc.JPG",
                 "Hợp tác xã Gốm Chăm Bàu Trúc.jpg",
                 "Làng gốm Bầu Trúc, Phước Dân, Ninh Phước.jpg"]),
    dict(slug="tan-chau", name="Làng lụa Tân Châu", province="An Giang", district="Tân Châu", ward="Long Châu",
         lat=10.800, lng=105.235, child="lua", product="Lụa & thổ cẩm", rep="Nguyễn Thị Mỹ",
         title="Lụa Mỹ A và thổ cẩm Tân Châu",
         desc="Quê hương lụa Mỹ A đen bóng nhuộm bằng trái mặc nưa và nghề dệt thổ cẩm của đồng bào Chăm "
              "ven sông Tiền.",
         photos=["Viet Nam – The Colors of Traditional Brocade and Silk 3.jpg",
                 "Song tien giang, tan chau an giang - panoramio.jpg",
                 "Tan Chau, An Giang - panoramio - trungydang.jpg"]),
]
for v in VILLAGES:
    v["vr"] = True
    v.setdefault("illus", [])
for v in MORE_VILLAGES:
    v["vr"] = False
    v["photos"] = v.pop("at") + v["illus"]
VILLAGES += MORE_VILLAGES
assert len({v["slug"] for v in VILLAGES}) == len(VILLAGES), "slug làng nghề bị trùng"
for i, v in enumerate(VILLAGES, start=1):
    v.setdefault("local", [])
    v["n"] = i
    v["user"] = sid("00a0", i)
    v["kyc"] = sid("00b0", i)
    v["posting"] = sid("0005", i)
    v["email"] = f"demo.langnghe.{v['slug']}@example.com"
    v["pano_src"] = None if not v["vr"] or v["slug"] in VR_OVERRIDE else (
        PANO_MEKONG if v["slug"] == "tan-chau" else PANOS[(i - 1) % len(PANOS)])


def photo_count(v):
    return len(v["local"]) + len(v["photos"])


def photo_path(v, k):
    return f"{v['user']}/lang-nghe/{v['slug']}-{k}.jpg"


def pano_path(v):
    return f"{v['user']}/lang-nghe/{v['slug']}-360.jpg"


def public_url(bucket, path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


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
        with urllib.request.urlopen(req, timeout=60) as res:
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


def as_user(uid):
    return f"select set_config('request.jwt.claims', {lit(json.dumps({'sub': uid, 'role': 'authenticated'}))}, true);"


AS_SYSTEM = "select set_config('request.jwt.claims', '', true);"


def pending_villages():
    """Làng chưa có hồ sơ KYC seed — chỉ những làng này được tải ảnh + chạy SQL."""
    have = set(psql("select id from asset_owner_org_kyc where id::text like 'c4af00b0-%';", rows=True))
    return [v for v in VILLAGES if v["kyc"] not in have]


# ─── Bước 1: tài khoản ────────────────────────────────────────────────────────
def ensure_accounts():
    have = dict(line.split("|") for line in psql(
        "select email || '|' || id from auth.users where email like 'demo.langnghe.%@example.com';", rows=True))
    created = []
    for v in VILLAGES:
        if v["email"] in have:
            if have[v["email"]] != v["user"]:
                sys.exit(f"{v['email']} đã tồn tại với id khác — gỡ tay trước khi seed.")
            continue
        pw = secrets.token_urlsafe(12)
        res = api("POST", "/auth/v1/admin/users", {
            "id": v["user"], "email": v["email"], "password": pw, "email_confirm": True,
            "user_metadata": {"name": v["rep"], "terms_accepted": True, "terms_version": TERMS_VERSION,
                              "privacy_version": TERMS_VERSION, "notifications_enabled": False},
        })
        if res.get("id") != v["user"]:
            sys.exit(f"GoTrue không nhận id cố định cho {v['email']}.")
        created.append(f"{v['email']}\t{pw}\t{v['name']}")
    if created:
        with ACCOUNTS_FILE.open("a", encoding="utf-8") as f:
            f.write("\n".join(created) + "\n")
    print(f"  tài khoản: {len(VILLAGES)} ({len(created)} mới)")


# ─── Bước 2: ảnh sản phẩm (Commons → asset-media) ─────────────────────────────
def commons_meta(files):
    """{tên tệp: {url (bản 1280 px), artist, license}} — đọc thẳng từ Commons để ghi công đúng."""
    titles = "|".join("File:" + f for f in files)
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1280, "titles": titles})
    req = urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{q}", headers={"User-Agent": UA})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    out = {}
    for p in d["query"]["pages"].values():
        if "imageinfo" not in p:
            sys.exit(f"Commons không có tệp {p['title']}")
        ii = p["imageinfo"][0]
        m = ii.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip() or "không rõ tác giả"
        out[norm.get(p["title"], p["title"])[5:]] = {
            "url": ii["thumburl"], "artist": artist[:80],
            "license": m.get("LicenseShortName", {}).get("value", "") or "xem trang tệp"}
    return out


def load_meta(villages):
    for v in villages:
        meta = commons_meta(v["photos"])
        v["meta"] = [meta[f] for f in v["photos"]]


def fetch(url):
    """Tải từ Wikimedia, chờ rồi thử lại khi bị giới hạn tốc độ (429)."""
    for wait in (0, 5, 15, 30, 60, 120):
        time.sleep(wait or 1)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=90).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    sys.exit(f"Wikimedia vẫn trả 429: {url}")


def upload(path, data):
    ctype = "image/png" if data[:8] == b"\x89PNG\r\n\x1a\n" else "image/jpeg"  # vài tệp Commons là PNG
    api("POST", f"/storage/v1/object/asset-media/{path}", raw=data, ctype=ctype, extra={"x-upsert": "true"})


def upload_photos(villages):
    """Ảnh sản phẩm + ảnh 360° chép về asset-media: không hotlink Wikimedia (hay trả 429)."""
    n = 0
    for v in villages:
        for k, (path, _) in enumerate(v["local"], start=1):
            upload(photo_path(v, k), (REPO / path).read_bytes())
            n += 1
        for k, m in enumerate(v["meta"], start=len(v["local"]) + 1):
            upload(photo_path(v, k), fetch(m["url"]))
            n += 1
        if v["pano_src"]:
            upload(pano_path(v), fetch(v["pano_src"]))
            n += 1
    print(f"  ảnh: {n} đã tải lên asset-media")


def remove_photos():
    paths = [photo_path(v, k) for v in VILLAGES for k in range(1, photo_count(v) + 1)]
    paths += [pano_path(v) for v in VILLAGES if v["vr"]]
    api("DELETE", "/storage/v1/object/asset-media", {"prefixes": paths})
    print(f"  ảnh: đã xoá {len(paths)}")


# ─── Bước 3: SQL ──────────────────────────────────────────────────────────────
def credits(v):
    lines = [f"• {f.rsplit('.', 1)[0]} — {m['artist']}, {m['license']}" + (" · minh hoạ" if f in v["illus"] else "")
             for f, m in zip(v["photos"], v["meta"])]
    head = "Nguồn ảnh (Wikimedia Commons):"
    if v["illus"]:
        head += "\nẢnh ghi “minh hoạ” là sản phẩm cùng dòng nghề, không chụp tại làng."
    own = [f"• {caption} — ảnh do sàn cung cấp" for _, caption in v["local"]]
    return "\n".join(own + [head] + lines)


def delivered_vr(v):
    return VR_OVERRIDE.get(v["slug"]) or vr_url(public_url("asset-media", pano_path(v)), v["name"])


def seed_sql(villages, commit):
    s = ["\\set ON_ERROR_STOP 1", "begin;", """
create function pg_temp.ok(j jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce((j->>'ok')::boolean, false) is not true then raise exception 'RPC trả lỗi: %', j; end if;
  return j;
end $$;""", f"""
select case when exists (select 1 from asset_owner_org_kyc where id in ({', '.join(lit(v['kyc']) for v in villages)}))
  then pg_temp.ok('{{"ok":false,"reason":"lang_vua_duoc_seed_o_phien_khac"}}') end;"""]

    ids = ", ".join(lit(v["user"]) for v in villages)
    s += [AS_SYSTEM, f"update profiles set activated = true, activated_at = now() where id in ({ids});"]

    for v in villages:
        n, u = v["n"], v["user"]
        imgs = [public_url("asset-media", photo_path(v, k)) for k in range(1, photo_count(v) + 1)]
        decl = {"name": v["rep"], "accepted_at": "2026-09-20T09:00:00+07:00", "version": "2026-09-06"}
        s += [f"\n-- ── {n}. {v['name']} ──", AS_SYSTEM, f"""
insert into asset_owner_org_kyc (id, created_by, status, kyc_scope, org_type, org_name, official_email, email_domain,
  tax_code, rep_full_name, rep_title, rep_id_type, rep_id_number, submitted_at)
values ({lit(v['kyc'])}, {lit(u)}, 'pending_review', 'organization', 'craft_village', {lit(v['name'])},
  {lit(v['email'])}, 'example.com', {lit(f'0109{n:06d}')}, {lit(v['rep'])}, 'Chủ nhiệm HTX làng nghề', 'cccd',
  {lit(f'0010{n:08d}')}, now() - interval '12 days');
update asset_owner_org_kyc set status = 'approved', reviewed_by = {lit(ADMIN)}, reviewed_at = now() - interval '10 days',
  review_notes = 'Giấy chứng nhận làng nghề + đăng ký HTX hợp lệ (demo).' where id = {lit(v['kyc'])};
select id as ws from asset_owner_workspaces where org_kyc_id = {lit(v['kyc'])} \\gset
insert into asset_postings (id, user_id, workspace_id, parent_slug, child_slug, title, description, province,
  district, ward, address, pricing_mode, auction_format, expected_timeline, has_dispute, has_mortgage, is_seized,
  right_to_sell, delta_fields, image_urls, status, submitted_at, review_status, reviewed_at, reviewed_by,
  ownership_declaration)
values ({lit(v['posting'])}, {lit(u)}, :'ws', 'thu-cong-my-nghe', {lit(v['child'])}, {lit(v['title'])},
  {lit(v['desc'] + chr(10) + chr(10) + credits(v))}, {lit(v['province'])}, {lit(v['district'])}, {lit(v['ward'])},
  {lit(v['name'])}, 'self', 'truc_tiep', 'flexible', false, false, false, true,
  {lit({'material': v['product'], 'origin': v['name']})}, array[{', '.join(lit(x) for x in imgs)}]::text[],
  'active', now() - interval '9 days', 'approved', now() - interval '8 days', {lit(ADMIN)}, {lit(decl)});"""]
        if v["vr"]:
            # VR tour: đi hết chuỗi RPC thật của chủ + admin
            s += [as_user(u),
                  f"select (pg_temp.ok(owner_request_vr_tour({lit(v['posting'])}, {lit(VR_PACKAGE)}, {lit(SILVER_SEA)}, "
                  f"{lit(v['name'] + ', ' + v['province'])}, 'Sáng thứ Bảy', 'Chụp toàn cảnh làng và xưởng sản xuất.')))"
                  f"->>'order_id' as vr \\gset",
                  as_user(ADMIN),
                  f"select pg_temp.ok(admin_quote_vr_tour(:'vr', {VR_PRICE}, 'Gói cơ bản — khu xưởng dưới 300 m² (demo).', 7));",
                  as_user(u),
                  f"select pg_temp.ok(pay_vr_tour_order(:'vr', {lit(f'DEMO-LANGNGHE-{n:02d}')}, {VR_PRICE}));",
                  as_user(ADMIN),
                  "select pg_temp.ok(admin_schedule_vr_tour(:'vr', now() - interval '5 days', 'Đã chụp tại làng (demo).'));",
                  f"select pg_temp.ok(admin_deliver_vr_tour(:'vr', {lit(delivered_vr(v))}));",
                  "select pg_temp.ok(admin_attach_vr_tour(:'vr'));"]
        s += [as_user(u),
              f"select pg_temp.ok(owner_set_craft_map_publication({lit(v['posting'])}, true, {v['lat']}, {v['lng']}, "
              f"{lit(v['product'])}));"]

    s += ["set local role anon;", AS_SYSTEM, "\\echo '── Kiểm tra dưới quyền anon ──'",
          "select count(*) as lang_nghe_cong_khai, count(vr_url) as co_vr from public_craft_villages();",
          "reset role;", "commit;" if commit else "rollback;"]
    return "\n".join(s)


def refresh_targets(slugs):
    """Làng đã seed cần làm mới ảnh: theo slug chỉ định, hoặc mọi làng có số ảnh lệch."""
    seeded = {v["posting"]: v for v in VILLAGES}
    live = dict(line.split("|") for line in psql(
        "select id || '|' || coalesce(array_length(image_urls, 1), 0) from asset_postings "
        f"where id in ({', '.join(lit(x) for x in seeded)});", rows=True))
    if slugs:
        unknown = set(slugs) - {v["slug"] for v in VILLAGES}
        if unknown:
            sys.exit(f"Không có làng: {', '.join(sorted(unknown))}")
        return [v for v in VILLAGES if v["slug"] in slugs and v["posting"] in live]
    return [v for v in VILLAGES if v["posting"] in live and int(live[v["posting"]]) != photo_count(v)]


def refresh_sql(villages):
    # Đường dẫn ảnh giữ nguyên nên CDN Storage vẫn trả bản cũ ⇒ gắn ?v= để buộc tải lại.
    ver = int(time.time())
    s = ["\\set ON_ERROR_STOP 1", "begin;", as_user(ADMIN)]
    for v in villages:
        imgs = [f"{public_url('asset-media', photo_path(v, k))}?v={ver}" for k in range(1, photo_count(v) + 1)]
        s.append(f"update asset_postings set image_urls = array[{', '.join(lit(x) for x in imgs)}]::text[], "
                 f"description = {lit(v['desc'] + chr(10) + chr(10) + credits(v))} where id = {lit(v['posting'])};")
    s += [AS_SYSTEM, "select count(*) filter (where review_status = 'approved') as van_duyet, count(*) as tong "
          f"from asset_postings where id in ({', '.join(lit(v['posting']) for v in villages)});", "commit;"]
    return "\n".join(s)


def teardown_sql():
    posts = ", ".join(lit(v["posting"]) for v in VILLAGES)
    kycs = ", ".join(lit(v["kyc"]) for v in VILLAGES)
    return f"""\\set ON_ERROR_STOP 1
begin;
create temp table t_vr on commit drop as
  select id, commission_order_id from asset_vr_tour_orders where asset_posting_id in ({posts});
delete from payment_claims where unlock_param in (select 'vr_order:' || id from t_vr);
delete from asset_vr_tour_orders where id in (select id from t_vr);
delete from orders where id in (select commission_order_id from t_vr where commission_order_id is not null);
delete from asset_postings where id in ({posts});
delete from asset_owner_org_kyc where id in ({kycs});
commit;"""


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--teardown":
        print(psql(teardown_sql()))
        remove_photos()
        for v in VILLAGES:
            try:
                api("DELETE", f"/auth/v1/admin/users/{v['user']}")
            except RuntimeError as e:
                if "404" not in str(e):
                    raise
        ACCOUNTS_FILE.unlink(missing_ok=True)  # mật khẩu cũ vô hiệu khi tài khoản bị xoá
        print("  tài khoản: đã xoá")
        return
    if arg == "--refresh-photos":
        todo = refresh_targets(sys.argv[2:])
        if not todo:
            print("Không có làng nào cần làm mới ảnh.")
            return
        print(f"  làm mới ảnh: {', '.join(v['slug'] for v in todo)}")
        load_meta(todo)
        upload_photos(todo)
        print(psql(refresh_sql(todo)))
        return
    if arg not in ("", "--dry-run"):
        sys.exit(__doc__)
    todo = pending_villages()
    if not todo:
        print(f"Đủ {len(VILLAGES)} làng — không còn gì để seed.")
        return
    print(f"  cần seed: {len(todo)}/{len(VILLAGES)} làng")
    load_meta(todo)
    ensure_accounts()
    if arg != "--dry-run":
        upload_photos(todo)
    print(psql(seed_sql(todo, commit=arg != "--dry-run")))
    print("Xong." if arg != "--dry-run" else "Dry-run: đã ROLLBACK.")


if __name__ == "__main__":
    main()
