"""Dữ liệu demo ĐẦY ĐỦ cho Trạm Điều Hành của chủ tài sản secsosoo@gmail.com.

Lấp mọi màn /chu-tai-san/* còn trống của không gian "ngân hàng" (4ca4be7b…):
  • Kết quả phiên   — ~30 lượt tự khai: bán / không thành / hoãn / rút, đấu lại 2–3 lượt,
                      1 lệch số với tổ chức, 3 biên bản PDF, cả tài sản ngoài sàn
  • Dòng tiền       — sổ thu chi đặt trước / thanh toán / phí / hoàn trả; 2 khoản quá hạn,
                      1 người trúng bỏ cọc; 2 phiên đấu lại tháng 10 cho dự báo
  • Chỉ tiêu        — năm / quý / tháng cho cả đơn vị + 3 chi nhánh
  • Báo cáo định kỳ — 4 bản đã chốt (1 bản có link chia sẻ /r/:token), 2 bản nháp
  • Thành viên      — 2 cán bộ (1 người giới hạn chi nhánh) + 1 người xem + 2 lời mời chờ
  • Liên kết        — không gian gắn pháp nhân BIDV làm TRỤ SỞ; 2 trạm con (BIDV Cầu Giấy,
                      BAMC) đã liên kết ⇒ sidebar thành "Tháp Điều Hành"
  • Số hoá tài sản  — 3 hồ sơ của không gian (nháp / chờ duyệt / đã duyệt)

Mọi dòng seed có id tiền tố 5eed…; 5 tài khoản demo đuôi @example.com. Ghi đi qua trigger /
RPC thật bằng cách đổi `request.jwt.claims` sang từng người trong MỘT giao dịch.

    python3 scripts/seed-owner-demo.py              # seed (dừng nếu đã seed)
    python3 scripts/seed-owner-demo.py --dry-run    # chạy hết SQL rồi ROLLBACK
    python3 scripts/seed-owner-demo.py --teardown   # gỡ sạch

Đọc SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_URI từ .env.local. Mật khẩu tài khoản demo ghi vào
scripts/owner-demo-accounts.local (gitignore qua *.local).
"""
import io
import json
import os
import secrets
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
REF = "vewtnkewyawmkpeymdot"
SUPABASE_URL = f"https://{REF}.supabase.co"
POOLER = "aws-0-ap-southeast-1.pooler.supabase.com"
ACCOUNTS_FILE = REPO / "scripts" / "owner-demo-accounts.local"
TERMS_VERSION = "2026-05-17"
DECLARATION_VERSION = "2026-09-06"


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
OWNER = "ae9bfef5-2694-466f-a97e-5efdf138ac43"   # secsosoo@gmail.com — Nguyễn Hoàng Long
ADMIN = "95d7e29c-f1f5-4361-a3af-e9aeaf792f3f"   # harleyngx — người duyệt KYC chi nhánh
W = "4ca4be7b-34df-4cdd-b0b5-368d0cb78ae3"       # không gian "ngân hàng" của secsosoo
BIDV = "ef711eff-3420-4c4c-b5a4-9962fa8bdc3d"    # pháp nhân trụ sở gắn cho W
CAUGIAY = "10c1db72-b4ea-461d-ad89-1d8900b85452"  # BIDV – CN Cầu Giấy (con của BIDV)
BAMC = "4ac1b40b-154f-4729-be2c-6bda643ffbc4"    # Cty QLN & KTTS BIDV (con của BIDV)

BR_HN = "aa1ecdbe-5644-448e-85e0-8c57f586f257"   # "BIDV – Chi nhánh Hà Nội"
BR_HCM = "b30ca77b-41c5-4852-b5f3-c286f8c411f1"  # "Vietcombank – Chi nhánh TP.HCM"
BR_DN = "b6913228-35d7-459d-87f5-7333906edd38"   # "VietinBank – Chi nhánh Đà Nẵng"
BR_BD = "c2968573-697e-4429-b4c6-bea30a64a2df"   # "ACB – Chi nhánh Bình Dương"

ORG_VN = "d9572b14-c8e5-4d35-8f2f-3c1f6ab6706b"   # Công ty Đấu giá Hợp danh Việt Nam
ORG_HCM = "a1111111-1111-1111-1111-111111111111"  # TT DV ĐGTS TP. Hồ Chí Minh
ORG_MN = "a3333333-3333-3333-3333-333333333333"   # Công ty Đấu giá Hợp danh Miền Nam
ORG_HN = "a4444444-4444-4444-4444-444444444444"   # TT DV ĐGTS Hà Nội

L = {  # tin đăng mà W đã claim (8 ký tự đầu = "Mã" trên UI)
    "7d3538a4": "7d3538a4-33c4-4577-89d4-bc50bc204d73",
    "c7d4267a": "c7d4267a-f4ad-484c-a958-cc295048e8e3",
    "d4945bb7": "d4945bb7-bf3b-4de4-a42e-42abd7e65085",
    "34f9b62a": "34f9b62a-eb99-40ba-a0d0-fa6de71d8e41",
    "7817b6c9": "7817b6c9-7c4a-41d6-a83f-27da27be9c6f",
    "a7147ce1": "a7147ce1-3c61-4271-8079-c5a4d5a3351d",
    "e6c5b953": "e6c5b953-665b-4c36-a4fb-6afc456f03aa",
    "54d0365e": "54d0365e-3b58-4437-b66a-ae893ebad3f8",
    "afce62aa": "afce62aa-8774-4f97-bd8e-b03d51ac6d05",
    "664127b3": "664127b3-b2ad-4120-b0a0-7269761e03b1",
    "0c51ffbf": "0c51ffbf-af86-45eb-92c1-ba1e6d433331",
    "c0b82ebe": "c0b82ebe-4106-47dc-ad44-d472fc58c8f2",
    "07604f48": "07604f48-e22e-464a-942c-2d7123af4e12",
    "4bae607e": "4bae607e-c9c4-4b0e-aa07-193a8346f1fa",
    "70058f98": "70058f98-f40f-463a-aa55-aaac7ed11d3a",
    "3fc961ec": "3fc961ec-a362-45fa-bdd7-52f7ba30eb73",
    "bee8ddc6": "bee8ddc6-6794-4317-bb52-11ba45cd8b0c",
    "82796f86": "82796f86-77b3-4939-af3a-eec3e5ef8990",
    # tin của 2 pháp nhân con — trạm con tự claim khi duyệt KYC (match_scope = entity)
    "cf584000": "cf584000-fe39-4762-89fa-0fee2eb9ca69",
    "d91e92d7": "d91e92d7-9678-4255-a897-48f07bd0de23",
    "fafb4175": "fafb4175-93a6-49fd-aad3-6013037acdb1",
    "76ace1b6": "76ace1b6-1e0e-4f1d-9f88-91aa1c4d4626",
    "0621b046": "0621b046-78f9-4917-bf67-0cb40feeaad5",
    "32487df8": "32487df8-46ae-46c1-bdaf-04d6a0299b81",
    "eb2da77d": "eb2da77d-8d52-4497-a8c0-b1979e8e2902",
    "e8213839": "e8213839-43e3-4353-9abe-d07f7484ffc7",
}

# Hai tin đấu lại trong tháng 10 ⇒ "Phiên sắp tới", dự báo dòng tiền, mục Kế hoạch của báo cáo.
# Giá trị gốc để --teardown trả lại (None = khoá không có).
RESCHEDULE = [
    (L["afce62aa"], "2026-10-14T09:00:00+07:00", "2026-10-09T17:00:00+07:00",
     "2025-12-21T09:00:00+07:00", None),
    (L["82796f86"], "2026-10-22T09:00:00+07:00", "2026-10-17T17:00:00+07:00",
     "2026-07-27T09:00:00+07:00", "2026-07-22T17:00:00+07:00"),
]


def sid(group, n):
    return f"5eed{group}-0000-4000-8000-{n:012d}"


# key, id, email, tên hiển thị
USERS = [
    ("m1", sid("00a0", 1), "demo.tran.minh.quan@example.com", "Trần Minh Quân"),
    ("m2", sid("00a0", 2), "demo.pham.thu.trang@example.com", "Phạm Thu Trang"),
    ("m3", sid("00a0", 3), "demo.do.hai.yen@example.com", "Đỗ Hải Yến"),
    ("b1", sid("00a0", 4), "demo.bidv.caugiay@example.com", "Nguyễn Văn Thành"),
    ("b2", sid("00a0", 5), "demo.bamc@example.com", "Vũ Ngọc Mai"),
]
U = {k: i for k, i, _, _ in USERS}
U["owner"] = OWNER
PENDING_INVITES = [
    ("demo.le.hoang.nam@example.com", "staff", [BR_HCM]),
    ("demo.kiem.soat.noi.bo@example.com", "viewer", None),
]

KYC_C1 = sid("0006", 1)
KYC_C2 = sid("0006", 2)

# ─── Kết quả phiên (owner_asset_outcomes) + sổ thu chi ─────────────────────────
# cash: (kind, amount, day, note)
OUTCOMES = []


def outcome(n, ws, by, rnd, day, result, *, listing=None, title=None, cat=None, branch=None,
            org=None, start=None, win=None, part=None, reason=None, due=None, defaulted=False,
            evidence=False, cash=()):
    OUTCOMES.append(dict(
        id=sid("0001", n), ws=ws, by=by, round=rnd, day=day, outcome=result,
        listing=L[listing] if listing else None, title=title, cat=cat, branch=branch, org=org,
        start=start, win=win, part=part, reason=reason, due=due, defaulted=defaulted,
        evidence=evidence, cash=list(cash),
    ))


DEP, PAY, FEE, REF_ = "deposit", "payment", "fee", "refund"
WS_C1, WS_C2 = ":ws_c1", ":ws_c2"   # id trạm con chỉ biết sau khi duyệt KYC ⇒ biến psql

# — Không gian W · chi nhánh "BIDV – CN Hà Nội" (Trần Minh Quân, cán bộ giới hạn chi nhánh)
outcome(1, W, "m1", 1, "2025-11-15", "sold", listing="7d3538a4", start=8_500_000_000,
        win=10_030_000_000, part=6, cash=[
            (DEP, 1_700_000_000, "2025-11-15", "Chuyển tiền đặt trước của người trúng"),
            (PAY, 8_330_000_000, "2025-12-12", "Thanh toán đủ theo HĐMB số 118/2025"),
            (FEE, 150_430_000, "2025-12-15", "Thù lao dịch vụ đấu giá")])
outcome(2, W, "m1", 1, "2026-01-02", "sold", listing="c7d4267a", start=29_600_000_000,
        win=31_250_000_000, part=4, evidence=True, cash=[
            (DEP, 5_920_000_000, "2026-01-02", None),
            (PAY, 25_330_000_000, "2026-01-30", "Người mua vay BIDV thanh toán phần còn lại"),
            (FEE, 280_000_000, "2026-02-05", "Thù lao dịch vụ đấu giá")])
outcome(3, W, "m1", 1, "2026-03-09", "sold", listing="d4945bb7", start=8_456_000_000,
        win=8_900_000_000, part=5, cash=[
            (DEP, 1_690_000_000, "2026-03-09", None),
            (PAY, 7_210_000_000, "2026-04-06", None)])
outcome(4, W, "m1", 1, "2026-07-12", "sold", listing="34f9b62a", start=39_440_000_000,
        win=40_100_000_000, part=3, due="2026-10-10", cash=[
            (DEP, 7_890_000_000, "2026-07-12", "Đã gia hạn thanh toán tới 10/10 theo đề nghị của người mua")])
outcome(5, W, "m1", 1, "2026-04-28", "sold", listing="7817b6c9", start=44_920_000_000,
        win=45_600_000_000, part=4, cash=[
            (DEP, 8_980_000_000, "2026-04-28", None),
            (PAY, 20_000_000_000, "2026-05-25", "Thanh toán đợt 1"),
            (PAY, 16_620_000_000, "2026-06-20", "Thanh toán đợt 2 — tất toán"),
            (FEE, 350_000_000, "2026-06-25", "Thù lao dịch vụ đấu giá")])
# — "Vietcombank – CN TP.HCM" (Phạm Thu Trang, cán bộ toàn đơn vị)
outcome(6, W, "m2", 1, "2026-01-08", "unsold", listing="a7147ce1", start=4_130_000_000, part=0,
        reason="no_registrants")
outcome(7, W, "m2", 2, "2026-03-19", "unsold", listing="a7147ce1", start=3_920_000_000, part=1,
        reason="single_bidder")
outcome(8, W, "m2", 3, "2026-05-18", "unsold", listing="a7147ce1", start=3_720_000_000, part=0,
        reason="no_registrants", cash=[
            (FEE, 25_000_000, "2026-05-20", "Chi phí đăng thông báo đấu giá lại lần 3")])
outcome(9, W, "m2", 1, "2026-03-19", "sold", listing="e6c5b953", start=5_995_000_000,
        win=6_350_000_000, part=3, cash=[
            (DEP, 1_200_000_000, "2026-03-19", None),
            (PAY, 5_150_000_000, "2026-04-15", None)])
# — "VietinBank – CN Đà Nẵng"
outcome(10, W, "m2", 1, "2026-07-07", "sold", listing="54d0365e", start=13_420_000_000,
        win=14_100_000_000, part=5, due="2026-08-06", cash=[
            (DEP, 2_680_000_000, "2026-07-07", None),
            (PAY, 5_000_000_000, "2026-08-05", "Người mua xin trả chậm phần còn lại — chưa được chấp thuận")])
outcome(11, W, "m2", 1, "2025-12-21", "unsold", listing="afce62aa", start=46_790_000_000, part=0,
        reason="no_registrants")
outcome(12, W, "owner", 1, "2026-05-18", "sold", listing="664127b3", start=9_810_000_000,
        win=10_200_000_000, part=4, cash=[
            (DEP, 1_960_000_000, "2026-05-18", None),
            (PAY, 8_240_000_000, "2026-06-12", None)])
# — "ACB – CN Bình Dương"
outcome(13, W, "owner", 1, "2026-01-08", "unsold", listing="0c51ffbf", start=45_880_000_000,
        part=0, reason="no_registrants")
outcome(14, W, "owner", 2, "2026-03-19", "unsold", listing="0c51ffbf", start=43_580_000_000,
        part=1, reason="single_bidder")
outcome(15, W, "owner", 3, "2026-05-18", "sold", listing="0c51ffbf", start=41_290_000_000,
        win=41_500_000_000, part=2, due="2026-06-17", cash=[
            (DEP, 8_260_000_000, "2026-05-18", None),
            (PAY, 15_000_000_000, "2026-06-17", "Thanh toán đợt 1 — đã gửi công văn đôn đốc phần còn lại")])
outcome(16, W, "owner", 1, "2026-01-14", "sold", listing="c0b82ebe", start=16_890_000_000,
        win=17_350_000_000, part=3, defaulted=True, cash=[
            (DEP, 3_380_000_000, "2026-01-14", "Tiền đặt trước không hoàn trả do người trúng bỏ cọc")])
outcome(17, W, "owner", 1, "2026-04-18", "sold", listing="07604f48", start=41_480_000_000,
        win=42_300_000_000, part=5, evidence=True, cash=[
            (DEP, 8_300_000_000, "2026-04-18", None),
            (PAY, 34_100_000_000, "2026-05-15", None),
            (REF_, 100_000_000, "2026-05-20", "Hoàn trả phần người mua chuyển thừa"),
            (FEE, 320_000_000, "2026-05-22", "Thù lao dịch vụ đấu giá")])
# Lệch 1,8% với số tổ chức đấu giá báo (8,792,336,264₫) ⇒ thẻ "Xử lý lệch"
outcome(18, W, "m2", 1, "2026-03-21", "sold", listing="4bae607e", start=8_792_000_000,
        win=8_950_000_000, part=3, cash=[
            (DEP, 1_760_000_000, "2026-03-21", None),
            (PAY, 7_190_000_000, "2026-04-18", None)])
outcome(19, W, "m2", 1, "2026-02-17", "sold", listing="70058f98", start=782_000_000,
        win=820_000_000, part=2, cash=[
            (DEP, 156_000_000, "2026-02-17", None),
            (PAY, 664_000_000, "2026-03-10", None)])
outcome(20, W, "m2", 1, "2026-04-08", "sold", listing="3fc961ec", start=25_540_000_000,
        win=26_100_000_000, part=3, cash=[
            (DEP, 5_100_000_000, "2026-04-08", None),
            (PAY, 21_000_000_000, "2026-05-06", None),
            (FEE, 220_000_000, "2026-05-10", "Thù lao dịch vụ đấu giá")])
outcome(21, W, "owner", 1, "2026-03-29", "sold", listing="bee8ddc6", start=34_140_000_000,
        win=34_800_000_000, part=4, cash=[
            (DEP, 6_830_000_000, "2026-03-29", None),
            (PAY, 27_970_000_000, "2026-04-27", None)])
outcome(22, W, "m2", 1, "2026-07-27", "postponed", listing="82796f86", start=36_050_000_000,
        reason="Tạm hoãn theo đề nghị bằng văn bản của bên bảo đảm; dự kiến đấu lại tháng 10")
# — Tài sản ngoài sàn (không có tin trên taisandaugia)
outcome(23, W, "m1", 1, "2026-08-12", "sold", title="Nhà xưởng 1.250 m² – KCN Quang Minh, Mê Linh, Hà Nội",
        cat="nha-xuong", branch=BR_HN, org=ORG_HN, start=17_900_000_000, win=18_600_000_000, part=3,
        evidence=True, cash=[
            (DEP, 3_580_000_000, "2026-08-12", None),
            (PAY, 15_020_000_000, "2026-09-10", None)])
outcome(24, W, "owner", 1, "2026-08-20", "sold",
        title="Dây chuyền sản xuất bao bì nhựa – Công ty TNHH Hưng Phát Bình Dương",
        cat="day-chuyen", branch=BR_BD, org=ORG_MN, start=3_900_000_000, win=4_250_000_000, part=2,
        due="2026-10-19", cash=[
            (DEP, 780_000_000, "2026-08-20", None),
            (PAY, 1_500_000_000, "2026-09-15", "Thanh toán đợt 1")])
outcome(25, W, "m2", 1, "2026-09-05", "sold", title="Ô tô Toyota Camry 2.5Q 2021 – TSBĐ khoản vay cá nhân",
        cat="o-to", branch=BR_DN, org=ORG_VN, start=780_000_000, win=865_000_000, part=7, cash=[
            (DEP, 156_000_000, "2026-09-05", None),
            (PAY, 709_000_000, "2026-09-12", None)])
outcome(26, W, "m1", 1, "2026-08-28", "unsold", title="Căn hộ 2PN 86 m² – Times City T8, Hai Bà Trưng, Hà Nội",
        cat="can-ho", branch=BR_HN, org=ORG_HN, start=3_800_000_000, part=1, reason="single_bidder")
outcome(27, W, "m1", 2, "2026-09-18", "sold", title="Căn hộ 2PN 86 m² – Times City T8, Hai Bà Trưng, Hà Nội",
        cat="can-ho", branch=BR_HN, org=ORG_HN, start=3_610_000_000, win=3_950_000_000, part=3,
        due="2026-10-18", cash=[(DEP, 722_000_000, "2026-09-18", None)])
outcome(28, W, "owner", 1, "2026-04-15", "unsold", title="Nhà xưởng 3.200 m² – KCN Sóng Thần 2, Dĩ An, Bình Dương",
        cat="nha-xuong", branch=BR_BD, org=ORG_MN, start=58_000_000_000, part=0, reason="no_registrants")
outcome(29, W, "owner", 2, "2026-06-16", "unsold", title="Nhà xưởng 3.200 m² – KCN Sóng Thần 2, Dĩ An, Bình Dương",
        cat="nha-xuong", branch=BR_BD, org=ORG_MN, start=55_100_000_000, part=0, reason="no_registrants")
outcome(30, W, "owner", 3, "2026-08-18", "unsold", title="Nhà xưởng 3.200 m² – KCN Sóng Thần 2, Dĩ An, Bình Dương",
        cat="nha-xuong", branch=BR_BD, org=ORG_MN, start=52_345_000_000, part=1, reason="single_bidder",
        cash=[(FEE, 42_000_000, "2026-08-20", "Chi phí tổ chức đấu giá lần 3")])
outcome(31, W, "m2", 1, "2026-09-08", "withdrawn", title="Lô đất 420 m² – phường Hoà Hải, Ngũ Hành Sơn, Đà Nẵng",
        cat="dat-o", branch=BR_DN, org=ORG_VN, start=12_600_000_000,
        reason="Bên vay tất toán khoản nợ trước ngày đấu giá")
outcome(32, W, "m1", 1, "2026-09-22", "sold", title="Biệt thự 250 m² – KĐT Ciputra, Tây Hồ, Hà Nội",
        cat="nha-pho", branch=BR_HN, org=ORG_HN, start=49_500_000_000, win=52_000_000_000, part=6,
        due="2026-10-22")
outcome(33, W, "m2", 1, "2026-06-25", "sold", title="Căn hộ officetel 45 m² – The Tresor, Quận 4, TP.HCM",
        cat="can-ho", branch=BR_HCM, org=ORG_HCM, start=2_450_000_000, win=2_610_000_000, part=4, cash=[
            (DEP, 490_000_000, "2026-06-25", None),
            (PAY, 2_120_000_000, "2026-07-20", None)])

# — Trạm con 1: BIDV – CN Cầu Giấy (Nguyễn Văn Thành)
outcome(101, WS_C1, "b1", 1, "2026-06-10", "sold", listing="cf584000", start=35_800_000_000,
        win=36_400_000_000, part=4, cash=[
            (DEP, 7_160_000_000, "2026-06-10", None),
            (PAY, 29_240_000_000, "2026-07-08", None)])
outcome(102, WS_C1, "b1", 1, "2026-08-14", "sold", listing="d91e92d7", start=20_700_000_000,
        win=21_300_000_000, part=3, due="2026-09-13", cash=[(DEP, 4_140_000_000, "2026-08-14", None)])
outcome(103, WS_C1, "b1", 1, "2026-07-21", "unsold", listing="fafb4175", start=30_250_000_000, part=0,
        reason="no_registrants")
outcome(104, WS_C1, "b1", 2, "2026-09-15", "unsold", listing="fafb4175", start=28_740_000_000, part=1,
        reason="single_bidder")
outcome(105, WS_C1, "b1", 1, "2026-09-09", "sold", listing="76ace1b6", start=41_350_000_000,
        win=42_000_000_000, part=5, due="2026-10-09", cash=[(DEP, 8_270_000_000, "2026-09-09", None)])
outcome(106, WS_C1, "b1", 1, "2026-08-25", "sold", title="Xe tải Hino FC9JLTA 2019 – TSBĐ khoản vay doanh nghiệp",
        cat="xe-tai", org=ORG_HN, start=560_000_000, win=620_000_000, part=5, cash=[
            (DEP, 112_000_000, "2026-08-25", None),
            (PAY, 508_000_000, "2026-09-05", None)])
# — Trạm con 2: BAMC (Vũ Ngọc Mai)
outcome(201, WS_C2, "b2", 1, "2026-05-12", "sold", listing="0621b046", start=13_600_000_000,
        win=14_200_000_000, part=3, cash=[
            (DEP, 2_720_000_000, "2026-05-12", None),
            (PAY, 11_480_000_000, "2026-06-10", None)])
outcome(202, WS_C2, "b2", 1, "2026-08-06", "sold", listing="32487df8", start=39_500_000_000,
        win=40_800_000_000, part=4, due="2026-09-05", cash=[
            (DEP, 7_900_000_000, "2026-08-06", None),
            (PAY, 12_000_000_000, "2026-09-04", "Thanh toán đợt 1")])
outcome(203, WS_C2, "b2", 1, "2026-07-15", "unsold", listing="eb2da77d", start=8_050_000_000, part=0,
        reason="no_registrants")
outcome(204, WS_C2, "b2", 2, "2026-09-02", "sold", listing="eb2da77d", start=7_650_000_000,
        win=7_900_000_000, part=2, cash=[
            (DEP, 1_530_000_000, "2026-09-02", None),
            (PAY, 6_370_000_000, "2026-09-20", None)])
outcome(205, WS_C2, "b2", 1, "2026-09-17", "postponed", listing="e8213839", start=33_950_000_000,
        reason="Hoãn để bổ sung hồ sơ pháp lý theo yêu cầu của tổ chức đấu giá")
outcome(206, WS_C2, "b2", 1, "2026-06-24", "sold",
        title="Dây chuyền mạ kẽm nhúng nóng – Công ty CP Thép Việt Á (TSBĐ)", cat="day-chuyen",
        org=ORG_VN, start=20_000_000_000, win=21_500_000_000, part=3, cash=[
            (DEP, 4_000_000_000, "2026-06-24", None),
            (PAY, 17_500_000_000, "2026-07-22", None)])

# ─── Chỉ tiêu: (n, ws, branch, period_type, period_start, amount, count) ───────
TARGETS = [
    (1, W, None, "year", "2026-01-01", 450_000_000_000, 24),
    (2, W, None, "quarter", "2026-04-01", 160_000_000_000, 6),
    (3, W, None, "quarter", "2026-07-01", 130_000_000_000, 8),
    (4, W, None, "quarter", "2026-10-01", 140_000_000_000, 7),
    (5, W, None, "month", "2026-07-01", 45_000_000_000, 2),
    (6, W, None, "month", "2026-08-01", 30_000_000_000, 3),
    (7, W, None, "month", "2026-09-01", 60_000_000_000, 4),
    (8, W, None, "month", "2026-10-01", 50_000_000_000, 3),
    (9, W, BR_HN, "quarter", "2026-07-01", 60_000_000_000, 4),
    (10, W, BR_BD, "quarter", "2026-07-01", 35_000_000_000, 2),
    (11, W, BR_DN, "quarter", "2026-07-01", 25_000_000_000, 2),
    (12, W, BR_HN, "quarter", "2026-10-01", 50_000_000_000, 2),
    (21, WS_C1, None, "quarter", "2026-07-01", 90_000_000_000, 4),
    (22, WS_C1, None, "month", "2026-09-01", 45_000_000_000, 2),
    (31, WS_C2, None, "quarter", "2026-07-01", 70_000_000_000, 3),
]

# ─── Báo cáo định kỳ: (n, ws, by, branch, type, start, created_at, final, notes, plan_note) ─
REPORTS = [
    (1, W, "owner", None, "quarter", "2026-04-01", "2026-07-03 09:30+07", True,
     "Quý II thu về 150,07 tỷ/160 tỷ kế hoạch (93%). Nhà mặt ngõ 443 m² Bình Dương bán được ở lượt 3 "
     "nhưng người mua mới nộp 23,26/41,5 tỷ — đã gửi công văn đôn đốc lần 1.",
     "Quý III: đưa Kho xưởng Cần Thơ ra đấu lần 4 với giá giảm 10%; tất toán 2 tài sản đang chậm thu; "
     "chuẩn bị hồ sơ đấu lại Nhà phố Đồng Nai."),
    (2, W, "owner", None, "month", "2026-07-01", "2026-08-03 10:00+07", True,
     "Tháng 7 bán 2 tài sản (54,2 tỷ). Nhà xưởng Cần Thơ được gia hạn thanh toán tới 10/10.",
     "Tháng 8: hoàn tất đấu giá Nhà xưởng KCN Quang Minh; đôn đốc người mua Nhà cấp 4 Bình Dương."),
    (3, W, "owner", None, "month", "2026-08-01", "2026-09-03 09:15+07", True,
     "Tháng 8 đạt 69% chỉ tiêu thu. Nhà xưởng KCN Sóng Thần vẫn không có người đăng ký sau 3 lượt.",
     "Tháng 9: trình phương án giảm giá khởi điểm Nhà xưởng Sóng Thần; tổ chức phiên Biệt thự Ciputra."),
    (4, W, "m1", BR_HN, "month", "2026-08-01", "2026-09-04 14:00+07", True,
     "Chi nhánh bán Nhà xưởng KCN Quang Minh 18,6 tỷ, đã thu đủ ngày 10/9. Căn hộ Times City lượt 1 chỉ 1 người.",
     "Đấu lại Căn hộ Times City ngày 18/9 với giá khởi điểm giảm 5%."),
    (5, W, "owner", None, "month", "2026-09-01", "2026-09-25 16:40+07", False,
     "Bản nháp — chờ số liệu thu tiền Biệt thự Ciputra trước khi chốt.",
     "Tháng 10: 2 phiên đấu lại (Nhà phố Đồng Nai 14/10, Kho bãi Quảng Ninh 22/10)."),
    (6, W, "m2", None, "quarter", "2026-07-01", "2026-09-26 08:30+07", False,
     "Nháp quý III do cán bộ tổng hợp — Trưởng đơn vị rà soát trước khi chốt.", None),
    (11, WS_C1, "b1", None, "month", "2026-08-01", "2026-09-02 11:00+07", True,
     "Tháng 8 bán Biệt thự Đà Nẵng 21,3 tỷ; người mua mới nộp tiền đặt trước.",
     "Tháng 9: đấu lại Nhà phố Bình Dương; đôn đốc thu tiền Biệt thự Đà Nẵng."),
]
SHARED_REPORT = 1

# ─── Hồ sơ số hoá của không gian W ────────────────────────────────────────────
POSTINGS = [
    dict(n=1, user="m1", branch=BR_HN, status="draft", review="pending", submitted=None, reviewed=None,
         created="2026-09-23 15:20+07", slug=("bat-dong-san", "nha-pho"),
         title="Nhà phố 4 tầng 62 m² – ngõ 105 Doãn Kế Thiện, Cầu Giấy, Hà Nội",
         description="Tài sản bảo đảm khoản vay doanh nghiệp, ngân hàng xử lý theo hợp đồng thế chấp. "
                     "Nhà 4 tầng, 4 phòng ngủ, ngõ ô tô tránh, cách phố Doãn Kế Thiện 50 m.",
         province="Hà Nội", district="Cầu Giấy", ward="Mai Dịch", address="Số 18, ngõ 105 Doãn Kế Thiện",
         price=9_800_000_000, fmt="truc_tiep", timeline="normal",
         delta={"floors": 4, "bedrooms": 4, "land_area": 62, "floor_area": 230, "direction": "tay-nam",
                "legal_book": "so-hong"},
         photos=[("Mặt tiền ngõ 105 Doãn Kế Thiện", "Nhà phố 4 tầng · Cầu Giấy", "#3D6E7A"),
                 ("Phòng khách tầng 1", "Nhà phố 4 tầng · Cầu Giấy", "#8A5A2B")], decl=None),
    dict(n=2, user="m2", branch=BR_BD, status="active", review="pending", submitted="2026-09-24 10:05+07",
         reviewed=None, created="2026-09-22 09:00+07", slug=("bat-dong-san", "nha-xuong"),
         title="Quyền sử dụng đất 2.400 m² và nhà xưởng – KCN Nam Tân Uyên, Bình Dương",
         description="Nhà xưởng khung thép 1.800 m² trên đất KCN thuê trả tiền một lần. "
                     "Tài sản bảo đảm của khoản vay đã quá hạn, bên vay đồng ý bàn giao để xử lý.",
         province="Bình Dương", district="Tân Uyên", ward="Khánh Bình", address="Lô C12, KCN Nam Tân Uyên mở rộng",
         price=28_500_000_000, fmt="ca_hai", timeline="urgent",
         delta={"land_area": 2400, "floor_area": 1800, "legal_book": "so-do"},
         photos=[("Nhà xưởng KCN Nam Tân Uyên", "2.400 m² đất · 1.800 m² xưởng", "#4A5A2B"),
                 ("Bên trong nhà xưởng", "Khung thép · cao 9 m", "#2C5F8A")], decl="Phạm Thu Trang"),
    dict(n=3, user="owner", branch=BR_HCM, status="active", review="approved", submitted="2026-09-15 09:40+07",
         reviewed="2026-09-17 16:10+07", created="2026-09-14 14:00+07", slug=("bat-dong-san", "can-ho"),
         title="Căn hộ 3PN 112 m² – Vinhomes Central Park, Bình Thạnh, TP.HCM",
         description="Căn góc tầng 18 tòa Landmark 3, view sông Sài Gòn, bàn giao nội thất cơ bản. "
                     "Tài sản bảo đảm, sổ hồng đang lưu giữ tại chi nhánh.",
         province="TP. Hồ Chí Minh", district="Bình Thạnh", ward="Phường 22",
         address="Tòa Landmark 3, 208 Nguyễn Hữu Cảnh", price=10_200_000_000, fmt="truc_tuyen",
         timeline="normal",
         delta={"bedrooms": 3, "floor_area": 112, "floor_number": 18, "direction": "dong-nam",
                "legal_book": "so-hong"},
         photos=[("Phòng khách căn góc tầng 18", "Vinhomes Central Park · 112 m²", "#7A4B8C"),
                 ("View sông Sài Gòn", "Landmark 3 · Bình Thạnh", "#2C5F8A")], decl="Nguyễn Hoàng Long"),
]


def photo_id(p, k):
    return sid("000d", p * 10 + k)


# ─── Tệp ──────────────────────────────────────────────────────────────────────
FONT_PATHS = ["/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/System/Library/Fonts/Helvetica.ttc"]
DEMO_STAMP = "DỮ LIỆU DEMO — KHÔNG CÓ GIÁ TRỊ PHÁP LÝ"


def font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


def photo_png(caption, subtitle, color):
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


def doc_image(header, title, lines, fmt):
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
    if fmt == "PDF":
        img.save(buf, "PDF", resolution=150)
    else:
        img.convert("RGB").resize((620, 877)).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def vnd(n):
    return f"{n:,}₫"


def evidence_path(o):
    return f"{o['ws']}/{o['id']}/bien-ban-dau-gia.pdf"


def kyc_paths(user, kyc):
    base = f"{user}/org_{kyc}"
    return {k: f"{base}/{k}.png" for k in ("authorization_doc", "rep_id_front", "rep_id_back")}


def posting_photo_path(p, k):
    return f"{U[p['user']]}/{photo_id(p['n'], k)}.png"


def public_url(bucket, path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"


def files():
    """(bucket, path, bytes, content-type) — mọi tệp mà SQL trỏ tới."""
    out = []
    for o in OUTCOMES:
        if o["evidence"]:
            assert not o["ws"].startswith(":"), "biên bản chỉ cho W (đường dẫn cần id không gian)"
            name = o["title"] or next(k for k, v in L.items() if v == o["listing"])
            out.append(("owner-outcome-evidence", evidence_path(o), doc_image(
                "BIÊN BẢN ĐẤU GIÁ TÀI SẢN", f"Lượt {o['round']} · ngày {o['day']}",
                [f"Tài sản: {name}", f"Giá khởi điểm: {vnd(o['start'])}",
                 f"Giá trúng: {vnd(o['win'])}", f"Số người tham gia: {o['part']}",
                 "Người có tài sản: Ngân hàng TMCP Đầu tư và Phát triển Việt Nam"], "PDF"),
                "application/pdf"))
    for user, kyc, org in ((U["b1"], KYC_C1, "BIDV – Chi nhánh Cầu Giấy"),
                           (U["b2"], KYC_C2, "Công ty QLN & KTTS BIDV (BAMC)")):
        p = kyc_paths(user, kyc)
        out.append(("kyc-ekyc", p["authorization_doc"], doc_image(
            org.upper(), "GIẤY GIAO VIỆC / UỶ QUYỀN", ["Giám đốc đơn vị giao cán bộ quản lý",
                                                       "Trạm Điều Hành trên taisandaugia.vn"], "PNG"), "image/png"))
        out.append(("kyc-ekyc", p["rep_id_front"], doc_image(
            "CĂN CƯỚC CÔNG DÂN", "Mặt trước", ["(ảnh minh hoạ)"], "PNG"), "image/png"))
        out.append(("kyc-ekyc", p["rep_id_back"], doc_image(
            "CĂN CƯỚC CÔNG DÂN", "Mặt sau", ["(ảnh minh hoạ)"], "PNG"), "image/png"))
    for p in POSTINGS:
        for k, (cap, sub, color) in enumerate(p["photos"], start=1):
            out.append(("asset-media", posting_photo_path(p, k), photo_png(cap, sub, color), "image/png"))
    return out


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
    if isinstance(v, int):
        return str(v)
    if isinstance(v, (dict, list)):
        return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    s = str(v)
    if s.startswith(":"):          # biến psql, vd. :ws_c1
        return f":'{s[1:]}'"
    return "'" + s.replace("'", "''") + "'"


def as_user(key):
    claims = json.dumps({"sub": U[key], "role": "authenticated"})
    return f"select set_config('request.jwt.claims', {lit(claims)}, true);"


AS_SYSTEM = "select set_config('request.jwt.claims', '', true);"
AS_ANON = "select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true);"


# ─── Bước 1: tài khoản demo ───────────────────────────────────────────────────
def ensure_accounts():
    have = {}
    for line in psql("select email || '|' || id from auth.users where email like 'demo.%@example.com';", rows=True):
        email, id_ = line.split("|")
        have[email] = id_
    created = []
    for _key, id_, email, name in USERS:
        if email in have:
            if have[email] != id_:
                sys.exit(f"{email} đã tồn tại với id khác ({have[email]}) — gỡ tay trước khi seed.")
            continue
        pw = secrets.token_urlsafe(12)
        res = api("POST", "/auth/v1/admin/users", {
            "id": id_, "email": email, "password": pw, "email_confirm": True,
            "user_metadata": {"name": name, "terms_accepted": True, "terms_version": TERMS_VERSION,
                              "privacy_version": TERMS_VERSION, "notifications_enabled": False},
        })
        if res.get("id") != id_:
            sys.exit(f"GoTrue không nhận id cố định cho {email} (trả {res.get('id')}).")
        created.append(f"{email}\t{pw}\t{name}")
        print(f"  + tài khoản {email}")
    if created:
        with ACCOUNTS_FILE.open("a", encoding="utf-8") as f:
            f.write("\n".join(created) + "\n")
    print(f"  tài khoản demo: {len(USERS)} ({len(created)} mới)")


def upload_files():
    items = files()
    for bucket, path, data, ctype in items:
        api("POST", f"/storage/v1/object/{bucket}/{path}", raw=data, ctype=ctype, extra={"x-upsert": "true"})
    print(f"  tệp: {len(items)} đã tải lên")


def remove_files():
    by_bucket = {}
    for bucket, path, _data, _ctype in files():
        by_bucket.setdefault(bucket, []).append(path)
    for bucket, paths in by_bucket.items():
        api("DELETE", f"/storage/v1/object/{bucket}", {"prefixes": paths})
    print(f"  tệp: đã xoá {sum(len(p) for p in by_bucket.values())}")


# ─── Bước 2: SQL ──────────────────────────────────────────────────────────────
def seed_sql(commit):
    s = ["\\set ON_ERROR_STOP 1", "begin;", """
create function pg_temp.ok(j jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce((j->>'ok')::boolean, false) is not true then
    raise exception 'RPC trả lỗi: %', j;
  end if;
  return j;
end $$;"""]
    s.append(f"""
select case when exists (select 1 from owner_asset_outcomes where id = {lit(sid('0001', 1))})
  then pg_temp.ok('{{"ok":false,"reason":"da_seed_roi_chay_teardown_truoc"}}') end;""")

    # Tài khoản demo đã kích hoạt (lời mời đòi profiles.activated)
    ids = ", ".join(lit(i) for _k, i, _e, _n in USERS)
    s += [AS_SYSTEM, f"update profiles set activated = true, activated_at = '2026-06-10 09:00+07' where id in ({ids});"]

    # 1) W thành TRỤ SỞ: gắn pháp nhân BIDV (chỉ server ghi được cột này)
    s.append(f"update asset_owner_workspaces set asset_owner_id = {lit(BIDV)} where id = {lit(W)};")

    # 2) Hai trạm con qua KYC rút gọn (kyc_scope='branch') → trigger duyệt tạo không gian + claim
    for kyc, key, entity, org_type, name, email, rep, title, idno, sub, rev, ws_var in (
        (KYC_C1, "b1", CAUGIAY, "bank_credit", "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam - Chi nhánh Cầu Giấy",
         "caugiay.bidv@example.com", "Nguyễn Văn Thành", "Phó Giám đốc chi nhánh", "001085012345",
         "2026-07-24 09:00+07", "2026-07-25 10:30+07", "ws_c1"),
        (KYC_C2, "b2", BAMC, "amc",
         "Công ty TNHH MTV Quản lý nợ và Khai thác tài sản Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
         "bamc.bidv@example.com", "Vũ Ngọc Mai", "Trưởng phòng Xử lý tài sản", "001190054321",
         "2026-08-14 09:00+07", "2026-08-15 11:00+07", "ws_c2"),
    ):
        p = kyc_paths(U[key], kyc)
        s.append(f"""
insert into asset_owner_org_kyc (id, created_by, status, kyc_scope, org_type, org_name, official_email, email_domain,
  rep_full_name, rep_title, rep_id_type, rep_id_number, rep_id_front_url, rep_id_back_url, authorization_doc_url,
  linked_asset_owner_id, parent_asset_owner_id, submitted_at, created_at)
values ({lit(kyc)}, {lit(U[key])}, 'pending_review', 'branch', {lit(org_type)}, {lit(name)}, {lit(email)}, 'example.com',
  {lit(rep)}, {lit(title)}, 'cccd', {lit(idno)}, {lit(p['rep_id_front'])}, {lit(p['rep_id_back'])}, {lit(p['authorization_doc'])},
  {lit(entity)}, {lit(BIDV)}, {lit(sub)}, {lit(sub)});
update asset_owner_org_kyc set status = 'approved', reviewed_by = {lit(ADMIN)}, reviewed_at = {lit(rev)},
  review_notes = 'Giấy giao việc hợp lệ, email công vụ đã xác minh.' where id = {lit(kyc)};
select id as {ws_var} from asset_owner_workspaces where org_kyc_id = {lit(kyc)} \\gset
update asset_owner_workspaces set created_at = {lit(rev)} where id = :'{ws_var}';""")

    # 3) Liên kết trụ sở ↔ chi nhánh qua RPC thật (W gửi, chi nhánh chấp nhận)
    for ws_var, key, req_var, asked, answered in (
        ("ws_c1", "b1", "req_c1", "2026-08-01 09:00+07", "2026-08-02 08:45+07"),
        ("ws_c2", "b2", "req_c2", "2026-08-20 14:00+07", "2026-08-22 09:20+07"),
    ):
        s += [as_user("owner"),
              f"select (pg_temp.ok(owner_ws_request_link({lit(W)}, :'{ws_var}')))->>'request_id' as {req_var} \\gset",
              as_user(key),
              f"select pg_temp.ok(owner_ws_respond_link(:'{req_var}', true));",
              AS_SYSTEM,
              f"update owner_workspace_link_requests set created_at = {lit(asked)}, responded_at = {lit(answered)} "
              f"where id = :'{req_var}';",
              f"update asset_owner_workspaces set parent_linked_at = {lit(answered)} where id = :'{ws_var}';"]

    # 4) Thành viên của W qua lời mời thật + 2 lời mời đang chờ
    for key, role, scope, joined in (("m1", "staff", [BR_HN], "2026-06-15 09:00+07"),
                                     ("m2", "staff", None, "2026-06-15 09:05+07"),
                                     ("m3", "viewer", None, "2026-07-01 10:00+07")):
        email = next(e for k, _i, e, _n in USERS if k == key)
        scope_sql = f"array[{lit(scope[0])}]::uuid[]" if scope else "null"
        s += [as_user("owner"),
              f"select (pg_temp.ok(owner_ws_create_invite({lit(W)}, {lit(email)}, {lit(role)}, {scope_sql})))->>'token' "
              f"as tok_{key} \\gset",
              as_user(key),
              f"select pg_temp.ok(owner_ws_accept_invite(:'tok_{key}'));",
              AS_SYSTEM,
              f"update asset_owner_workspace_members set joined_at = {lit(joined)}, created_at = {lit(joined)} "
              f"where workspace_id = {lit(W)} and user_id = {lit(U[key])};",
              f"update asset_owner_workspace_invites set created_at = timestamptz {lit(joined)} - interval '1 day', "
              f"expires_at = timestamptz {lit(joined)} + interval '6 days', accepted_at = {lit(joined)} "
              f"where token = :'tok_{key}';"]
    for email, role, scope in PENDING_INVITES:
        scope_sql = f"array[{lit(scope[0])}]::uuid[]" if scope else "null"
        s += [as_user("owner"),
              # chỉ in 'ok' — token lời mời chính là bí mật của link
              f"select (pg_temp.ok(owner_ws_create_invite({lit(W)}, {lit(email)}, {lit(role)}, {scope_sql})))->>'ok';"]
    s += [AS_SYSTEM,
          f"update asset_owner_workspace_invites set created_at = now() - interval '2 days', "
          f"expires_at = now() + interval '5 days' where workspace_id = {lit(W)} and accepted_at is null "
          f"and email in ({', '.join(lit(e) for e, _r, _s in PENDING_INVITES)});"]

    # 5) Hai tài sản đấu lại tháng 10
    for listing, at, reg, _old_at, _old_reg in RESCHEDULE:
        s.append(f"update listings set custom_attributes = coalesce(custom_attributes, '{{}}'::jsonb) || "
                 f"jsonb_build_object('auction_time', {lit(at)}, 'registration_deadline', {lit(reg)}) where id = {lit(listing)};")

    # 6) Kết quả phiên + sổ thu chi (người khai / người ghi = auth.uid() do guard đóng dấu)
    cash_n = 0
    for o in OUTCOMES:
        created = f"{o['day']} 17:30+07"
        s += [as_user(o["by"]), f"""
insert into owner_asset_outcomes (id, workspace_id, branch_id, listing_id, asset_title, asset_category, round_no,
  auction_date, auction_org_id, outcome, failure_reason, starting_price, winning_price, participants, payment_status,
  payment_due_on, evidence_urls, source, share_to_market, created_at)
values ({lit(o['id'])}, {lit(o['ws'])}, {lit(o['branch'])}, {lit(o['listing'])}, {lit(o['title'])}, {lit(o['cat'])},
  {o['round']}, {lit(o['day'])}, {lit(o['org'])}, {lit(o['outcome'])}, {lit(o['reason'])}, {lit(o['start'])},
  {lit(o['win'])}, {lit(o['part'])}, {lit('defaulted' if o['defaulted'] else 'pending')}, {lit(o['due'])},
  {("array[" + lit(evidence_path(o)) + "]") if o['evidence'] else "'{}'"}::text[], 'owner_manual', false,
  {lit(created)});"""]
        for kind, amount, day, note in o["cash"]:
            cash_n += 1
            s.append(f"insert into owner_cash_events (id, outcome_id, kind, amount, occurred_on, note) values "
                     f"({lit(sid('0002', cash_n))}, {lit(o['id'])}, {lit(kind)}, {amount}, {lit(day)}, {lit(note)});")
    s += [AS_SYSTEM,
          "update owner_cash_events set created_at = (occurred_on + time '16:00') at time zone 'Asia/Ho_Chi_Minh', "
          "updated_at = (occurred_on + time '16:00') at time zone 'Asia/Ho_Chi_Minh' where id::text like '5eed0002-%';"]

    # 7) Chỉ tiêu (ghi = Trưởng đơn vị của từng trạm)
    for n, ws, branch, ptype, start, amount, count in TARGETS:
        s += [as_user("owner" if ws == W else ("b1" if ws == WS_C1 else "b2")),
              f"insert into owner_workspace_targets (id, workspace_id, branch_id, period_type, period_start, "
              f"target_amount, target_count, created_at) values ({lit(sid('0003', n))}, {lit(ws)}, {lit(branch)}, "
              f"{lit(ptype)}, {lit(start)}, {amount}, {count}, timestamptz {lit(start + ' 08:00+07')} - interval '5 days');"]

    # 8) Hồ sơ số hoá của W
    for p in POSTINGS:
        decl = ({"name": p["decl"], "version": DECLARATION_VERSION,
                 "accepted_at": p["submitted"].replace(" ", "T").replace("+07", ":00+07:00")}
                if p["decl"] else None)
        imgs = [public_url("asset-media", posting_photo_path(p, k)) for k in range(1, len(p["photos"]) + 1)]
        s += [AS_SYSTEM, f"""
insert into asset_postings (id, user_id, workspace_id, branch_id, parent_slug, child_slug, title, description, province,
  district, ward, address, pricing_mode, starting_price, auction_format, expected_timeline, has_dispute, has_mortgage,
  is_seized, right_to_sell, legal_notes, delta_fields, image_urls, status, submitted_at, review_status, reviewed_at,
  reviewed_by, ownership_declaration, created_at)
values ({lit(sid('0005', p['n']))}, {lit(U[p['user']])}, {lit(W)}, {lit(p['branch'])}, {lit(p['slug'][0])},
  {lit(p['slug'][1])}, {lit(p['title'])}, {lit(p['description'])}, {lit(p['province'])}, {lit(p['district'])},
  {lit(p['ward'])}, {lit(p['address'])}, 'self', {p['price']}, {lit(p['fmt'])}, {lit(p['timeline'])}, false, false,
  false, true, 'Tài sản bảo đảm; ngân hàng có quyền xử lý theo hợp đồng thế chấp đã đăng ký giao dịch bảo đảm.',
  {lit(p['delta'])}, array[{', '.join(lit(u) for u in imgs)}]::text[], {lit(p['status'])}, {lit(p['submitted'])},
  {lit(p['review'])}, {lit(p['reviewed'])}, {lit(ADMIN if p['reviewed'] else None)}, {lit(decl)}, {lit(p['created'])});"""]

    # 9) Báo cáo định kỳ: tạo nháp → (Trưởng đơn vị) chốt trên server → chia sẻ 1 bản
    for n, ws, by, branch, ptype, start, created, final, notes, plan in REPORTS:
        rid = sid("0004", n)
        s += [as_user(by),
              f"insert into owner_report_snapshots (id, workspace_id, branch_id, period_type, period_start, notes, "
              f"plan_note, created_at) values ({lit(rid)}, {lit(ws)}, {lit(branch)}, {lit(ptype)}, {lit(start)}, "
              f"{lit(notes)}, {lit(plan)}, {lit(created)});"]
        if final:
            s += [as_user("owner" if ws == W else "b1"), f"select pg_temp.ok(owner_finalize_report({lit(rid)}));"]
    rid = sid("0004", SHARED_REPORT)
    s += [as_user("owner"),
          f"select (pg_temp.ok(owner_share_report({lit(rid)}, 30)))->>'token' as share_tok \\gset",
          AS_ANON] + ["select (get_shared_owner_report(:'share_tok'))->>'ok';"] * 4 + [
          AS_SYSTEM,
          f"update owner_report_snapshots set shared_at = '2026-09-20 10:00+07', "
          f"token_expires_at = '2026-10-20 10:00+07' where id = {lit(rid)};"]

    # 10) Kiểm tra dưới quyền secsosoo (RLS thật)
    s += [as_user("owner"), "set local role authenticated;", f"""
\\echo '── Kiểm tra dưới quyền secsosoo ──'
select 'overview W' as k, count(*)::text as v from owner_outcomes_overview({lit(W)})
union all select 'overview W có lệch', count(*) filter (where has_conflict)::text from owner_outcomes_overview({lit(W)})
union all select 'overview W tự khai', count(*) filter (where best_kind = 'owner_report')::text from owner_outcomes_overview({lit(W)})
union all select 'dòng tiền: đơn vị', jsonb_array_length((owner_cash_flow({lit(W)}, true))->'units')::text
union all select 'dòng tiền: khoản', jsonb_array_length((owner_cash_flow({lit(W)}, true))->'events')::text
union all select 'dòng tiền: phiên sắp tới', jsonb_array_length((owner_cash_flow({lit(W)}, true))->'upcoming')::text
union all select 'chỉ tiêu W', count(*)::text from owner_workspace_targets where workspace_id = {lit(W)}
union all select 'báo cáo W chốt/nháp', count(*) filter (where status = 'final') || '/' || count(*) filter (where status = 'draft')
  from owner_report_snapshots where workspace_id = {lit(W)}
union all select 'thành viên W', count(*)::text from owner_ws_list_members({lit(W)})
union all select 'lời mời chờ', count(*)::text from asset_owner_workspace_invites where workspace_id = {lit(W)} and accepted_at is null and revoked_at is null
union all select 'trạm con đọc được', count(*)::text from asset_owner_workspaces where parent_workspace_id = {lit(W)}
union all select 'hồ sơ số hoá W', count(*)::text from asset_postings where workspace_id = {lit(W)};"""]

    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def teardown_sql():
    restore = []
    for listing, _at, _reg, old_at, old_reg in RESCHEDULE:
        expr = f"(custom_attributes - 'registration_deadline') || jsonb_build_object('auction_time', {lit(old_at)})"
        if old_reg:
            expr += f" || jsonb_build_object('registration_deadline', {lit(old_reg)})"
        restore.append(f"update listings set custom_attributes = {expr} where id = {lit(listing)};")
    return "\n".join([
        "\\set ON_ERROR_STOP 1", "begin;",
        "delete from owner_report_snapshots where id::text like '5eed0004-%';",
        "delete from owner_workspace_targets where id::text like '5eed0003-%';",
        "delete from owner_asset_outcomes where id::text like '5eed0001-%';",   # kéo theo sổ thu chi
        f"delete from asset_owner_workspace_invites where workspace_id = {lit(W)} and email like 'demo.%@example.com';",
        "delete from asset_postings where id::text like '5eed0005-%';",
        *restore,
        # xoá KYC ⇒ CASCADE không gian con (claim, thành viên, yêu cầu liên kết, chỉ tiêu, báo cáo)
        "delete from asset_owner_org_kyc where id::text like '5eed0006-%';",
        f"update asset_owner_workspaces set asset_owner_id = null where id = {lit(W)};",
        "commit;",
    ]) + "\n"


def main():
    args = set(sys.argv[1:])
    if "--teardown" in args:
        print("Gỡ dữ liệu demo…")
        psql(teardown_sql())
        print("  SQL: đã gỡ")
        remove_files()
        for _k, id_, email, _n in USERS:
            try:
                api("DELETE", f"/auth/v1/admin/users/{id_}")
                print(f"  - tài khoản {email}")
            except RuntimeError as e:
                if "404" not in str(e):
                    raise
        if ACCOUNTS_FILE.exists():
            ACCOUNTS_FILE.unlink()
        return
    commit = "--dry-run" not in args
    print("Seed Trạm Điều Hành cho secsosoo…" + ("" if commit else " (dry-run, ROLLBACK)"))
    ensure_accounts()
    upload_files()
    print(psql(seed_sql(commit)))
    print("Xong." if commit else "Dry-run xong — không ghi gì vào DB (tài khoản + tệp vẫn giữ).")


if __name__ == "__main__":
    main()
