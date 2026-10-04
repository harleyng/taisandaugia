"""Bộ demo TRUYỀN THÔNG cho ngân hàng (docs/owner-marketing-plan.md Phase M6, kịch bản §A4).

Lấp mọi màn của /chu-tai-san/truyen-thong + việc "Đẩy truyền thông" trên Tổng quan cho Trạm
"ngân hàng" 4ca4be7b… của secsosoo (đã có bộ seed-owner-demo.py):

  • Chi nhánh "Chi nhánh Quận 7" — pháp nhân HƯ CẤU "Ngân hàng Demo – Chi nhánh Quận 7"
    (không gán tin giả cho ngân hàng thật). 6 tài sản Quận 7, mô tả mở đầu bằng câu
    "Tin minh hoạ phục vụ trình diễn — không phải tài sản đấu giá thật."
  • A1 nhà phố Huỳnh Tấn Phát: 2 phiên không thành → đấu lần 3 trong phiên [DEMO] của Bảo Tín
    (PHIÊN VĨNH VIỄN, đăng ký tới 15/12/2026) với 7 hồ sơ đã thanh toán của người mua demo.
  • Chiến dịch: C1 đã gửi (4 kênh), C2 đã gửi trước phiên của căn hộ đã bán, C3 chờ duyệt
    (Trưởng đơn vị duyệt trực tiếp khi trình diễn), C4 đã duyệt chưa gửi, C5 bản tin 4 tài sản đã
    gửi 3 kênh rồi kết thúc (trạng thái cuối). Link riêng "App ngân hàng".
  • Mọi link là link Hồ sơ online /hs/:code (posting_share_links, migration 20261004210000):
    lượt xem + lượt bấm "Mua hồ sơ" / PDF / gọi theo ngày (biểu đồ trang chi tiết link), lượt lưu
    tin + hồ sơ đăng ký mang link (phễu "Hiệu quả quảng cáo"). Nếu hồ sơ số hoá HS-0070 của
    seed-full-posting.py có trong Trạm (đã duyệt): thêm vào C4 + một link Zalo riêng của hồ sơ.
  • Giao việc cho sàn: 10 đơn đủ mọi trạng thái — chờ báo giá, đã báo giá (còn hạn / hết hạn), đã thanh
    toán chờ nhận việc, đang thực hiện (tin nổi bật, trọn gói có banner đang chạy), hoàn tất (banner,
    bài fanpage), huỷ trước khi trả và sàn huỷ sau khi trả (có hoàn lượt / credit).
  • Báo cáo tháng của chi nhánh đã chốt + link /r/:token (phần "Hiệu quả truyền thông").
  • asset_owner_workspaces.is_demo = true ⇒ cổng hiện nhãn "Dữ liệu minh hoạ".

Ngày tính theo HÔM NAY (giờ Việt Nam) — chạy lại sau vài tuần thì --teardown rồi seed lại.
Ghi đi qua RPC thật (owner_mkt_*, admin_mkt_order_*, mkt_attribute_bidding_contract) bằng cách
đổi `request.jwt.claims` sang từng người trong MỘT giao dịch.

    python3 scripts/seed-mkt-demo.py                       # seed (dừng nếu đã seed)
    python3 scripts/seed-mkt-demo.py --dry-run             # chạy hết rồi ROLLBACK
    python3 scripts/seed-mkt-demo.py --orders [--dry-run]  # chỉ dựng lại đơn Giao việc cho sàn (mọi trạng thái)
                                                           # + lượt xem tin / số bài đăng cho báo cáo kết quả
    python3 scripts/seed-mkt-demo.py --campaign [--dry-run] # chỉ dựng lại chiến dịch nhiều tài sản C5 (4 tài sản,
                                                           # 3 kênh đã gửi, trạng thái cuối "Đã kết thúc")
    python3 scripts/seed-mkt-demo.py --teardown            # gỡ phần truyền thông, GIỮ phiên [DEMO]
    python3 scripts/seed-mkt-demo.py --teardown --with-session   # gỡ cả phiên + người mua demo

Phiên [DEMO], tin A1, pháp nhân hư cấu và 10 người mua demo là phần VĨNH VIỄN: seed lại dùng lại
chúng (cập nhật ngày thanh toán hồ sơ theo hôm nay). Mật khẩu người mua ghi vào
scripts/mkt-demo-accounts.local (gitignore *.local). Đọc SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_URI
từ .env.local (qua seed-owner-demo.py).
"""
import importlib.util
import json
import random
import secrets
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

_spec = importlib.util.spec_from_file_location("owner_demo", Path(__file__).with_name("seed-owner-demo.py"))
od = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(od)
api, psql, lit, sid = od.api, od.psql, od.lit, od.sid

REPO = od.REPO
ACCOUNTS_FILE = REPO / "scripts" / "mkt-demo-accounts.local"
VN = timezone(timedelta(hours=7))
T = datetime.now(VN).date()

W = od.W
OWNER = od.OWNER                                   # secsosoo — Trưởng đơn vị (duyệt, gửi, đặt hàng)
STAFF = od.U["m2"]                                 # Phạm Thu Trang — Cán bộ (soạn, gửi duyệt)
ADMIN = od.ADMIN                                   # harleyngx — admin sàn (báo giá, thực hiện đơn)
BAOTIN_ORG = "c9d00002-0000-4000-8000-000000000001"
BAOTIN = "a2222222-2222-2222-2222-222222222222"
ORG_HCM, ORG_MN = od.ORG_HCM, od.ORG_MN
ORG_NAME = {BAOTIN: "Công ty Đấu giá Hợp danh Bảo Tín", **od.ORG_NAME}
BANNER_POSITION = "ad000002-0000-4000-8000-000000000004"   # "Banner đầu trang danh sách"

DEMO_NOTE = "Tin minh hoạ phục vụ trình diễn — không phải tài sản đấu giá thật."
BANK = sid("0b05", 1)          # asset_owners hư cấu
BANK_NAME = "Ngân hàng Demo – Chi nhánh Quận 7"
BRANCH = sid("0b06", 1)        # workspace_branches của W
SESSION = sid("0b09", 1)
LOT = sid("0b0a", 1)
AD = sid("0b0c", 1)
REPORT = sid("0b0d", 1)
AD2 = sid("0b0c", 2)
TXN_BANNER = "DEMO-M6-VNP-0001"
TXN_FULL = "DEMO-M6-VNP-0002"


def lid(n):
    # "Mã" tài sản trên UI = 8 ký tự đầu của id ⇒ mỗi tài sản một tiền tố riêng (5eed1b01, 5eed2b01…).
    return f"5eed{n}b01-0000-4000-8000-{n:012d}"


DEMO_IDS = "{" + ",".join(lid(n) for n in range(1, 7)) + "}"


# ─── Ngày giờ theo hôm nay ────────────────────────────────────────────────────
def day(n):
    return (T + timedelta(days=n)).isoformat()


def at(n, hh=9, mm=0):
    """Mốc giờ Việt Nam, n ngày so với hôm nay."""
    return datetime.combine(T + timedelta(days=n), datetime.min.time(), VN).replace(hour=hh, minute=mm).isoformat()


# ─── Tài sản (A1 thuộc phần vĩnh viễn) ────────────────────────────────────────
IMG = od.IMG
SESSION_START = "2026-12-18T09:00:00+07:00"
SESSION_REG_END = "2026-12-15T17:00:00+07:00"

# n, loại, tiêu đề, giá, diện tích, tổ chức, phiên, hạn đăng ký, phường, đường, mô tả
ASSETS = [
    (1, "nha-pho", "Nhà phố 1 trệt 3 lầu 100 m² – mặt tiền Huỳnh Tấn Phát, Quận 7, TP.HCM", 12_600_000_000, 100,
     BAOTIN, SESSION_START, SESSION_REG_END, "Tân Thuận Tây", "Đường Huỳnh Tấn Phát",
     "Nhà 1 trệt 3 lầu, ngang 5 m, khu dân cư hiện hữu, phù hợp vừa ở vừa kinh doanh. Đấu giá lần 3 sau "
     "2 phiên không có đủ người tham gia; giá khởi điểm đã điều chỉnh theo quy định."),
    (2, "can-ho", "Căn hộ 2PN 76 m² – Sunrise City, Nguyễn Hữu Thọ, Quận 7, TP.HCM", 4_150_000_000, 76,
     ORG_HCM, at(-7), at(-12, 17), "Tân Hưng", "Đường Nguyễn Hữu Thọ",
     "Căn hộ 2 phòng ngủ tầng trung, ban công hướng Đông Nam, đã có sổ hồng. Bàn giao theo hiện trạng."),
    (3, "dat-o", "Đất ở 100 m² – KDC Phú Mỹ, Phường Phú Mỹ, Quận 7, TP.HCM", 8_900_000_000, 100,
     ORG_MN, at(7), at(3, 17), "Phú Mỹ", "Khu dân cư Phú Mỹ",
     "Lô đất ở đô thị trong khu dân cư hiện hữu, đường nội bộ 12 m, đã có sổ đỏ."),
    (4, "nha-pho", "Shophouse 7 × 18 m – khu Hưng Phước, Phú Mỹ Hưng, Quận 7, TP.HCM", 31_500_000_000, 126,
     ORG_HCM, at(20), at(16, 17), "Tân Phong", "Khu Hưng Phước, Phú Mỹ Hưng",
     "Shophouse 1 hầm 4 tầng, mặt tiền 7 m, đang cho thuê làm nhà hàng; bàn giao khi hết hợp đồng thuê."),
    (5, "van-phong", "Sàn văn phòng 180 m² – đường Nguyễn Lương Bằng, Quận 7, TP.HCM", 15_200_000_000, 180,
     ORG_HCM, at(32), at(27, 17), "Tân Phú", "Đường Nguyễn Lương Bằng",
     "Sàn văn phòng hạng B tầng 9, có 2 chỗ đậu ô tô, quyền sở hữu lâu dài."),
    (6, "kho-xuong", "Nhà kho 650 m² – KCX Tân Thuận, Quận 7, TP.HCM", 18_700_000_000, 650,
     ORG_MN, at(45), at(40, 17), "Tân Thuận Đông", "Khu chế xuất Tân Thuận",
     "Nhà kho khung thép cao 9 m trên đất thuê trả tiền một lần, còn 31 năm sử dụng."),
]

# A1: 2 phiên không thành trước khi vào phiên [DEMO]. (ngày tương đối, giá phiên, người tham gia, lý do)
A1_ROUNDS = [(-78, 14_000_000_000, 0, "no_registrants"), (-36, 13_300_000_000, 1, "single_bidder")]
A2_SOLD = 4_480_000_000

# ─── Người mua demo (phần vĩnh viễn) ──────────────────────────────────────────
BUYER_NAMES = ["Nguyễn Minh Tuấn", "Trần Thị Hồng Nhung", "Lê Quang Huy", "Phạm Ngọc Ánh", "Võ Thành Đạt",
               "Huỳnh Gia Bảo", "Đặng Thu Hà", "Bùi Văn Khánh", "Đỗ Mỹ Linh", "Ngô Hoàng Phúc"]
BUYERS = [(sid("0b08", i), f"demo.nguoimua.{i:02d}@example.com", name) for i, name in enumerate(BUYER_NAMES, start=1)]


def buyer(i):
    return BUYERS[i - 1][0]


# Hồ sơ tham gia phiên [DEMO] (đã thanh toán): (người mua, ngày thanh toán, kênh link được ghi nhận | None)
DOSSIERS = [(1, -13, "zalo"), (2, -11, "bank_app"), (3, -10, "zalo"), (4, -8, "facebook"),
            (5, -6, None), (6, -4, None), (7, -2, None)]

# ─── Chiến dịch ───────────────────────────────────────────────────────────────
DRAFTS = {
    1: {
        "email": {"subject": "Tài sản đấu giá: Nhà phố mặt tiền Huỳnh Tấn Phát, Quận 7",
                  "body": "Kính gửi Quý khách,\n\nCơ hội sở hữu nhà phố 100 m² mặt tiền đường Huỳnh Tấn Phát, "
                          "Quận 7 qua đấu giá công khai. Nhà 1 trệt 3 lầu trong khu dân cư hiện hữu, thuận tiện "
                          "vừa ở vừa kinh doanh. Tài sản được bán đấu giá minh bạch theo quy định; người mua đăng "
                          "ký tham gia trực tiếp với tổ chức đấu giá.\n\nThông tin chi tiết và hướng dẫn đăng ký ở "
                          "bên dưới."},
        "zalo": {"body": "Nhà phố mặt tiền Huỳnh Tấn Phát, Quận 7 đấu giá công khai.\nNhà 1 trệt 3 lầu, 100 m², "
                         "phù hợp vừa ở vừa kinh doanh. Đăng ký tham gia trực tuyến, xem chi tiết bên dưới."},
        "facebook": {"body": "📢 Đấu giá công khai: nhà phố mặt tiền Huỳnh Tấn Phát, Quận 7.\n\nNhà 1 trệt 3 lầu, "
                             "100 m², khu dân cư hiện hữu, thuận tiện kinh doanh.\n\nMời Quý khách xem chi tiết và "
                             "đăng ký tham gia theo hướng dẫn bên dưới."},
        "sms": {"body": "Nha pho MT Huynh Tan Phat Q7 dau gia cong khai"},
    },
    2: {
        "email": {"subject": "Tài sản đấu giá: Căn hộ 2PN Sunrise City, Quận 7",
                  "body": "Kính gửi Quý khách,\n\nCăn hộ 2 phòng ngủ 76 m² tại Sunrise City, Quận 7 được bán đấu "
                          "giá công khai. Căn tầng trung, ban công hướng Đông Nam, đã có sổ hồng.\n\nThông tin chi "
                          "tiết và hướng dẫn đăng ký ở bên dưới."},
        "zalo": {"body": "Căn hộ 2PN 76 m² Sunrise City, Quận 7 đấu giá công khai.\nĐã có sổ hồng, ban công "
                         "hướng Đông Nam. Xem chi tiết và đăng ký bên dưới."},
    },
    3: {
        "zalo": {"body": "Đất ở 100 m² KDC Phú Mỹ, Quận 7 đấu giá công khai — sắp hết hạn đăng ký.\nĐường "
                         "nội bộ 12 m, đã có sổ đỏ. Xem chi tiết bên dưới."},
        "facebook": {"body": "📢 Sắp hết hạn đăng ký: đất ở 100 m² khu dân cư Phú Mỹ, Quận 7.\n\nLô đất trong "
                             "khu dân cư hiện hữu, đường nội bộ 12 m, đã có sổ đỏ.\n\nXem chi tiết và đăng ký theo "
                             "hướng dẫn bên dưới."},
        "sms": {"body": "Dat o 100m2 KDC Phu My Q7 dau gia, sap het han dang ky"},
    },
    4: {
        "email": {"subject": "Tài sản đấu giá: Shophouse Hưng Phước, Phú Mỹ Hưng",
                  "body": "Kính gửi Quý khách,\n\nShophouse mặt tiền 7 m khu Hưng Phước, Phú Mỹ Hưng được bán "
                          "đấu giá công khai. 1 hầm 4 tầng, đang có khách thuê làm nhà hàng.\n\nThông tin chi tiết "
                          "và hướng dẫn đăng ký ở bên dưới."},
        "zalo": {"body": "Shophouse 7 × 18 m khu Hưng Phước, Phú Mỹ Hưng đấu giá công khai.\n1 hầm 4 tầng, "
                         "đang có khách thuê. Xem chi tiết bên dưới."},
        "facebook": {"body": "📢 Đấu giá công khai: shophouse 7 × 18 m khu Hưng Phước, Phú Mỹ Hưng, Quận 7."
                             "\n\n1 hầm 4 tầng, mặt tiền kinh doanh sầm uất.\n\nMời Quý khách xem chi tiết bên "
                             "dưới."},
    },
    # C5 — bản tin nhiều tài sản (khoá theo biến chiến dịch, không theo tài sản).
    "c5": {
        "email": {"subject": "Bản tin tài sản đấu giá Chi nhánh Quận 7 — tháng 9",
                  "body": "Kính gửi Quý khách,\n\nChi nhánh Quận 7 trân trọng giới thiệu 4 tài sản đang được bán "
                          "đấu giá công khai trong tháng: căn hộ 2PN Sunrise City, đất ở KDC Phú Mỹ, shophouse "
                          "Hưng Phước và sàn văn phòng đường Nguyễn Lương Bằng. Mỗi tài sản do một tổ chức đấu giá "
                          "chuyên nghiệp thực hiện; người mua đăng ký tham gia trực tiếp với tổ chức đấu giá.\n\n"
                          "Thông tin chi tiết từng tài sản và hướng dẫn đăng ký ở bên dưới."},
        "zalo": {"body": "Bản tin tài sản đấu giá tháng 9 — Chi nhánh Quận 7.\n4 tài sản: căn hộ Sunrise City, đất "
                         "KDC Phú Mỹ, shophouse Hưng Phước, sàn văn phòng Nguyễn Lương Bằng. Xem chi tiết từng tài "
                         "sản bên dưới."},
        "facebook": {"body": "📢 Bản tin tài sản đấu giá tháng 9 của Chi nhánh Quận 7.\n\n🏢 Căn hộ 2PN Sunrise "
                             "City\n🏡 Đất ở 100 m² KDC Phú Mỹ\n🏬 Shophouse Hưng Phước, Phú Mỹ Hưng\n🏢 Sàn văn phòng "
                             "180 m² Nguyễn Lương Bằng\n\nMời Quý khách xem chi tiết và đăng ký theo hướng dẫn bên "
                             "dưới."},
    },
}

# (biến, tài sản | [tài sản…], tên, ghi chú, kênh, mốc: tạo, gửi duyệt, duyệt | None, {kênh: ngày đánh dấu gửi})
CAMPAIGNS = [
    ("c2", 2, "Căn hộ Sunrise City — trước phiên đấu giá",
     "Gửi nhóm Zalo khách mua nhà ở của chi nhánh và email khách VIP.",
     ["email", "zalo"], (-25, 10), (-25, 15), (-24, 9), {"zalo": (-24, 10), "email": (-23, 8)}),
    ("c1", 1, "Đẩy truyền thông nhà phố Huỳnh Tấn Phát — đấu lần 3",
     "Tài sản đã 2 phiên không thành. Gửi qua mọi kênh của chi nhánh, ưu tiên khách kinh doanh.",
     ["email", "facebook", "sms", "zalo"], (-16, 9), (-16, 14), (-15, 9),
     {"zalo": (-15, 10), "facebook": (-15, 11), "sms": (-15, 16), "email": (-14, 8)}),
    ("c4", 4, "Shophouse Hưng Phước — giới thiệu khách doanh nghiệp",
     None, ["email", "facebook", "zalo"], (-4, 15), (-3, 9), (-3, 14), {}),
    ("c3", 3, "Đất KDC Phú Mỹ — nhắc hạn đăng ký",
     "Còn ít ngày đăng ký mà chưa có hồ sơ — cần gửi gấp.", ["facebook", "sms", "zalo"], (-1, 9), (-1, 10), None, {}),
    ("c5", [2, 3, 4, 5], "Bản tin tài sản đấu giá tháng 9 — Chi nhánh Quận 7",
     "Bản tin tổng hợp gửi toàn bộ danh sách khách của chi nhánh; kết thúc sau khi căn hộ Sunrise City đã bán.",
     ["email", "facebook", "zalo"], (-28, 9), (-28, 15), (-27, 9),
     {"zalo": (-27, 10), "facebook": (-27, 14), "email": (-26, 8)}),
]
# Chiến dịch đã khép lại (trạng thái cuối 'ended' — chưa có RPC, đặt trực tiếp): {biến: mốc kết thúc}
ENDED = {"c5": (-6, 17)}
# Lượt bấm link của chiến dịch nhiều tài sản: (biến, tài sản, kênh, lượt bấm, người xem, từ ngày, tới ngày, tỉ lệ điện thoại)
MULTI_HITS = [
    ("c5", 2, "zalo", 74, 58, -27, -8, 0.9), ("c5", 2, "facebook", 39, 34, -27, -8, 0.75), ("c5", 2, "email", 28, 23, -26, -8, 0.4),
    ("c5", 3, "zalo", 52, 41, -27, -6, 0.9), ("c5", 3, "facebook", 31, 27, -27, -6, 0.75), ("c5", 3, "email", 17, 15, -26, -6, 0.4),
    ("c5", 4, "zalo", 46, 37, -27, -6, 0.9), ("c5", 4, "facebook", 44, 38, -27, -6, 0.75), ("c5", 4, "email", 22, 19, -26, -6, 0.4),
    ("c5", 5, "zalo", 19, 16, -27, -6, 0.9), ("c5", 5, "facebook", 12, 11, -27, -6, 0.75), ("c5", 5, "email", 14, 12, -26, -6, 0.4),
]

# Hồ sơ số hoá HS-0070 (scripts/seed-full-posting.py) — chỉ dùng khi có trong Trạm và đã duyệt
# (biến psql :has_hs). Thêm vào chiến dịch C4 + một link Zalo riêng.
DEMO_POSTING = "fa110001-0000-4000-8000-000000000001"
CAMPAIGN_POSTINGS = {"c4"}
HS_LINK = ("l_hs_zalo", "zalo", "Nhóm Zalo khách đầu tư — shophouse Nam Định", -10)

# Link riêng (không thuộc chiến dịch): (biến, tài sản, kênh, nhãn, ngày tạo)
OWN_LINKS = [("l_a1_app", 1, "bank_app", "App ngân hàng — mục Tài sản xử lý nợ", -15),
             ("l_a5_app", 5, "bank_app", "App ngân hàng — banner trang chủ", -9)]

# Lượt xem: (biến link, lượt xem, người xem khác nhau, từ ngày, tới ngày, tỉ lệ điện thoại)
# Mỗi link còn có lượt bấm "Mua hồ sơ" / PDF / gọi / theo dõi theo tỉ lệ CTA_RATES trên số người xem.
CTA_RATES = {"cta_dossier": 0.07, "cta_pdf": 0.03, "cta_call": 0.015, "cta_follow": 0.02}
HS_HITS = ("l_hs_zalo", 64, 47, -10, 0, 0.85)
HITS = [
    ("c2_zalo", 133, 97, -24, -8, 0.9), ("c2_email", 61, 49, -23, -8, 0.4),
    ("c1_zalo", 168, 121, -15, 0, 0.9), ("c1_facebook", 92, 80, -15, 0, 0.75),
    ("c1_sms", 41, 38, -15, 0, 1.0), ("c1_email", 57, 44, -14, 0, 0.35),
    ("l_a1_app", 214, 150, -15, 0, 0.95), ("l_a5_app", 38, 31, -9, 0, 0.95),
]

# Lượt lưu tin: (người mua, tài sản, link | None = không xác định nguồn, ngày)
SAVES = [(1, 1, "c1_zalo", -14), (2, 1, "l_a1_app", -12), (3, 1, "c1_zalo", -11), (4, 1, "c1_facebook", -9),
         (8, 1, "c1_zalo", -7), (9, 1, "l_a1_app", -5), (10, 1, None, -4), (6, 1, None, -3),
         (5, 2, "c2_zalo", -22), (7, 2, "c2_zalo", -20), (9, 2, "c2_email", -18), (10, 2, "c2_zalo", -15),
         (3, 2, None, -12)]


# ─── SQL ──────────────────────────────────────────────────────────────────────
def as_uid(uid):
    return f"select set_config('request.jwt.claims', {lit(json.dumps({'sub': uid, 'role': 'authenticated'}))}, true);"


AS_SYSTEM, AS_ANON = od.AS_SYSTEM, od.AS_ANON


def listing_sql(n, kind, title, price, area, org, auction, reg, ward, street, desc):
    ca = {"auction_time": auction, "registration_deadline": reg, "asset_owner_name": BANK_NAME,
          "deposit_amount": price // 5, "document_fee": 500_000,
          "bid_step": max(10_000_000, price // 100 // 10_000_000 * 10_000_000),
          "auction_location": f"Trụ sở {ORG_NAME[org]}", "org_name": ORG_NAME[org], "seed_batch": "mkt_demo"}
    addr = {"province": "TP. Hồ Chí Minh", "district": "Quận 7", "ward": ward, "street": street}
    legal = "Sổ hồng" if kind in ("nha-pho", "can-ho", "van-phong") else "Sổ đỏ"
    return f"""
insert into listings (id, title, description, purpose, property_type_slug, price, area, image_url, legal_status, address,
  auction_org_id, asset_owner_id, status, price_unit, custom_attributes, views_count, created_at, updated_at)
values ({lit(lid(n))}, {lit(title)}, {lit(DEMO_NOTE + chr(10) + chr(10) + desc)}, 'FOR_SALE', {lit(kind)}, {price}, {area},
  {lit(IMG.format(kind))}, {lit(legal)}, {lit(addr)}, {lit(org)}, {lit(BANK)}, 'ACTIVE', 'TOTAL', {lit(ca)}, {120 + n * 53},
  timestamptz {lit(at(-90 if n == 1 else -30))}, timestamptz {lit(at(-90 if n == 1 else -30))})
on conflict (id) do nothing;"""


def permanent_sql():
    """Pháp nhân hư cấu, A1, phiên [DEMO] + lô + hồ sơ — tạo nếu chưa có, giữ qua --teardown."""
    s = [AS_SYSTEM, f"""
insert into asset_owners (id, name, owner_kind, address)
values ({lit(BANK)}, {lit(BANK_NAME)}, 'bank_credit', 'Quận 7, TP. Hồ Chí Minh (pháp nhân hư cấu — dữ liệu minh hoạ)')
on conflict (id) do nothing;""", listing_sql(*ASSETS[0])]
    s.append(f"select not exists (select 1 from auction_sessions where id = {lit(SESSION)}) as need_session \\gset")
    s.append("\\if :need_session")
    s += [as_uid(ADMIN), f"""
insert into auction_sessions (id, organization_id, title, description, auction_format, venue, province,
  registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at,
  max_registrants, dossier_fee, status, created_at, updated_at)
values ({lit(SESSION)}, {lit(BAOTIN_ORG)}, '[DEMO] Nhà phố mặt tiền Huỳnh Tấn Phát, Quận 7 — đấu giá lần 3',
  'Phiên DỮ LIỆU MẪU phục vụ trình diễn module Truyền thông của chủ tài sản (phễu đăng ký theo kênh). Không phải phiên đấu giá thật.',
  'ca_hai', 'Trực tuyến trên Tài Sản Đấu Giá và tại Hội trường Công ty Đấu giá Hợp danh Bảo Tín, 88 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  'TP. Hồ Chí Minh', timestamptz {lit(at(-20))}, timestamptz {lit(SESSION_REG_END)},
  '2026-12-01T08:00:00+07:00', '2026-12-12T17:00:00+07:00', timestamptz {lit(SESSION_START)}, '2026-12-18T11:00:00+07:00',
  50, 500000, 'draft', timestamptz {lit(at(-21))}, timestamptz {lit(at(-21))});
insert into auction_session_items (id, session_id, source, listing_id, title, category_slug, province, district, image_url,
  starting_price, deposit_amount, bid_step, created_at, updated_at)
select {lit(LOT)}, {lit(SESSION)}, 'listing', l.id, l.title, l.property_type_slug, l.address->>'province', l.address->>'district',
  l.image_url, 12600000000, 2520000000, 100000000, timestamptz {lit(at(-21))}, timestamptz {lit(at(-21))}
  from listings l where l.id = {lit(lid(1))};
update auction_sessions set status = 'published' where id = {lit(SESSION)};""", AS_SYSTEM,
          "alter table auction_sessions disable trigger auction_sessions_guard;",
          f"update auction_sessions set published_at = timestamptz {lit(at(-20))} where id = {lit(SESSION)};",
          "alter table auction_sessions enable trigger auction_sessions_guard;"]
    s.append("\\endif")

    # Hồ sơ đã thanh toán — tạo nếu thiếu, luôn dời ngày thanh toán theo hôm nay.
    for k, (b, d, _ch) in enumerate(DOSSIERS, start=1):
        cid = sid("0b0b", k)
        _id, email, name = BUYERS[b - 1]
        s.append(f"""
insert into auction_bidding_contracts (id, code, session_id, organization_id, user_id, full_name, id_type, id_number,
  date_of_birth, gender, phone, email, address, identity_source, fee_amount, status, paid_at, payment_txn_ref,
  created_at, updated_at)
values ({lit(cid)}, 'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0'), {lit(SESSION)},
  {lit(BAOTIN_ORG)}, {lit(_id)}, {lit(name)}, 'cccd', {lit(f'07909{k:07d}')}, date '1986-01-01' + {k * 431},
  {lit('male' if k % 2 else 'female')}, {lit(f'09000000{k:02d}')}, {lit(email)},
  {lit(f'{20 + k * 7} Đường số {k + 2}, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh')}, 'manual', 500000, 'paid',
  timestamptz {lit(at(d, 10 + k))}, {lit(f'DEMO-M6-HS-{k:04d}')}, timestamptz {lit(at(d, 9 + k))}, timestamptz {lit(at(d, 10 + k))})
on conflict (id) do update set paid_at = excluded.paid_at, created_at = excluded.created_at, updated_at = excluded.updated_at;""")
    return s


def campaign_sql(campaigns=CAMPAIGNS):
    s = []
    for var, n, name, notes, channels, created, submitted, approved, sent in campaigns:
        ns = n if isinstance(n, list) else [n]
        if 2 in ns:
            # Lúc gửi phiên của căn hộ còn ở phía trước: mở tạm lịch để dựng dữ kiện, rồi trả lại lịch đang có.
            s += [AS_SYSTEM, f"select custom_attributes->>'auction_time' as a2_auct, custom_attributes->>'registration_deadline' "
                             f"as a2_reg from listings where id = {lit(lid(2))} \\gset",
                  f"update listings set custom_attributes = custom_attributes || "
                  f"jsonb_build_object('auction_time', {lit(at(60))}, 'registration_deadline', {lit(at(55, 17))}) "
                  f"where id = {lit(lid(2))};"]
        ids = ", ".join(lit(lid(x)) for x in ns)
        postings = (f"(case when :'has_hs'::boolean then array[{lit(DEMO_POSTING)}]::uuid[] else '{{}}'::uuid[] end)"
                    if var in CAMPAIGN_POSTINGS else "'{}'::uuid[]")
        s += [as_uid(STAFF),
              f"select (pg_temp.ok(owner_mkt_save_draft(null, {lit(W)}, {lit(name)}, {lit(notes)}, "
              f"array[{ids}]::uuid[], {postings}, {lit('{' + ','.join(channels) + '}')}::text[], "
              f"{lit(DRAFTS.get(var) or DRAFTS[n])})))->>'id' as {var} \\gset",
              f"select pg_temp.ok(owner_mkt_submit(:'{var}'));"]
        if approved:
            s += [as_uid(OWNER), f"select pg_temp.ok(owner_mkt_approve(:'{var}', {lit('Đồng ý, gửi theo kế hoạch.' if n != 4 else None)}));"]
        for ch in sent:
            s.append(f"select pg_temp.ok(owner_mkt_mark_sent(:'{var}', {lit(ch)}, null));")
        if 2 in ns:
            k = ns.index(2)
            s += [AS_SYSTEM, f"update listings set custom_attributes = custom_attributes || "
                             f"jsonb_build_object('auction_time', :'a2_auct', 'registration_deadline', :'a2_reg') "
                             f"where id = {lit(lid(2))};",
                  f"update owner_mkt_campaigns set facts_snapshot = jsonb_set(jsonb_set(facts_snapshot, "
                  f"'{{assets,{k},auction_at}}', to_jsonb(:'a2_auct'::timestamptz)), '{{assets,{k},registration_end_at}}', "
                  f"to_jsonb(:'a2_reg'::timestamptz)) where id = :'{var}';"]

        # Lùi mốc thời gian (RPC đóng dấu now()) — chiến dịch, link, nhật ký duyệt.
        c_at, s_at = at(*created), at(*submitted)
        a_at = at(*approved) if approved else None
        e_at = at(*ENDED[var]) if var in ENDED else None
        sent_json = {ch: at(*v) for ch, v in sent.items()}
        first_sent = min(sent_json.values()) if sent_json else None
        s += [AS_SYSTEM, f"""
update owner_mkt_campaigns set created_at = {lit(c_at)}, submitted_at = {lit(s_at)},
  approved_at = {lit(a_at)}, sent_at = {lit(first_sent)},
  sent_channels = {lit(sent_json)},
  facts_snapshot = jsonb_set(facts_snapshot, '{{built_at}}', to_jsonb(timestamptz {lit(s_at)}))
 where id = :'{var}';
alter table owner_mkt_campaigns disable trigger owner_mkt_campaigns_updated_at;
update owner_mkt_campaigns set status = coalesce({lit('ended' if e_at else None)}, status),
  updated_at = coalesce({lit(e_at)}::timestamptz, greatest(created_at, submitted_at, approved_at, sent_at)) where id = :'{var}';
alter table owner_mkt_campaigns enable trigger owner_mkt_campaigns_updated_at;
update posting_share_links set created_at = {lit(a_at or s_at)}, updated_at = {lit(a_at or s_at)} where campaign_id = :'{var}';
update owner_mkt_audit set created_at = case action
    when 'create' then timestamptz {lit(c_at)} when 'submit' then timestamptz {lit(s_at)}
    when 'approve' then timestamptz {lit(a_at or s_at)}
    when 'mark_sent' then (timestamptz {lit(c_at)} + interval '0 s')
    else created_at end
 where campaign_id = :'{var}';"""]
        for ch, ts in sent_json.items():
            s.append(f"update owner_mkt_audit set created_at = {lit(ts)} where campaign_id = :'{var}' "
                     f"and action = 'mark_sent' and detail->>'channel' = {lit(ch)};")
        if approved and len(ns) == 1:
            for ch in channels:
                s.append(f"select id as {var}_{ch} from posting_share_links where campaign_id = :'{var}' "
                         f"and listing_id is not null and channel = {lit(ch)} \\gset")
    return s


def _create_link(var, posting, listing, ch, label):
    """Link Hồ sơ online qua RPC thật (create_share_link) — người tạo là cán bộ STAFF."""
    return (f"select (pg_temp.ok(create_share_link({lit(W)}, {lit(posting)}, {lit(listing)}, {lit(ch)}, {lit(label)}, "
            f"false, false, true, null, {lit(STAFF)})))->'link'->>'id' as {var} \\gset")


def own_links_sql():
    s = [as_uid(STAFF)]
    for var, n, ch, label, _d in OWN_LINKS:
        s.append(_create_link(var, None, lid(n), ch, label))
    var, ch, label, d = HS_LINK
    s += ["\\if :has_hs", _create_link(var, DEMO_POSTING, None, ch, label), "\\endif"]
    s.append(AS_SYSTEM)
    for var, _n, _ch, _label, d in [*OWN_LINKS, (HS_LINK[0], None, None, None, HS_LINK[3])]:
        upd = f"update posting_share_links set created_at = {lit(at(d, 8))}, updated_at = {lit(at(d, 8))} where id = :'{var}';"
        s += ["\\if :has_hs", upd, "\\endif"] if var == HS_LINK[0] else [upd]
    return s


def _events_sql(rnd, now, link, var, total, visitors, d0, d1, mobile):
    """Lượt xem (dồn vào mấy ngày đầu sau khi gửi) + lượt bấm CTA của chính những người đã xem."""
    start = datetime.combine(T + timedelta(days=d0), datetime.min.time(), VN).replace(hour=11)
    end = min(datetime.combine(T + timedelta(days=d1), datetime.min.time(), VN).replace(hour=21), now - timedelta(minutes=5))
    span = (end - start).total_seconds()
    rows, seen = [], []
    for i in range(total):
        v = i if i < visitors else rnd.randrange(visitors)
        t = start + timedelta(seconds=span * (rnd.random() ** 1.7))
        dev = "mobile" if rnd.random() < mobile else rnd.choice(["desktop", "desktop", "tablet"])
        seen.append((v, t, dev))
        rows.append(("view", v, dev, t))
    for event, rate in CTA_RATES.items():
        for v, t, dev in rnd.sample(seen, min(len(seen), round(visitors * rate))):
            rows.append((event, v, dev, min(t + timedelta(minutes=rnd.randint(1, 20)), now - timedelta(minutes=1))))
    values = ", ".join(f"({lit(e)}, {lit(f'mkt-demo-{var}-{v:03d}')}, {lit(dev)}, timestamptz {lit(t.isoformat(timespec='seconds'))})"
                       for e, v, dev, t in rows)
    return (f"insert into posting_share_events (link_id, event, visitor_id, device, created_at) "
            f"select {link}, v.e, v.s, v.d, v.t from (values {values}) as v(e, s, d, t);")


def hits_sql(single=HITS, multi=MULTI_HITS, with_hs=True):
    rnd = random.Random(20261002)
    now = datetime.now(VN)
    s = [AS_SYSTEM]
    # (biểu thức id link, khoá người xem, …) — link chiến dịch nhiều tài sản tra theo tài sản × kênh.
    plan = [(f":'{var}'", var, *rest) for var, *rest in single] + [
        (f"(select id from posting_share_links where campaign_id = :'{c}' and listing_id = {lit(lid(n))} and channel = {lit(ch)})",
         f"{c}-{n}-{ch}", *rest) for c, n, ch, *rest in multi]
    for p in plan:
        s.append(_events_sql(rnd, now, *p))
    if with_hs:
        var, *rest = HS_HITS
        s += ["\\if :has_hs", _events_sql(rnd, now, f":'{var}'", var, *rest), "\\endif"]
    s.append(f"""
update posting_share_links k
   set view_count = e.v, unique_view_count = e.u, last_viewed_at = e.last,
       cta_dossier_count = e.d, cta_pdf_count = e.p, cta_call_count = e.c
  from (select link_id,
               count(*) filter (where event = 'view')::int v,
               count(distinct visitor_id) filter (where event = 'view')::int u,
               max(created_at) filter (where event = 'view') last,
               count(*) filter (where event = 'cta_dossier')::int d,
               count(*) filter (where event = 'cta_pdf')::int p,
               count(*) filter (where event = 'cta_call')::int c
          from posting_share_events group by link_id) e
 where e.link_id = k.id and k.workspace_id = {lit(W)}
   and (k.listing_id = any({lit('{' + ','.join(lid(a[0]) for a in ASSETS) + '}')}::uuid[]) or k.posting_id = {lit(DEMO_POSTING)});""")
    return s


def saves_sql():
    s = []
    for b, n, link, d in SAVES:
        t = at(d, 20, 15 + b)
        s += [as_uid(buyer(b)), f"""
insert into user_asset_actions (user_id, listing_id, is_saved, created_at, updated_at)
values ({lit(buyer(b))}, {lit(lid(n))}, true, timestamptz {lit(t)}, timestamptz {lit(t)})
on conflict (user_id, listing_id) do update set is_saved = true, created_at = excluded.created_at, updated_at = excluded.updated_at;
insert into analytics_events (session_id, user_id, event_type, path, feature_key, device_type, listing_id, mkt_link_id, created_at)
values ({lit(f'mkt-demo-b{b:02d}')}, {lit(buyer(b))}, 'feature', {lit('/listings/' + lid(n))}, 'save_asset', 'mobile',
  {lit(lid(n))}, {(":'" + link + "'") if link else 'NULL'}, timestamptz {lit(t)});"""]
    # "Theo dõi / lưu" của link tin = lượt lưu được guard xác nhận gắn link.
    s += [AS_SYSTEM, f"""
update posting_share_links k set cta_follow_count = (
  select count(distinct e.user_id) from analytics_events e where e.mkt_link_id = k.id and e.feature_key = 'save_asset')
 where k.workspace_id = {lit(W)} and k.listing_id = any({lit('{' + ','.join(lid(a[0]) for a in ASSETS) + '}')}::uuid[]);"""]
    return s


# ─── Kết quả đơn Giao việc: lượt xem tin theo ngày (owner_mkt_order_impact) ───
# Lượt xem nền mỗi ngày + phần tăng trong khoảng sàn chạy (khớp mốc của orders_sql). Ẩn danh,
# session_id 'demo-mkt-v-…' để gỡ được. (tài sản, lượt nền/ngày, [(từ ngày, tới ngày, lượt thêm/ngày)])
VIEW_PLAN = [
    (1, 4, [(-14, -1, 9), (-2, 0, 14)]),     # banner 14 ngày, rồi tin nổi bật
    (2, 3, [(-16, -13, 13)]),                # bài fanpage
    (3, 3, [(-6, 0, 8)]),                    # trọn gói đang chạy (banner đang hiển thị)
]
# Lượt lưu thêm trên đất KDC Phú Mỹ trong lúc trọn gói chạy: (người mua, ngày)
IMPACT_SAVES = [(2, -5), (5, -3), (8, -1)]
POST_METRICS = (12400, 318, 41)          # khớp ghi chú hoàn tất của đơn bài fanpage


def impact_sql():
    rnd = random.Random(20261004)
    rows = []
    for n, base, boosts in VIEW_PLAN:
        pool = 0
        for d in range(-40, 1):
            extra = sum(e for a, b, e in boosts if a <= d <= b)
            k = max(0, base + extra + rnd.randint(-2, 2))
            for _ in range(k):
                # ~1/4 lượt là người cũ quay lại ⇒ "người xem" < "lượt xem".
                if pool and rnd.random() < 0.25:
                    sess = f"demo-mkt-v-{n}-{rnd.randint(1, pool)}"
                else:
                    pool += 1
                    sess = f"demo-mkt-v-{n}-{pool}"
                hh, mm = rnd.randint(7, 22), rnd.randint(0, 59)
                if d == 0 and hh * 60 + mm > datetime.now(VN).hour * 60 + datetime.now(VN).minute:
                    continue
                dev = rnd.choice(["mobile", "mobile", "mobile", "desktop"])
                rows.append(f"({lit(sess)}, 'page_view', '/listings/:id', {lit(dev)}, {lit(lid(n))}, timestamptz {lit(at(d, hh, mm))})")
    s = [AS_SYSTEM, "insert into analytics_events (session_id, event_type, path, device_type, listing_id, created_at) values\n"
         + ",\n".join(rows) + ";"]
    for b, d in IMPACT_SAVES:
        t = at(d, 21, 10 + b)
        s.append(f"""
insert into user_asset_actions (user_id, listing_id, is_saved, created_at, updated_at)
values ({lit(buyer(b))}, {lit(lid(3))}, true, timestamptz {lit(t)}, timestamptz {lit(t)})
on conflict (user_id, listing_id) do update set is_saved = true, created_at = excluded.created_at, updated_at = excluded.updated_at;""")
    r, e, c = POST_METRICS
    s.append(f"""
update owner_mkt_orders set post_metrics = jsonb_build_object('reach', {r}, 'engagements', {e}, 'clicks', {c},
  'updated_at', completed_at) where workspace_id = {lit(W)} and listing_id = {lit(lid(2))} and variant_key = 'mkt_social_owner';""")
    return s


def impact_teardown_sql():
    buyers = "{" + ",".join(buyer(b) for b, _d in IMPACT_SAVES) + "}"
    return ["delete from analytics_events where session_id like 'demo-mkt-v-%';",
            f"delete from user_asset_actions where listing_id = {lit(lid(3))} and user_id = any({lit(buyers)}::uuid[]);"]


def attribution_sql():
    s = []
    for k, (b, _d, ch) in enumerate(DOSSIERS, start=1):
        if ch:
            var = "l_a1_app" if ch == "bank_app" else f"c1_{ch}"
            s += [as_uid(buyer(b)), f"select pg_temp.ok(mkt_attribute_bidding_contract({lit(sid('0b0b', k))}, :'{var}'));"]
    s.append(AS_SYSTEM)
    return s


def outcomes_sql():
    s = [AS_SYSTEM]
    for k, (d, price, _p, _r) in enumerate(A1_ROUNDS, start=1):
        s.append(f"insert into listing_price_sessions (id, listing_id, session_date, price, district, property_type, created_at) "
                 f"values ({lit(sid('0b03', k))}, {lit(lid(1))}, {lit(day(d))}, {price}, 'TP. Hồ Chí Minh', 'nha-pho', "
                 f"timestamptz {lit(at(d, 18))}) on conflict (id) do nothing;")
    s.append(f"insert into listing_price_sessions (id, listing_id, session_date, price, district, property_type, created_at) "
             f"values ({lit(sid('0b03', 3))}, {lit(lid(2))}, {lit(day(-7))}, {ASSETS[1][3]}, 'TP. Hồ Chí Minh', 'can-ho', "
             f"timestamptz {lit(at(-7, 18))});")
    s.append(as_uid(STAFF))
    for k, (d, price, part, reason) in enumerate(A1_ROUNDS, start=1):
        s.append(f"""
insert into owner_asset_outcomes (id, workspace_id, listing_id, round_no, auction_date, auction_org_id, outcome, failure_reason,
  starting_price, participants, payment_status, evidence_urls, source, share_to_market, created_at)
values ({lit(sid('0b04', k))}, {lit(W)}, {lit(lid(1))}, {k}, {lit(day(d))}, {lit(BAOTIN)}, 'unsold', {lit(reason)},
  {price}, {part}, 'pending', '{{}}'::text[], 'owner_manual', false, timestamptz {lit(at(d, 17, 30))});""")
    s.append(f"""
insert into owner_asset_outcomes (id, workspace_id, listing_id, round_no, auction_date, auction_org_id, outcome,
  starting_price, winning_price, participants, payment_status, payment_due_on, evidence_urls, source, share_to_market, created_at)
values ({lit(sid('0b04', 3))}, {lit(W)}, {lit(lid(2))}, 1, {lit(day(-7))}, {lit(ORG_HCM)}, 'sold', {ASSETS[1][3]}, {A2_SOLD}, 5,
  'pending', {lit(day(23))}, '{{}}'::text[], 'owner_manual', false, timestamptz {lit(at(-7, 17, 30))});
insert into owner_cash_events (id, outcome_id, kind, amount, occurred_on, note)
values ({lit(sid('0b04', 11))}, {lit(sid('0b04', 3))}, 'deposit', {ASSETS[1][3] // 5}, {lit(day(-7))}, 'Chuyển tiền đặt trước của người trúng');""")
    s += [AS_SYSTEM, f"update owner_cash_events set created_at = timestamptz {lit(at(-7, 16))}, updated_at = timestamptz {lit(at(-7, 16))} "
                     f"where id = {lit(sid('0b04', 11))};"]
    return s


def orders_sql():
    """Giao việc cho sàn — đủ mọi trạng thái (requested · quoted còn hạn / hết hạn · paid · in_progress ·
    completed · cancelled trước khi trả / sau khi trả có hoàn). Ghi qua RPC thật rồi dời mốc giờ về quá khứ."""
    o = lambda n, *a: f"select (pg_temp.ok(owner_mkt_order_create({lit(W)}, {lit(lid(n))}, {', '.join(lit(x) for x in a)})))->>'order_id' as {{}} \\gset"
    s = [as_uid(OWNER),
         # Theo thứ tự ngày tạo ⇒ mã GVS tăng dần theo thời gian.
         o(2, "mkt_social_owner", "registrations",
           "Đăng bài giới thiệu căn hộ trên fanpage của sàn trước hạn đăng ký; nhấn mạnh sổ hồng và ban công hướng Đông Nam.").format("o_social"),
         o(1, "mkt_banner_owner", "registrations",
           "Chạy banner 14 ngày ở đầu trang danh sách, dẫn về tài sản; mục tiêu thêm người đăng ký cho phiên đấu lần 3.").format("o_banner"),
         o(5, "mkt_banner_owner", "price_discovery",
           "Thăm dò mức quan tâm với sàn văn phòng hạng B trước khi chốt giá khởi điểm.").format("o_expired"),
         o(3, "mkt_full_owner", "registrations",
           "Đất KDC Phú Mỹ sắp hết hạn đăng ký: cần dồn truyền thông trong 2 tuần, ưu tiên khách mua để ở trong Quận 7.").format("o_prog"),
         o(4, "mkt_banner_owner", "awareness",
           "Banner trang chủ 7 ngày cho shophouse Hưng Phước.").format("o_cancel_owner"),
         o(5, "mkt_featured_owner", "awareness",
           "Đưa sàn văn phòng lên mục nổi bật trong tuần mở hồ sơ.").format("o_cancel_admin"),
         o(1, "mkt_featured_owner", "registrations",
           "Đẩy nhà phố Huỳnh Tấn Phát lên đầu danh sách trong tuần cuối trước hạn đăng ký phiên đấu lần 3.").format("o_feat"),
         o(4, "mkt_full_owner", "registrations",
           "Shophouse giá trị lớn, cần tiếp cận khách doanh nghiệp và nhà đầu tư: đề xuất kênh, nội dung và lịch chạy trọn gói.").format("o_full"),
         o(6, "mkt_social_owner", "awareness",
           "Bài đăng fanpage giới thiệu nhà kho KCX Tân Thuận cho khách doanh nghiệp logistics.").format("o_paid"),
         o(6, "mkt_banner_owner", "awareness",
           "Banner ở trang danh sách nhóm Kho xưởng trong 10 ngày; bên em có sẵn ảnh flycam và bản vẽ mặt bằng.").format("o_req"),

         as_uid(ADMIN),
         "select pg_temp.ok(admin_mkt_order_quote(:'o_banner', 15000000, 'Vị trí Banner đầu trang danh sách, 14 ngày.', 14));",
         "select pg_temp.ok(admin_mkt_order_quote(:'o_prog', 32000000, 'Trọn gói 14 ngày: banner đầu trang danh sách, bài "
         "fanpage của sàn và nhắc hạn đăng ký; báo cáo kết quả cuối đợt.', 7));",
         "select pg_temp.ok(admin_mkt_order_quote(:'o_cancel_owner', 9000000, 'Banner trang chủ 7 ngày, sàn thiết kế theo ảnh hồ sơ.', 14));",
         "select pg_temp.ok(admin_mkt_order_quote(:'o_expired', 12000000, 'Banner đầu trang danh sách 10 ngày, kèm báo cáo lượt xem theo ngày.', 7));",
         as_uid(OWNER),
         f"select pg_temp.ok(pay_owner_mkt_order(:'o_banner', {lit(TXN_BANNER)}, 15000000));",
         f"select pg_temp.ok(pay_owner_mkt_order(:'o_prog', {lit(TXN_FULL)}, 32000000));",
         "select pg_temp.ok(owner_mkt_order_cancel(:'o_cancel_owner', 'Đã chọn gói trọn chiến dịch cho tài sản này nên không cần banner riêng.'));",
         as_uid(ADMIN),
         "select pg_temp.ok(admin_mkt_order_start(:'o_banner'));",
         "select pg_temp.ok(admin_mkt_order_start(:'o_social'));",
         "select pg_temp.ok(admin_mkt_order_start(:'o_prog'));",
         "select pg_temp.ok(admin_mkt_order_start(:'o_feat'));",
         "select pg_temp.ok(admin_mkt_order_cancel(:'o_cancel_admin', 'Tổ chức đấu giá tạm hoãn mở hồ sơ để bổ sung giấy tờ "
         "pháp lý; sàn huỷ đơn và trả lại quyền lợi đã dùng.'));",

         AS_SYSTEM, f"""
insert into advertisements (id, name, is_test, position_id, nav_type, nav_url, start_type, start_at, end_type, end_at,
  status, view_count, click_count, created_by, created_at, updated_at)
values ({lit(AD)}, 'Nhà phố Huỳnh Tấn Phát Q7 — đấu lần 3 (dữ liệu minh hoạ)', true, {lit(BANNER_POSITION)}, 'link',
  {lit('/listings/' + lid(1))}, 'scheduled', timestamptz {lit(at(-14, 0))}, 'scheduled', timestamptz {lit(at(-1, 23, 59))},
  'ended', 4820, 96, {lit(ADMIN)}, timestamptz {lit(at(-14, 9))}, timestamptz {lit(at(-1, 23, 59))}),
       ({lit(AD2)}, 'Đất KDC Phú Mỹ Q7 — sắp hết hạn đăng ký (dữ liệu minh hoạ)', true, {lit(BANNER_POSITION)}, 'link',
  {lit('/listings/' + lid(3))}, 'scheduled', timestamptz {lit(at(-6, 0))}, 'scheduled', timestamptz {lit(at(7, 23, 59))},
  'active', 2140, 37, {lit(ADMIN)}, timestamptz {lit(at(-6, 9))}, timestamptz {lit(at(0, 8))});""",
         as_uid(ADMIN),
         f"select pg_temp.ok(admin_mkt_order_link(:'o_banner', 'advertisement', {lit(AD)}));",
         f"select pg_temp.ok(admin_mkt_order_link(:'o_prog', 'advertisement', {lit(AD2)}));",
         "select pg_temp.ok(admin_mkt_order_complete(:'o_banner', 'Banner chạy 14 ngày ở đầu trang danh sách: 4,820 lượt "
         "hiển thị, 96 lượt bấm vào tài sản.', null));",
         "select pg_temp.ok(admin_mkt_order_complete(:'o_social', 'Bài giới thiệu căn hộ đăng trên fanpage của sàn: 12,400 "
         "lượt tiếp cận, 318 lượt tương tác, 41 lượt bấm về trang tài sản.', 'https://www.facebook.com/taisandaugia.vn/posts/demo-sunrise-city'));",
         "select pg_temp.ok(admin_mkt_order_quote(:'o_full', 45000000, 'Trọn gói 21 ngày: banner trang chủ, 2 bài đăng "
         "mạng xã hội của sàn, email tới nhà đầu tư đã đăng ký nhận tin; báo cáo kết quả cuối đợt.', 30));",

         AS_SYSTEM,
         # Doanh thu admin: đơn demo không được cộng vào báo cáo doanh thu thật.
         "delete from orders where id = (select revenue_order_id from owner_mkt_orders where id = :'o_banner');",
         # Tin nổi bật: giữ mốc trên ĐƠN (kết quả đọc từ đơn) nhưng không đẩy tin minh hoạ lên đầu trang chủ thật.
         f"update listings set featured = false, featured_until = null where id = {lit(lid(1))};",
         f"""
update owner_mkt_orders set created_at = timestamptz {lit(at(-15, 9))}, quoted_at = timestamptz {lit(at(-15, 14))},
  quote_expires_at = timestamptz {lit(at(-1, 14))}, paid_at = timestamptz {lit(at(-14, 8))},
  started_at = timestamptz {lit(at(-14, 9))}, completed_at = timestamptz {lit(at(-1, 18))},
  result_summary = result_summary || jsonb_build_object('completed_at', timestamptz {lit(at(-1, 18))})
 where id = :'o_banner';
update owner_mkt_orders set created_at = timestamptz {lit(at(-2, 16))}, quoted_at = timestamptz {lit(at(-1, 10))},
  quote_expires_at = timestamptz {lit(at(29, 10))}
 where id = :'o_full';
update owner_mkt_orders set created_at = timestamptz {lit(at(-17, 10))}, paid_at = timestamptz {lit(at(-17, 10))},
  started_at = timestamptz {lit(at(-16, 9))}, completed_at = timestamptz {lit(at(-13, 17))},
  result_summary = result_summary || jsonb_build_object('completed_at', timestamptz {lit(at(-13, 17))})
 where id = :'o_social';
update owner_mkt_orders set created_at = timestamptz {lit(at(-9, 15))}, quoted_at = timestamptz {lit(at(-8, 11))},
  quote_expires_at = timestamptz {lit(at(-1, 11))}, paid_at = timestamptz {lit(at(-7, 20))},
  started_at = timestamptz {lit(at(-6, 9))}
 where id = :'o_prog';
update owner_mkt_orders set created_at = timestamptz {lit(at(-8, 9))}, quoted_at = timestamptz {lit(at(-7, 15))},
  quote_expires_at = timestamptz {lit(at(7, 15))}, cancelled_at = timestamptz {lit(at(-2, 17))}
 where id = :'o_cancel_owner';
update owner_mkt_orders set created_at = timestamptz {lit(at(-13, 10))}, quoted_at = timestamptz {lit(at(-12, 16))},
  quote_expires_at = timestamptz {lit(at(-5, 16))}
 where id = :'o_expired';
update owner_mkt_orders set created_at = timestamptz {lit(at(-5, 14))}, paid_at = timestamptz {lit(at(-5, 14))},
  cancelled_at = timestamptz {lit(at(-4, 10))}, refunded_at = case when refunded_at is not null then timestamptz {lit(at(-4, 10))} end
 where id = :'o_cancel_admin';
update owner_mkt_orders set created_at = timestamptz {lit(at(-2, 8))}, paid_at = timestamptz {lit(at(-2, 8))},
  started_at = timestamptz {lit(at(-2, 9))}, featured_from = timestamptz {lit(at(-2, 9))},
  featured_until = timestamptz {lit(at(5, 9))}
 where id = :'o_feat';
update owner_mkt_orders set created_at = timestamptz {lit(at(-1, 16, 20))}, paid_at = timestamptz {lit(at(-1, 16, 20))}
 where id = :'o_paid';
update owner_mkt_orders set created_at = timestamptz {lit(at(0, 8, 30))} where id = :'o_req';
update owner_mkt_orders set updated_at = greatest(created_at, quoted_at, paid_at, started_at, completed_at, cancelled_at)
 where workspace_id = {lit(W)} and listing_id = any({lit(DEMO_IDS)}::uuid[]);"""]
    return s


def orders_teardown_sql():
    """Gỡ đơn Giao việc demo: trả lại lượt gói / credit chưa hoàn (để số dư và hạn mức thật không hao dần
    qua mỗi lần seed lại), xoá đơn + banner + giao dịch VNPay mô phỏng."""
    scope = f"workspace_id = {lit(W)} and listing_id = any({lit(DEMO_IDS)}::uuid[])"
    return [f"""
select public._owner_sub_reverse(subscription_usage_id, 'Hoàn lượt — gỡ đơn truyền thông demo ' || code)
  from owner_mkt_orders where {scope} and subscription_usage_id is not null and refunded_at is null;
insert into user_credits (user_id, balance)
select paid_by, sum(credit_cost) from owner_mkt_orders
 where {scope} and payment_method = 'credits' and coalesce(credit_cost, 0) > 0 and paid_by is not null and refunded_at is null
 group by paid_by
on conflict (user_id) do update set balance = user_credits.balance + excluded.balance, updated_at = now();
insert into credit_transactions (user_id, type, description, credit_delta, variant_key, service_variant_id)
select paid_by, 'owner_mkt_order_refund', 'Hoàn credit — gỡ đơn truyền thông demo ' || code, credit_cost, variant_key, service_variant_id
  from owner_mkt_orders
 where {scope} and payment_method = 'credits' and coalesce(credit_cost, 0) > 0 and paid_by is not null and refunded_at is null;""",
            f"delete from orders where id in (select revenue_order_id from owner_mkt_orders where {scope});",
            f"delete from owner_mkt_orders where {scope};",
            f"delete from advertisements where id in ({lit(AD)}, {lit(AD2)});",
            "delete from payment_claims where txn_ref like 'DEMO-M6-%';"]


def orders_only_sql(commit):
    """--orders: chỉ dựng lại phần Giao việc cho sàn (giữ chiến dịch, link, phễu, báo cáo)."""
    s = list(od.SQL_HEADER) + [AS_SYSTEM] + orders_teardown_sql() + impact_teardown_sql() + orders_sql() + impact_sql()
    s += [AS_SYSTEM, AUDIT_CLEANUP, as_uid(OWNER), "set local role authenticated;", f"""
select code, variant_key, status, payment_method, coalesce(refund_note, '') as hoan, created_at::date as tao
  from owner_mkt_orders where workspace_id = {lit(W)} order by created_at;""", "reset role;"]
    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def multi_campaign_sql(commit):
    """--campaign: chỉ dựng lại các chiến dịch nhiều tài sản (C5 — trạng thái cuối 'ended'), giữ phần còn lại."""
    multi = [c for c in CAMPAIGNS if isinstance(c[1], list)]
    names = "{" + ",".join(json.dumps(c[2], ensure_ascii=False) for c in multi) + "}"
    s = list(od.SQL_HEADER) + [AS_SYSTEM, f"""
delete from posting_share_links where campaign_id in
  (select id from owner_mkt_campaigns where workspace_id = {lit(W)} and name = any({lit(names)}::text[]));
delete from owner_mkt_campaigns where workspace_id = {lit(W)} and name = any({lit(names)}::text[]);""",
         "alter table owner_mkt_audit disable trigger owner_mkt_audit_no_update;"]
    s += campaign_sql(multi) + hits_sql(single=[], with_hs=False)
    s += [AS_SYSTEM, "alter table owner_mkt_audit enable trigger owner_mkt_audit_no_update;", AUDIT_CLEANUP,
          as_uid(OWNER), "set local role authenticated;", f"""
select c.name, c.status, cardinality(c.listing_ids) as tai_san, c.channels, c.sent_at::date as gui, c.updated_at::date as ket_thuc,
       count(k.id) as link, sum(k.view_count) as luot_xem
  from owner_mkt_campaigns c left join posting_share_links k on k.campaign_id = c.id
 where c.workspace_id = {lit(W)} group by c.id order by c.created_at;""", "reset role;"]
    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def report_sql():
    month = (T + timedelta(days=-7)).replace(day=1).isoformat()
    return [as_uid(OWNER), f"""
insert into owner_report_snapshots (id, workspace_id, branch_id, period_type, period_start, notes, plan_note)
values ({lit(REPORT)}, {lit(W)}, {lit(BRANCH)}, 'month', {lit(month)},
  'Dữ liệu minh hoạ — Chi nhánh Quận 7 bán căn hộ Sunrise City sau đợt truyền thông qua Zalo và email (5 người tham gia). Nhà phố Huỳnh Tấn Phát đã 2 phiên không thành; chi nhánh đẩy truyền thông qua mọi kênh và đặt banner trên sàn trước phiên đấu lần 3.',
  'Theo dõi số hồ sơ đăng ký phiên đấu lần 3 nhà phố Huỳnh Tấn Phát; duyệt và gửi chiến dịch đất KDC Phú Mỹ trước hạn đăng ký.');
select pg_temp.ok(owner_finalize_report({lit(REPORT)}));
select (pg_temp.ok(owner_share_report({lit(REPORT)}, 30)))->>'token' as share_tok \\gset""",
            AS_ANON] + ["select (get_shared_owner_report(:'share_tok'))->>'ok';"] * 3 + [AS_SYSTEM]


def checks_sql():
    ids = "{" + ",".join(lid(a[0]) for a in ASSETS) + "}"
    return [as_uid(OWNER), "set local role authenticated;", f"""
\\echo '── Kiểm tra dưới quyền secsosoo ──'
select 'phễu 30 ngày' as k, (f->'totals')::text as v
  from (select owner_mkt_funnel({lit(W)}, {lit(day(-29))}, {lit(day(0))}) f) x
union all select 'không xác định nguồn', (owner_mkt_funnel({lit(W)}, {lit(day(-29))}, {lit(day(0))})->'unattributed')::text
union all select 'chiến dịch theo trạng thái', string_agg(status || ':' || n, ' ') from
  (select status, count(*) n from owner_mkt_campaigns where workspace_id = {lit(W)} group by status) c
union all select 'link Hồ sơ online / lượt xem / mua hồ sơ', count(*) || ' / ' || sum(view_count) || ' / ' || sum(cta_dossier_count)
  from posting_share_links where workspace_id = {lit(W)}
union all select 'đơn giao việc', string_agg(variant_key || ':' || status, ' ') from owner_mkt_orders where workspace_id = {lit(W)}
union all select 'đăng ký trên sàn (A1)', (select registrations::text from owner_listing_registrations({lit(W)}) where listing_id = {lit(lid(1))})
union all select 'báo cáo chi nhánh có phần truyền thông', (payload ? 'marketing')::text from owner_report_snapshots where id = {lit(REPORT)}
union all select 'tài sản demo đã nhận', count(*)::text from asset_owner_claims where workspace_id = {lit(W)} and listing_id = any({lit(ids)}::uuid[]);""",
            "reset role;"]


# :has_hs — hồ sơ HS-0070 có trong Trạm và đang mở chia sẻ được (đã duyệt, chưa huỷ).
HAS_HS = (f"select exists (select 1 from asset_postings where id = {lit(DEMO_POSTING)} and workspace_id = {lit(W)} "
          f"and review_status = 'approved' and status <> 'cancelled') as has_hs \\gset")

AUDIT_CLEANUP = f"""
-- Nhật ký hoạt động: thao tác của script không phải thao tác của người dùng ⇒ bỏ các dòng
-- giao dịch này vừa ghi (now() cố định trong một giao dịch).
alter table owner_audit_log disable trigger owner_audit_log_immutable;
delete from owner_audit_log where created_at = now();
alter table owner_audit_log enable trigger owner_audit_log_immutable;"""


def seed_sql(commit):
    s = list(od.SQL_HEADER)
    s.append(f"""
select case when exists (select 1 from owner_mkt_campaigns where workspace_id = {lit(W)} and {lit(lid(1))} = any(listing_ids))
  then pg_temp.ok('{{"ok":false,"reason":"da_seed_roi_chay_teardown_truoc"}}') end;""")
    s.append(HAS_HS)
    s.append("alter table owner_mkt_audit disable trigger owner_mkt_audit_no_update;")
    s += permanent_sql()

    # Chi nhánh "Chi nhánh Quận 7" + 5 tài sản còn lại + claim của cả 6
    s += [AS_SYSTEM, f"""
insert into workspace_branches (id, workspace_id, asset_owner_id, display_name, contact_phone, notes)
values ({lit(BRANCH)}, {lit(W)}, {lit(BANK)}, 'Chi nhánh Quận 7', '0283 777 0707', 'Chi nhánh minh hoạ cho bộ demo Truyền thông.');"""]
    s += [listing_sql(*a) for a in ASSETS[1:]]
    for a in ASSETS:
        n = a[0]
        s.append(f"""
insert into asset_owner_claims (id, workspace_id, listing_id, asset_owner_id, confidence_score, match_basis, matched_name,
  status, confirmed_by, confirmed_at, created_at)
values ({lit(sid('0b02', n))}, {lit(W)}, {lit(lid(n))}, {lit(BANK)}, 1.000, 'auto_name', {lit(BANK_NAME)}, 'confirmed',
  {lit(OWNER)}, timestamptz {lit(at(-29 if n > 1 else -89, 9))}, timestamptz {lit(at(-29 if n > 1 else -89, 8))});""")

    s += outcomes_sql()
    s += campaign_sql()
    s += own_links_sql()
    s += hits_sql()
    s += saves_sql()
    s += attribution_sql()
    s += orders_sql()
    s += impact_sql()
    s += [AS_SYSTEM, f"update asset_owner_workspaces set is_demo = true where id = {lit(W)};"]
    s += report_sql()
    s += [AS_SYSTEM, "alter table owner_mkt_audit enable trigger owner_mkt_audit_no_update;", AUDIT_CLEANUP]
    s += checks_sql()
    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def teardown_sql(with_session):
    marketing_ids = "{" + ",".join(lid(a[0]) for a in ASSETS[1:]) + "}"
    all_ids = "{" + ",".join(lid(a[0]) for a in ASSETS) + "}"
    buyer_ids = "{" + ",".join(b[0] for b in BUYERS) + "}"
    s = ["\\set ON_ERROR_STOP 1", "begin;",
         f"delete from owner_report_snapshots where id = {lit(REPORT)};",
         *orders_teardown_sql(),
         *impact_teardown_sql(),
         # link → sự kiện CASCADE; hồ sơ tham gia / sự kiện lưu mang link → SET NULL. Xoá link trước
         # chiến dịch (campaign_id SET NULL thì không còn nhận ra link hồ sơ của C4).
         f"delete from posting_share_links where workspace_id = {lit(W)} and (listing_id = any({lit(all_ids)}::uuid[]) "
         f"or label = {lit(HS_LINK[2])} or campaign_id in (select id from owner_mkt_campaigns "
         f"where workspace_id = {lit(W)} and listing_ids && {lit(all_ids)}::uuid[]));",
         f"delete from owner_mkt_campaigns where workspace_id = {lit(W)} and listing_ids && {lit(all_ids)}::uuid[];",
         # Kho lưu trữ link /l/ cũ (trước 20261004210100).
         f"delete from owner_mkt_links where workspace_id = {lit(W)} and listing_id = any({lit(all_ids)}::uuid[]);",
         f"delete from analytics_events where user_id = any({lit(buyer_ids)}::uuid[]) and feature_key = 'save_asset';",
         f"delete from user_asset_actions where user_id = any({lit(buyer_ids)}::uuid[]);",
         "delete from owner_asset_outcomes where id::text like '5eed0b04-%';",   # kéo theo sổ thu chi
         "delete from listing_price_sessions where id::text like '5eed0b03-%';",
         "delete from asset_owner_claims where id::text like '5eed0b02-%';",
         f"delete from listings where id = any({lit(marketing_ids)}::uuid[]);",
         f"delete from workspace_branches where id = {lit(BRANCH)};",
         f"update asset_owner_workspaces set is_demo = false where id = {lit(W)};"]
    if with_session:
        s += ["alter table auction_session_items disable trigger auction_session_items_guard_delete;",
              "alter table auction_session_items disable trigger auction_session_items_bidding_lock;",
              f"delete from auction_bidding_contracts where session_id = {lit(SESSION)};",
              f"delete from auction_session_items where session_id = {lit(SESSION)};",
              f"delete from auction_sessions where id = {lit(SESSION)};",
              "alter table auction_session_items enable trigger auction_session_items_guard_delete;",
              "alter table auction_session_items enable trigger auction_session_items_bidding_lock;",
              f"delete from listings where id = {lit(lid(1))};",
              f"delete from asset_owners where id = {lit(BANK)};"]
    s += [AUDIT_CLEANUP, "commit;"]
    return "\n".join(s) + "\n"


# ─── Tài khoản người mua demo ────────────────────────────────────────────────
def ensure_buyers():
    have = {}
    for line in psql("select email || '|' || id from auth.users where email like 'demo.nguoimua.%@example.com';", rows=True):
        email, id_ = line.split("|")
        have[email] = id_
    created = []
    for id_, email, name in BUYERS:
        if email in have:
            if have[email] != id_:
                sys.exit(f"{email} đã tồn tại với id khác ({have[email]}) — gỡ tay trước khi seed.")
            continue
        pw = secrets.token_urlsafe(12)
        res = api("POST", "/auth/v1/admin/users", {
            "id": id_, "email": email, "password": pw, "email_confirm": True,
            "user_metadata": {"name": name, "terms_accepted": True, "terms_version": od.TERMS_VERSION,
                              "privacy_version": od.TERMS_VERSION, "notifications_enabled": False},
        })
        if res.get("id") != id_:
            sys.exit(f"GoTrue không nhận id cố định cho {email} (trả {res.get('id')}).")
        created.append(f"{email}\t{pw}\t{name}")
        print(f"  + người mua {email}")
    if created:
        with ACCOUNTS_FILE.open("a", encoding="utf-8") as f:
            f.write("\n".join(created) + "\n")
    print(f"  người mua demo: {len(BUYERS)} ({len(created)} mới)")


def main():
    args = set(sys.argv[1:])
    if "--teardown" in args:
        with_session = "--with-session" in args
        print("Gỡ bộ demo Truyền thông…" + (" (cả phiên [DEMO] + người mua)" if with_session else " (giữ phiên [DEMO])"))
        psql(teardown_sql(with_session))
        if with_session:
            for id_, email, _n in BUYERS:
                try:
                    api("DELETE", f"/auth/v1/admin/users/{id_}")
                    print(f"  - người mua {email}")
                except RuntimeError as e:
                    if "404" not in str(e):
                        raise
            if ACCOUNTS_FILE.exists():
                ACCOUNTS_FILE.unlink()
        print("Xong.")
        return
    commit = "--dry-run" not in args
    if "--campaign" in args:
        print(f"Dựng lại chiến dịch nhiều tài sản (hôm nay {T.isoformat()})…" + ("" if commit else " (dry-run, ROLLBACK)"))
        print(psql(multi_campaign_sql(commit)))
        return
    if "--orders" in args:
        print(f"Dựng lại đơn Giao việc cho sàn (hôm nay {T.isoformat()})…" + ("" if commit else " (dry-run, ROLLBACK)"))
        print(psql(orders_only_sql(commit)))
        return
    print(f"Seed bộ demo Truyền thông (hôm nay {T.isoformat()})…" + ("" if commit else " (dry-run, ROLLBACK)"))
    ensure_buyers()
    print(psql(seed_sql(commit)))
    print("Xong." if commit else "Dry-run xong — không ghi gì vào DB (tài khoản người mua vẫn giữ).")


if __name__ == "__main__":
    main()
