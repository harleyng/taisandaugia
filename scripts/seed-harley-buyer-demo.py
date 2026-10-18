"""Bộ demo PHÍA NGƯỜI MUA trên sàn cho harleyngx@gmail.com — 12 phiên [DEMO], mỗi phiên một trạng thái.

harleyngx là thành viên/chủ của Bảo Tín, Minh Khang, Thành Đạt, Phú Quý, Trường An, chi nhánh Hải
Phòng ⇒ `start_bidding_contract` chặn mua hồ sơ phiên của các tổ chức đó. Bộ này dựng phiên ở
"Công ty Đấu giá Hợp danh Việt Nam" (org c67d2cbc…, chủ secsosoo@gmail.com), nơi harleyngx chỉ là
người mua. Tài sản là 14 TIN MINH HOẠ mới của một pháp nhân HƯ CẤU (không gán tin giả cho ngân hàng
thật); tổ chức được tạo hợp đồng hợp tác bán hồ sơ (supplier + hợp đồng + dòng) để nút Đăng ký chạy.

  #  Giai đoạn phiên        Trạng thái của harleyngx
  1  Sắp mở bán hồ sơ       chưa có hồ sơ — "Mở bán từ …"
  2  Đang bán hồ sơ         chưa đăng ký — tự thử luồng /sessions/:id/dang-ky (3 người khác đã mua)
  3  Đang bán hồ sơ         giữ chỗ, chờ thanh toán VNPay
  4  Đang bán hồ sơ         đã trả tiền hồ sơ, chờ tổ chức duyệt
  5  Đang bán hồ sơ         tổ chức yêu cầu bổ sung hồ sơ
  6  Đang bán hồ sơ         đã duyệt, chưa nộp tiền đặt trước
  7  Sắp đấu giá (<24 giờ)  đã nộp tiền đặt trước, ĐANG MỞ điểm danh trực tuyến (tự điểm danh bằng OTP)
  8  Đang diễn ra           đã điểm danh, SBD — trúng lô 1 (đã đóng), bị vượt giá ở lô 2 đang mở (trả giá tiếp được)
  9  Đã chốt kết quả        TRÚNG lô 1 → hợp đồng mua bán chờ ký (/hop-dong-mua-ban/:id)
 10  Đã chốt kết quả        không trúng → tiền đặt trước đã hoàn trả
 11  Đã chốt kết quả        vắng mặt (không điểm danh) → tịch thu tiền đặt trước
 12  Đã huỷ                 đã trả + đã duyệt hồ sơ trước khi phiên bị huỷ

Ngày giờ tính theo LÚC CHẠY. Phiên 7 chỉ mở điểm danh tới giờ đấu (~23 giờ sau khi seed): qua giờ
đó cron close_due_rosters đánh vắng. Phiên 8 đấu tới ~7 ngày sau. Muốn làm mới: --teardown rồi seed lại.

    python3 scripts/seed-harley-buyer-demo.py              # seed (dừng nếu đã seed)
    python3 scripts/seed-harley-buyer-demo.py --dry-run    # chạy hết rồi ROLLBACK
    python3 scripts/seed-harley-buyer-demo.py --teardown   # gỡ sạch (gồm cả hồ sơ/lượt trả giá người dùng tự tạo
                                                           # trong 12 phiên này) + tệp PDF trong storage

Mọi id có tiền tố ba7e (KHÔNG dùng f10d — scripts/demo-bidding-backfill.sql tự duyệt hồ sơ f10d, sẽ
phá trạng thái "chờ duyệt"). Đọc SUPABASE_SERVICE_ROLE_KEY + SUPABASE_DB_URI từ .env.local.
"""
import importlib.util
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


od = _load("owner_demo", "seed-owner-demo.py")
hdmb = _load("hdmb_assets", "seed-sale-contract-assets.py")
api, psql, lit = od.api, od.psql, od.lit

VN = timezone(timedelta(hours=7))
NOW = datetime.now(VN).replace(second=0, microsecond=0)
T = NOW.date()

HARLEY = "95d7e29c-f1f5-4361-a3af-e9aeaf792f3f"
OWNER = "ae9bfef5-2694-466f-a97e-5efdf138ac43"     # secsosoo — chủ tổ chức đấu giá
ORG = "c67d2cbc-badf-4304-9422-67eb77568652"       # Công ty Đấu giá Hợp danh Việt Nam
AORG = "d9572b14-c8e5-4d35-8f2f-3c1f6ab6706b"
ORG_NAME = "Công ty Đấu giá Hợp danh Việt Nam"
DOSSIER_SERVICE = "b74f52a2-035d-494c-92c0-0ae8d1f2d144"   # "Bán hồ sơ tham gia đấu giá"


def sid(group, n):
    return f"ba7e{group}-0000-4000-8000-{n:012d}"


def listing_id(n):
    # "Mã" tài sản trên UI = 8 ký tự đầu của id ⇒ mỗi tin một tiền tố riêng.
    return f"ba7e{n:02d}a1-0000-4000-8000-{n:012d}"


SUPPLIER, SUPPLIER_CONTRACT, SUPPLIER_LINE = sid("c001", 1), sid("c002", 1), sid("c003", 1)
SELLER = sid("a001", 1)
SELLER_NAME = "Công ty TNHH Tài sản Demo An Phát"
SALE_CONTRACT = sid("e001", 9)
SALE_DRAFT = f"{ORG}/{SALE_CONTRACT}/draft-{int(NOW.timestamp() * 1000)}-du-thao-hop-dong-mua-ban.pdf"
SALE_BUCKET = "auction-sale-contracts"
DEMO_NOTE = "Tin minh hoạ phục vụ trình diễn — không phải tài sản đấu giá thật."
IMG = od.IMG


def session_id(k):
    return sid("b001", k)


def lot_id(k, j):
    return sid("b002", k * 10 + j)


def contract_id(k, j):
    return sid("b003", k * 10 + j)


def bid_id(k, j, seq):
    return sid("b004", k * 100 + j * 10 + seq)


def d(n, hh=9, mm=0):
    """Mốc giờ Việt Nam, n ngày so với hôm nay."""
    return datetime.combine(T + timedelta(days=n), datetime.min.time(), VN).replace(hour=hh, minute=mm)


def iso(x):
    return x.isoformat()


def ts(x):
    return f"timestamptz {lit(iso(x))}" if x is not None else "NULL"


# ─── Người ────────────────────────────────────────────────────────────────────
# (user_id, họ tên, CCCD, ngày sinh, giới tính, SĐT, email, địa chỉ)
PEOPLE = {
    "H": (HARLEY, "Harley Nguyễn", "048300911385", "1995-01-10", "male", "0981232313", "harleyngx@gmail.com",
          "Số 101 Lê Duẩn, Phường Thạch Thang, Quận Hải Châu, Đà Nẵng"),
    "B1": ("957b8823-9a29-424d-a0fb-6f859590e236", "Phạm Quốc Bảo", "079088001234", "1988-04-12", "male",
           "0912345678", "quocbao.demo@example.com", "27 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"),
    "B2": ("0d4ff00a-ac13-4652-90cc-94f7760bc936", "Lê Thị Thu Trang", "001190004567", "1990-11-03", "female",
           "0987123456", "thutrang.demo@example.com", "118 Trần Não, Phường An Khánh, TP. Thủ Đức, TP. Hồ Chí Minh"),
    "B3": ("5eed0b08-0000-4000-8000-000000000001", "Nguyễn Minh Tuấn", "079090000123", "1987-06-21", "male",
           "0900000101", "demo.nguoimua.01@example.com", "45 Đường số 3, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh"),
}

# ─── Tài sản minh hoạ ─────────────────────────────────────────────────────────
# n, loại, tiêu đề, giá khởi điểm, bước giá, diện tích, tỉnh, quận, phường, đường, mô tả
LISTINGS = [
    (1, "biet-thu", "Biệt thự song lập 300 m² – KĐT Ciputra, Tây Hồ, Hà Nội", 42_000_000_000, 200_000_000, 300,
     "Hà Nội", "Tây Hồ", "Phú Thượng", "Khu đô thị Ciputra", "Biệt thự song lập 3 tầng, sân vườn rộng, hồ bơi riêng."),
    (2, "nha-pho", "Nhà phố 4 tầng 80 m² – đường Lê Văn Sỹ, Quận 3, TP.HCM", 16_800_000_000, 100_000_000, 80,
     "TP. Hồ Chí Minh", "Quận 3", "Phường 13", "Đường Lê Văn Sỹ", "Nhà 1 trệt 3 lầu, ngang 4 m, vừa ở vừa kinh doanh."),
    (3, "can-ho", "Căn hộ 3PN 112 m² – Vinhomes Central Park, Bình Thạnh, TP.HCM", 9_600_000_000, 50_000_000, 112,
     "TP. Hồ Chí Minh", "Bình Thạnh", "Phường 22", "Đường Nguyễn Hữu Cảnh", "Căn góc tầng 25, view sông, đã có sổ hồng."),
    (4, "dat-o", "Đất ở 150 m² – Phường Hoà Hải, Ngũ Hành Sơn, Đà Nẵng", 7_200_000_000, 50_000_000, 150,
     "Đà Nẵng", "Ngũ Hành Sơn", "Hoà Hải", "Đường Trường Sa", "Lô đất ở đô thị gần biển, đường 10,5 m, sổ đỏ riêng."),
    (5, "kho-xuong", "Nhà xưởng 2.000 m² – KCN Tân Uyên, Bình Dương", 28_000_000_000, 200_000_000, 2000,
     "Bình Dương", "Tân Uyên", "Khánh Bình", "Khu công nghiệp Tân Uyên", "Xưởng khung thép cao 10 m, PCCC đạt chuẩn."),
    (6, "nha-pho", "Shophouse 5 × 20 m – Vạn Phúc City, TP. Thủ Đức, TP.HCM", 21_500_000_000, 100_000_000, 100,
     "TP. Hồ Chí Minh", "TP. Thủ Đức", "Hiệp Bình Phước", "Khu đô thị Vạn Phúc", "Shophouse 1 trệt 4 lầu, mặt tiền 5 m."),
    (7, "van-phong", "Sàn văn phòng 250 m² – Duy Tân, Cầu Giấy, Hà Nội", 11_400_000_000, 50_000_000, 250,
     "Hà Nội", "Cầu Giấy", "Dịch Vọng Hậu", "Phố Duy Tân", "Sàn văn phòng hạng B tầng 12, sở hữu lâu dài."),
    (8, "nha-rieng", "Nhà riêng 4 tầng 65 m² – ngõ Thái Hà, Đống Đa, Hà Nội", 8_200_000_000, 50_000_000, 65,
     "Hà Nội", "Đống Đa", "Trung Liệt", "Phố Thái Hà", "Nhà 4 tầng ngõ ô tô tránh, cách phố 30 m."),
    (9, "dat-o", "Đất nền 120 m² – KDC Phú Hữu, TP. Thủ Đức, TP.HCM", 6_000_000_000, 50_000_000, 120,
     "TP. Hồ Chí Minh", "TP. Thủ Đức", "Phú Hữu", "Đường Nguyễn Duy Trinh", "Đất nền khu dân cư hiện hữu, sổ đỏ riêng."),
    (10, "can-ho", "Căn hộ 2PN 75 m² – Masteri Thảo Điền, TP. Thủ Đức, TP.HCM", 5_400_000_000, 50_000_000, 75,
     "TP. Hồ Chí Minh", "TP. Thủ Đức", "Thảo Điền", "Xa lộ Hà Nội", "Căn hộ tầng trung, nội thất cơ bản, đã có sổ hồng."),
    (11, "nha-pho", "Nhà phố 3 tầng 90 m² – đường Phan Đăng Lưu, Phú Nhuận, TP.HCM", 13_200_000_000, 100_000_000, 90,
     "TP. Hồ Chí Minh", "Phú Nhuận", "Phường 7", "Đường Phan Đăng Lưu", "Nhà mặt tiền kinh doanh, ngang 4,5 m."),
    (12, "biet-thu", "Biệt thự 250 m² – KĐT Ecopark, Văn Giang, Hưng Yên", 18_500_000_000, 100_000_000, 250,
     "Hưng Yên", "Văn Giang", "Xuân Quan", "Khu đô thị Ecopark", "Biệt thự đơn lập ven hồ, hoàn thiện mặt ngoài."),
    (13, "dat-o", "Đất thổ cư 500 m² – Long Thành, Đồng Nai", 9_800_000_000, 50_000_000, 500,
     "Đồng Nai", "Long Thành", "Long Đức", "Quốc lộ 51", "Đất thổ cư 300 m², còn lại đất trồng cây lâu năm."),
    (14, "kho-xuong", "Kho bãi 1.200 m² – KCN Đình Vũ, Hải An, Hải Phòng", 15_000_000_000, 100_000_000, 1200,
     "Hải Phòng", "Hải An", "Đông Hải 2", "Khu công nghiệp Đình Vũ", "Kho bãi có văn phòng điều hành, gần cảng."),
]
LST = {r[0]: r for r in LISTINGS}


def price(n):
    return LST[n][3]


def step(n):
    return LST[n][4]


def deposit(n):
    return price(n) // 10


ONLINE_VENUE = "Trực tuyến trên Tài Sản Đấu Giá (phòng đấu giá trực tuyến của sàn)"
ONSITE_VENUE = f"Hội trường {ORG_NAME}"

# ─── 12 phiên ─────────────────────────────────────────────────────────────────
S7_START = (NOW + timedelta(hours=23)).replace(minute=0)
S8_START = NOW.replace(minute=0) - timedelta(hours=1)

# k, tiêu đề, hình thức, mở bán, hạn bán, giờ đấu, giờ kết thúc, lô (n tin), tiền hồ sơ
SESSIONS = [
    (1, "Biệt thự song lập KĐT Ciputra, Tây Hồ", "truc_tiep", d(5, 8), d(25, 17), d(28, 9), d(28, 11), [1], 1_000_000),
    (2, "Nhà phố đường Lê Văn Sỹ, Quận 3", "truc_tuyen", d(-3, 8), d(20, 17), d(23, 9), d(23, 11), [2], 500_000),
    (3, "Căn hộ 3PN Vinhomes Central Park, Bình Thạnh", "truc_tiep", d(-5, 8), d(15, 17), d(18, 9), d(18, 11), [3], 500_000),
    (4, "Đất ở Hoà Hải, Ngũ Hành Sơn, Đà Nẵng", "truc_tuyen", d(-10, 8), d(12, 17), d(15, 9), d(15, 11), [4], 500_000),
    (5, "Nhà xưởng KCN Tân Uyên, Bình Dương", "truc_tiep", d(-12, 8), d(10, 17), d(13, 14), d(13, 16), [5], 1_000_000),
    (6, "Shophouse Vạn Phúc City, TP. Thủ Đức", "truc_tuyen", d(-15, 8), d(7, 17), d(10, 9), d(10, 11), [6], 500_000),
    (7, "Sàn văn phòng Duy Tân, Cầu Giấy", "truc_tuyen", d(-20, 8), d(-2, 17), S7_START, S7_START + timedelta(hours=2),
     [7], 500_000),
    (8, "Nhà riêng Thái Hà và đất nền Phú Hữu", "truc_tuyen", d(-20, 8), d(-3, 17), S8_START, d(7, 17), [8, 9], 500_000),
    (9, "Căn hộ Masteri Thảo Điền và nhà phố Phan Đăng Lưu", "truc_tuyen", d(-25, 8), d(-6, 17), d(-3, 9), d(-3, 11),
     [10, 11], 500_000),
    (10, "Biệt thự KĐT Ecopark, Văn Giang", "truc_tuyen", d(-30, 8), d(-10, 17), d(-7, 9), d(-7, 11), [12], 500_000),
    (11, "Đất thổ cư Long Thành, Đồng Nai", "truc_tuyen", d(-28, 8), d(-8, 17), d(-5, 14), d(-5, 16), [13], 500_000),
    (12, "Kho bãi KCN Đình Vũ, Hải Phòng", "truc_tiep", d(-14, 8), d(5, 17), d(8, 9), d(8, 11), [14], 500_000),
]
SES = {s[0]: s for s in SESSIONS}
SESSION_IDS = "{" + ",".join(session_id(k) for k in SES) + "}"
LISTING_IDS = "{" + ",".join(listing_id(n) for n in LST) + "}"
CANCEL_REASON = "Chủ tài sản đã tất toán khoản nợ và rút yêu cầu bán đấu giá tài sản."


def session_deposit(k):
    return sum(deposit(n) for n in SES[k][7])


# ─── SQL ──────────────────────────────────────────────────────────────────────
def as_uid(uid):
    return f"select set_config('request.jwt.claims', {lit(json.dumps({'sub': uid, 'role': 'authenticated'}))}, true);"


AS_SYSTEM = od.AS_SYSTEM
BIDDING_ON = "select set_config('app.bidding_rpc', 'on', true);"


def ctx(reason, lot=None):
    return f"select public._bidding_ctx({lit(reason)}, {lit(lot)}::uuid);"


def setup_sql():
    today = T.isoformat()
    since = (T - timedelta(days=60)).isoformat()
    return [f"""
-- Hợp đồng hợp tác bán hồ sơ (auction_dossier_terms cần supplier + hợp đồng + dòng dịch vụ còn hiệu lực).
insert into suppliers (id, name, supplier_type, default_commission_type, default_commission_rate, note, status, auction_org_id)
values ({lit(SUPPLIER)}, {lit(ORG_NAME)}, 'company', 'percent', 5, 'Dữ liệu demo — bộ người mua harleyngx (seed-harley-buyer-demo.py).',
  'active', {lit(AORG)});
insert into supplier_contracts (id, supplier_id, contract_no, title, signed_date, effective_from, status, note)
values ({lit(SUPPLIER_CONTRACT)}, {lit(SUPPLIER)}, 'DEMO-HT-2026-VN', 'Hợp đồng hợp tác bán hồ sơ tham gia đấu giá (demo)',
  date {lit(since)}, date {lit(since)}, 'active', 'Dữ liệu demo.');
insert into supplier_contract_lines (id, contract_id, service_id, commission_type, commission_value, is_active, sort_order, note)
values ({lit(SUPPLIER_LINE)}, {lit(SUPPLIER_CONTRACT)}, {lit(DOSSIER_SERVICE)}, 'percent', 5, true, 0, 'Dữ liệu demo.');
select case when not exists (select 1 from auction_dossier_terms({lit(AORG)}, 500000, date {lit(today)}))
  then pg_temp.ok('{{"ok":false,"reason":"hop_dong_hop_tac_khong_co_hieu_luc"}}') end;

insert into asset_owners (id, name, owner_kind, address)
values ({lit(SELLER)}, {lit(SELLER_NAME)}, 'company', 'Quận 1, TP. Hồ Chí Minh (pháp nhân hư cấu — dữ liệu minh hoạ)');"""]


def listings_sql():
    out = []
    for n, kind, title, start, stp, area, prov, dist, ward, street, desc in LISTINGS:
        k = next(s[0] for s in SESSIONS if n in s[7])
        s = SES[k]
        ca = {"auction_time": iso(s[5]), "registration_deadline": iso(s[4]), "asset_owner_name": SELLER_NAME,
              "deposit_amount": deposit(n), "document_fee": s[8], "bid_step": stp,
              "auction_location": ONLINE_VENUE if s[2] == "truc_tuyen" else ONSITE_VENUE,
              "org_name": ORG_NAME, "seed_batch": "harley_buyer_demo"}
        addr = {"province": prov, "district": dist, "ward": ward, "street": street}
        legal = "Sổ hồng" if kind in ("nha-pho", "can-ho", "van-phong", "nha-rieng", "biet-thu") else "Sổ đỏ"
        out.append(f"""
insert into listings (id, title, description, purpose, property_type_slug, price, area, image_url, legal_status, address,
  auction_org_id, asset_owner_id, status, price_unit, custom_attributes, views_count, created_at, updated_at)
values ({lit(listing_id(n))}, {lit(title)}, {lit(DEMO_NOTE + chr(10) + chr(10) + desc)}, 'FOR_SALE', {lit(kind)}, {start},
  {area}, {lit(IMG.format(kind))}, {lit(legal)}, {lit(addr)}, {lit(AORG)}, {lit(SELLER)}, 'ACTIVE', 'TOTAL', {lit(ca)},
  {90 + n * 37}, {ts(s[3] - timedelta(days=3))}, {ts(s[3] - timedelta(days=3))});""")
    return out


def session_sql(k):
    _k, title, fmt, reg_start, reg_end, starts, ends, lots, fee = SES[k]
    sess = session_id(k)
    created = reg_start - timedelta(days=2)
    temp_start = NOW + timedelta(days=90)
    venue = ONLINE_VENUE if fmt == "truc_tuyen" else ONSITE_VENUE
    prov = LST[lots[0]][6]
    out = [AS_SYSTEM, f"""
-- ── Phiên {k}: {title} ──
insert into auction_sessions (id, organization_id, title, description, auction_format, venue, province,
  registration_start_at, registration_end_at, viewing_start_at, viewing_end_at, starts_at, ends_at,
  max_registrants, dossier_fee, bidding_method, extension_seconds, max_bid_steps, checkin_lead_minutes,
  checkin_grace_minutes, status, created_by, created_at, updated_at)
values ({lit(sess)}, {lit(ORG)}, {lit('[DEMO] ' + title)},
  'Phiên DỮ LIỆU MẪU phục vụ trình diễn các trạng thái của người mua trên sàn. Không phải phiên đấu giá thật.',
  {lit(fmt)}, {lit(venue)}, {lit(prov)}, {ts(reg_start)}, {ts(reg_end)}, {ts(reg_start + timedelta(days=2))},
  {ts(reg_end - timedelta(days=1))}, {ts(temp_start)}, {ts(temp_start + timedelta(hours=2))},
  50, {fee}, 'ascending', 300, 10, {1440 if k == 7 else 60}, 0, 'draft', {lit(OWNER)}, {ts(created)}, {ts(created)});"""]
    for j, n in enumerate(lots, start=1):
        out.append(f"""
insert into auction_session_items (id, session_id, source, listing_id, title, category_slug, province, district, image_url,
  starting_price, deposit_amount, bid_step, max_registrants, created_at, updated_at)
select {lit(lot_id(k, j))}, {lit(sess)}, 'listing', l.id, l.title, l.property_type_slug, l.address->>'province',
  l.address->>'district', l.image_url, {price(n)}, {deposit(n)}, {step(n)}, 50, {ts(created)}, {ts(created)}
  from listings l where l.id = {lit(listing_id(n))};""")
    # Công bố qua CỔNG THẬT (giờ đấu tạm ở tương lai) rồi mới đặt giờ thật + lùi published_at.
    out += [f"update auction_sessions set status = 'published' where id = {lit(sess)};", BIDDING_ON,
            "alter table auction_sessions disable trigger auction_sessions_guard;",
            f"update auction_sessions set starts_at = {ts(starts)}, ends_at = {ts(ends)}, "
            f"published_at = {ts(reg_start - timedelta(days=1))} where id = {lit(sess)};",
            "alter table auction_sessions enable trigger auction_sessions_guard;"]
    return out


def contract_sql(k, j, who, *, status="paid", paid=None, review="approved", reviewed=None, note=None,
                 deposit_at=None, checkin=None, bidder_no=None):
    """Một hồ sơ tham gia. deposit_at ⇒ đã nộp tiền đặt trước (cả phiên); checkin ⇒ đã điểm danh trực tuyến."""
    uid, name, idn, dob, gender, phone, email, addr = PEOPLE[who]
    cid, sess, fee = contract_id(k, j), session_id(k), SES[k][8]
    fmt = SES[k][2]
    created = (paid or NOW) - timedelta(minutes=12)
    pending = status == "pending_payment"
    dep = deposit_at is not None
    cols = {
        "id": lit(cid), "code": "'HSDG' || lpad(nextval('public.auction_bidding_contract_code_seq')::text, 6, '0')",
        "session_id": lit(sess), "organization_id": lit(ORG), "user_id": lit(uid), "full_name": lit(name),
        "id_type": "'cccd'", "id_number": lit(idn), "date_of_birth": f"date {lit(dob)}", "gender": lit(gender),
        "phone": lit(phone), "email": lit(email), "address": lit(addr), "identity_source": "'vneid'",
        "fee_amount": str(fee), "status": lit(status),
        "hold_expires_at": ts(NOW + timedelta(minutes=15)) if pending else "NULL",
        "paid_at": "NULL" if pending else ts(paid),
        "payment_txn_ref": "NULL" if pending else lit(f"DEMO-HB-VNP-{k:02d}{j}"),
        "review_status": lit("pending" if pending else review),
        "review_note": lit(note), "reviewed_at": ts(reviewed), "reviewed_by": lit(OWNER) if reviewed else "NULL",
        "deposit_status": "'received'" if dep else "'pending'",
        "deposit_amount_received": str(session_deposit(k)) if dep else "NULL",
        "deposit_received_at": ts(deposit_at), "deposit_status_changed_at": ts(deposit_at),
        "deposit_method": "'bank_transfer'" if dep else "NULL",
        "deposit_txn_ref": lit(f"DEMO-HB-UNC-{k:02d}{j}") if dep else "NULL",
        "deposit_note": lit("Chuyển khoản tiền đặt trước (dữ liệu mẫu)") if dep else "NULL",
        "deposit_updated_by": lit(OWNER) if dep else "NULL",
        "bidder_no": str(bidder_no) if checkin else "NULL", "bidder_no_assigned_at": ts(checkin),
        "checked_in_at": ts(checkin), "checkin_channel": ("'online'" if fmt == "truc_tuyen" else "'onsite'") if checkin else "NULL",
        "checkin_attendee": "'principal'" if checkin else "NULL",
        "created_at": ts(created), "updated_at": ts(paid or created),
    }
    out = [f"insert into auction_bidding_contracts ({', '.join(cols)})\nvalues ({', '.join(cols.values())});"]
    # Insert thẳng 'paid' không qua trigger 'submitted' ⇒ tự ghi lịch sử duyệt (bảng chỉ-ghi-thêm, chỉ INSERT).
    if not pending:
        out.append(f"insert into auction_contract_review_events (contract_id, kind, note, actor_id, at) "
                   f"values ({lit(cid)}, 'submitted', null, {lit(uid)}, {ts(paid)});")
        if reviewed:
            out.append(f"insert into auction_contract_review_events (contract_id, kind, note, actor_id, at) "
                       f"values ({lit(cid)}, {lit(review)}, {lit(note or 'Hồ sơ hợp lệ.')}, {lit(OWNER)}, {ts(reviewed)});")
    return out


def bids_sql(k, j, bids, opened, ends, *, closed_at=None, winner=None):
    """bids = [(người, hồ sơ j, SBD, số bước trên giá khởi điểm, phút sau khi mở lô)]."""
    n = SES[k][7][j - 1]
    lot, sess = lot_id(k, j), session_id(k)
    out = [f"insert into auction_lot_events (session_id, lot_id, kind, actor_id, payload, at) values "
           f"({lit(sess)}, {lit(lot)}, 'open', {lit(OWNER)}, jsonb_build_object('ends_at', {ts(ends)}), {ts(opened)});"]
    last = None
    for seq, (who, cj, no, steps, minute) in enumerate(bids, start=1):
        amount = price(n) + steps * step(n)
        at = opened + timedelta(minutes=minute)
        last = (bid_id(k, j, seq), no, amount, contract_id(k, cj))
        out.append(f"insert into auction_bids (id, lot_id, session_id, contract_id, bidder_no, seq, amount, placed_at, client_nonce) "
                   f"values ({lit(last[0])}, {lit(lot)}, {lit(sess)}, {lit(last[3])}, {no}, {seq}, {amount}, {ts(at)}, "
                   f"{lit(f'DEMOHB{k:02d}{j}{seq:02d}')});")
        out.append(f"insert into auction_lot_events (session_id, lot_id, kind, actor_id, payload, at) values "
                   f"({lit(sess)}, {lit(lot)}, 'bid', {lit(PEOPLE[who][0])}, jsonb_build_object('amount', {amount}, "
                   f"'bidder_no', {no}, 'seq', {seq}), {ts(at)});")
    bid, leader, amount, winner_cid = last
    if closed_at is None:
        out.append(f"""insert into auction_lot_states (lot_id, session_id, status, opened_at, ends_at, current_price, current_bid_id,
  leading_bidder_no, bid_count, extension_count, created_at, updated_at)
values ({lit(lot)}, {lit(sess)}, 'open', {ts(opened)}, {ts(ends)}, {amount}, {lit(bid)}, {leader}, {len(bids)}, 0,
  {ts(opened)}, {ts(opened + timedelta(minutes=bids[-1][4]))});""")
    else:
        out.append(f"""insert into auction_lot_states (lot_id, session_id, status, opened_at, closed_at, ends_at, current_price,
  current_bid_id, leading_bidder_no, bid_count, extension_count, result, winner_contract_id, winning_amount, payment_due_at,
  payment_status, created_at, updated_at)
values ({lit(lot)}, {lit(sess)}, 'closed', {ts(opened)}, {ts(closed_at)}, {ts(closed_at)}, {amount}, {lit(bid)}, {leader},
  {len(bids)}, 0, 'sold', {lit(winner_cid)}, {amount}, {ts(closed_at + timedelta(days=30))}, 'pending', {ts(opened)}, {ts(closed_at)});""")
        out.append(f"insert into auction_lot_events (session_id, lot_id, kind, actor_id, payload, at) values "
                   f"({lit(sess)}, {lit(lot)}, 'close', null, jsonb_build_object('result', 'sold', 'winning_amount', {amount}), "
                   f"{ts(closed_at)});")
    return out


def roster_sql(k, at):
    return [BIDDING_ON, f"update auction_sessions set roster_closed_at = {ts(at)} where id = {lit(session_id(k))};"]


def finalize_sql(k, at, outcomes):
    """outcomes = [(hồ sơ j, 'applied' | 'pending_refund', lô j | None)] cho mọi hồ sơ còn 'received'."""
    out = []
    for cj, status, won in outcomes:
        reason = ("Trúng đấu giá — tiền đặt trước chuyển thành tiền mua tài sản" if status == "applied"
                  else "Không trúng đấu giá — chờ hoàn trả tiền đặt trước")
        out += [ctx(reason, lot_id(k, won) if won else None),
                f"update auction_bidding_contracts set deposit_status = {lit(status)}, deposit_status_changed_at = {ts(at)} "
                f"where id = {lit(contract_id(k, cj))};"]
    applied = sum(1 for o in outcomes if o[1] == "applied")
    lots = len(SES[k][7])
    out += [ctx(None), f"update auction_sessions set finalized_at = {ts(at)}, finalized_by = {lit(OWNER)} where id = {lit(session_id(k))};",
            f"insert into auction_lot_events (session_id, lot_id, kind, actor_id, payload, at) values ({lit(session_id(k))}, null, "
            f"'finalize', {lit(OWNER)}, jsonb_build_object('applied', {applied}, 'pending_refund', {len(outcomes) - applied}, "
            f"'sold', {lots}, 'unsold', 0, 'withdrawn', 0), {ts(at)});"]
    return out


def states_sql():
    s = []
    # 1 — sắp mở bán: chỉ có phiên.
    s += session_sql(1)

    # 2 — đang bán, harleyngx chưa đăng ký; 3 người khác đã mua.
    s += session_sql(2)
    s += contract_sql(2, 1, "B1", paid=d(-2, 10), reviewed=d(-1, 9))
    s += contract_sql(2, 2, "B2", paid=d(-1, 15), review="pending")
    s += contract_sql(2, 3, "B3", paid=d(-2, 20), reviewed=d(-1, 9, 30), deposit_at=d(-1, 14))

    # 3 — giữ chỗ chờ thanh toán.
    s += session_sql(3)
    s += contract_sql(3, 1, "H", status="pending_payment")

    # 4 — đã trả, chờ duyệt.
    s += session_sql(4)
    s += contract_sql(4, 1, "H", paid=d(-1, 10, 20), review="pending")

    # 5 — tổ chức yêu cầu bổ sung.
    s += session_sql(5)
    s += contract_sql(5, 1, "H", paid=d(-4, 16), review="needs_info", reviewed=d(-3, 10),
                      note="Ảnh CCCD mặt sau bị mờ, không đọc được ngày cấp. Vui lòng chụp lại và nộp bổ sung.")

    # 6 — đã duyệt, chưa nộp tiền đặt trước.
    s += session_sql(6)
    s += contract_sql(6, 1, "H", paid=d(-6, 9, 40), reviewed=d(-5, 11))

    # 7 — đã nộp tiền đặt trước, đang mở điểm danh trực tuyến (24 giờ trước giờ đấu).
    s += session_sql(7)
    s += contract_sql(7, 1, "H", paid=d(-9, 11), reviewed=d(-8, 9), deposit_at=d(-4, 15))
    s += contract_sql(7, 2, "B1", paid=d(-8, 14), reviewed=d(-7, 9), deposit_at=d(-4, 10),
                      checkin=NOW - timedelta(minutes=50), bidder_no=19)

    # 8 — đang diễn ra: harleyngx (SBD 27) trúng lô 1 (đã đóng), bị B1 vượt ở lô 2 đang mở.
    # Lô đấu LẦN LƯỢT — mỗi phiên chỉ một lô mở/tạm dừng (org_open_lot + uq_auction_lot_states_one_live):
    # lô 2 mở SAU khi lô 1 đóng, và lượt cuối của lô 2 phải trước NOW (st8 ≥ NOW − 60 phút).
    st8 = S8_START
    s += session_sql(8)
    s += contract_sql(8, 1, "H", paid=d(-10, 10), reviewed=d(-9, 9), deposit_at=d(-5, 14),
                      checkin=st8 - timedelta(minutes=40), bidder_no=27)
    s += contract_sql(8, 2, "B1", paid=d(-12, 9), reviewed=d(-11, 9), deposit_at=d(-6, 10),
                      checkin=st8 - timedelta(minutes=55), bidder_no=8)
    s += contract_sql(8, 3, "B2", paid=d(-11, 15), reviewed=d(-10, 9), deposit_at=d(-6, 11),
                      checkin=st8 - timedelta(minutes=25), bidder_no=51)
    s += roster_sql(8, st8)
    s += bids_sql(8, 1, [("B1", 2, 8, 0, 6), ("H", 1, 27, 1, 13), ("B2", 3, 51, 3, 20), ("H", 1, 27, 5, 27)],
                  st8 + timedelta(minutes=5), st8 + timedelta(minutes=35), closed_at=st8 + timedelta(minutes=35))
    s += bids_sql(8, 2, [("H", 1, 27, 0, 2), ("B2", 3, 51, 2, 6), ("H", 1, 27, 3, 10), ("B1", 2, 8, 5, 15)],
                  st8 + timedelta(minutes=38), d(5, 15))

    # 9 — đã chốt: harleyngx (SBD 12) trúng lô 1, B1 trúng lô 2, B2 không trúng.
    st9 = SES[9][5]
    s += session_sql(9)
    s += contract_sql(9, 1, "H", paid=d(-18, 10), reviewed=d(-17, 9), deposit_at=d(-8, 14),
                      checkin=st9 - timedelta(minutes=35), bidder_no=12)
    s += contract_sql(9, 2, "B1", paid=d(-19, 9), reviewed=d(-18, 9), deposit_at=d(-8, 10),
                      checkin=st9 - timedelta(minutes=50), bidder_no=5)
    s += contract_sql(9, 3, "B2", paid=d(-17, 15), reviewed=d(-16, 9), deposit_at=d(-8, 11),
                      checkin=st9 - timedelta(minutes=20), bidder_no=33)
    s += roster_sql(9, st9)
    s += bids_sql(9, 1, [("B2", 3, 33, 0, 5), ("H", 1, 12, 2, 11), ("B2", 3, 33, 4, 19), ("H", 1, 12, 5, 26)],
                  st9 + timedelta(minutes=5), st9 + timedelta(minutes=40), closed_at=st9 + timedelta(minutes=40))
    s += bids_sql(9, 2, [("B1", 2, 5, 0, 7), ("H", 1, 12, 1, 15), ("B1", 2, 5, 3, 31)],
                  st9 + timedelta(minutes=45), st9 + timedelta(minutes=105), closed_at=st9 + timedelta(minutes=105))
    s += finalize_sql(9, SES[9][6] + timedelta(minutes=15), [(1, "applied", 1), (2, "applied", 2), (3, "pending_refund", None)])

    # 10 — đã chốt, harleyngx (SBD 9) không trúng → đã hoàn trả tiền đặt trước.
    st10 = SES[10][5]
    s += session_sql(10)
    s += contract_sql(10, 1, "H", paid=d(-24, 10), reviewed=d(-23, 9), deposit_at=d(-12, 14),
                      checkin=st10 - timedelta(minutes=30), bidder_no=9)
    s += contract_sql(10, 2, "B2", paid=d(-22, 15), reviewed=d(-21, 9), deposit_at=d(-12, 11),
                      checkin=st10 - timedelta(minutes=45), bidder_no=21)
    s += roster_sql(10, st10)
    s += bids_sql(10, 1, [("B2", 2, 21, 0, 4), ("H", 1, 9, 1, 9), ("B2", 2, 21, 3, 16), ("H", 1, 9, 4, 24),
                          ("B2", 2, 21, 5, 37)],
                  st10 + timedelta(minutes=5), st10 + timedelta(minutes=100), closed_at=st10 + timedelta(minutes=100))
    s += finalize_sql(10, SES[10][6] + timedelta(minutes=20), [(1, "pending_refund", None), (2, "applied", 1)])
    s += [ctx("Đã hoàn trả tiền đặt trước"),
          f"update auction_bidding_contracts set deposit_status = 'refunded', deposit_status_changed_at = {ts(d(-5, 10))}, "
          f"deposit_updated_by = {lit(OWNER)}, deposit_note = 'Đã hoàn trả tiền đặt trước qua chuyển khoản (dữ liệu mẫu)' "
          f"where id = {lit(contract_id(10, 1))};", ctx(None)]

    # 11 — harleyngx vắng mặt (không điểm danh) → tịch thu tiền đặt trước; B3 trúng.
    st11 = SES[11][5]
    s += session_sql(11)
    s += contract_sql(11, 1, "H", paid=d(-20, 10), reviewed=d(-19, 9), deposit_at=d(-9, 14))
    s += contract_sql(11, 2, "B1", paid=d(-21, 9), reviewed=d(-20, 9), deposit_at=d(-9, 10),
                      checkin=st11 - timedelta(minutes=40), bidder_no=14)
    s += contract_sql(11, 3, "B3", paid=d(-19, 15), reviewed=d(-18, 9), deposit_at=d(-9, 11),
                      checkin=st11 - timedelta(minutes=15), bidder_no=40)
    s += roster_sql(11, st11)
    s += [ctx("Vắng mặt — không điểm danh"),
          f"update auction_bidding_contracts set absent_at = {ts(st11)}, deposit_status = 'forfeited', "
          f"deposit_status_changed_at = {ts(st11)}, deposit_note = 'Vắng mặt — không điểm danh', deposit_updated_by = null "
          f"where id = {lit(contract_id(11, 1))};", ctx(None)]
    s += bids_sql(11, 1, [("B1", 2, 14, 0, 6), ("B3", 3, 40, 1, 14), ("B1", 2, 14, 2, 22)],
                  st11 + timedelta(minutes=5), st11 + timedelta(minutes=90), closed_at=st11 + timedelta(minutes=90))
    s += finalize_sql(11, SES[11][6] + timedelta(minutes=10), [(2, "applied", 1), (3, "pending_refund", None)])

    # 12 — đã trả + đã duyệt rồi phiên bị huỷ.
    s += session_sql(12)
    s += contract_sql(12, 1, "H", paid=d(-6, 11), reviewed=d(-5, 9))
    s += [AS_SYSTEM, f"update auction_sessions set status = 'cancelled', cancelled_reason = {lit(CANCEL_REASON)} "
                     f"where id = {lit(session_id(12))};"]
    return s


def fixups_sql():
    """Sổ tiền đặt trước ghi bằng trigger lúc chạy ⇒ lùi mốc về đúng thời điểm nghiệp vụ."""
    return ["alter table auction_deposit_events disable trigger auction_deposit_events_append_only;", f"""
update auction_deposit_events e
   set at = case e.kind when 'received' then c.deposit_received_at
                        when 'forfeited' then c.absent_at
                        when 'refunded' then c.deposit_status_changed_at
                        else s.finalized_at end,
       actor_id = case when e.kind in ('received', 'refunded') then {lit(OWNER)}::uuid end
  from auction_bidding_contracts c join auction_sessions s on s.id = c.session_id
 where e.contract_id = c.id and c.session_id = any({lit(SESSION_IDS)}::uuid[]);""",
            "alter table auction_deposit_events enable trigger auction_deposit_events_append_only;"]


def sale_contract_sql():
    """Phiên 9: tổ chức lập hợp đồng mua bán lô 1 cho harleyngx + chia sẻ dự thảo ⇒ chờ ký."""
    return [as_uid(OWNER),
            f"alter table auction_sale_contracts alter column id set default {lit(SALE_CONTRACT)}::uuid;",
            f"select pg_temp.ok(public.org_create_sale_contract({lit(lot_id(9, 1))}, 'org', false, {ts(NOW + timedelta(days=7))}));",
            "alter table auction_sale_contracts alter column id set default gen_random_uuid();",
            f"select pg_temp.ok(public.sale_contract_share_draft({lit(SALE_CONTRACT)}, {lit(SALE_DRAFT)}, true));",
            AS_SYSTEM]


def checks_sql():
    return [f"""
do $check$
declare v jsonb;
begin
  select jsonb_object_agg(s.title, coalesce(c.st, '-')) into v
    from auction_sessions s
    left join lateral (
      select concat_ws('/', x.status, x.review_status, x.deposit_status,
                       case when x.checked_in_at is not null then 'in' end, case when x.absent_at is not null then 'absent' end) st
        from auction_bidding_contracts x where x.session_id = s.id and x.user_id = {lit(HARLEY)}) c on true
   where s.id = any({lit(SESSION_IDS)}::uuid[]);
  raise notice 'harleyngx theo phiên: %', v;

  if (select count(*) from auction_sessions where id = any({lit(SESSION_IDS)}::uuid[])) <> 12 then
    raise exception 'Phải có đủ 12 phiên.';
  end if;
  if (select count(*) from auction_bidding_contracts where user_id = {lit(HARLEY)} and session_id = any({lit(SESSION_IDS)}::uuid[])) <> 10 then
    raise exception 'harleyngx phải có 10 hồ sơ.';
  end if;
  if not (select sale_enabled from (select (auction_session_contract_summary({lit(session_id(2))}) ->> 'sale_enabled')::boolean sale_enabled) z) then
    raise exception 'Phiên 2 phải mở bán hồ sơ (hợp đồng hợp tác).';
  end if;
  if (select status || ':' || leading_bidder_no from auction_lot_states where lot_id = {lit(lot_id(8, 1))}) <> 'closed:27'
     or (select status from auction_lot_states where lot_id = {lit(lot_id(8, 2))}) <> 'open'
     or (select leading_bidder_no from auction_lot_states where lot_id = {lit(lot_id(8, 2))}) = 27 then
    raise exception 'Phiên 8: harleyngx phải trúng lô 1 (đã đóng) và bị vượt ở lô 2 đang mở.';
  end if;
  if (select status from auction_sale_contracts where id = {lit(SALE_CONTRACT)}) <> 'awaiting_signatures'
     or (select buyer_user_id from auction_sale_contracts where id = {lit(SALE_CONTRACT)}) <> {lit(HARLEY)} then
    raise exception 'Phiên 9: hợp đồng mua bán phải chờ ký với bên mua là harleyngx.';
  end if;
  if (select deposit_status from auction_bidding_contracts where id = {lit(contract_id(10, 1))}) <> 'refunded'
     or (select deposit_status from auction_bidding_contracts where id = {lit(contract_id(11, 1))}) <> 'forfeited' then
    raise exception 'Phiên 10/11: tiền đặt trước của harleyngx phải đã hoàn / bị tịch thu.';
  end if;
  if exists (select 1 from auction_deposit_events e join auction_bidding_contracts c on c.id = e.contract_id
              where c.session_id = any({lit(SESSION_IDS)}::uuid[]) and e.at > now()) then
    raise exception 'Sổ tiền đặt trước còn mốc ở tương lai.';
  end if;
end $check$;""",
            f"select s.code || ' | ' || s.title || ' | /sessions/' || s.id from auction_sessions s "
            f"where s.id = any({lit(SESSION_IDS)}::uuid[]) order by s.id;"]


def seed_sql(commit):
    s = list(od.SQL_HEADER)
    s.append(f"select case when exists (select 1 from auction_sessions where id = {lit(session_id(1))}) "
             f"then pg_temp.ok('{{\"ok\":false,\"reason\":\"da_seed_roi_chay_teardown_truoc\"}}') end;")
    s += setup_sql()
    s += listings_sql()
    s += states_sql()
    s += sale_contract_sql()
    s += fixups_sql()
    s += checks_sql()
    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def teardown_sql():
    s = ["\\set ON_ERROR_STOP 1", "begin;",
         f"create temp table _o on commit drop as select order_id from auction_bidding_contracts "
         f"where session_id = any({lit(SESSION_IDS)}::uuid[]) and order_id is not null;"]
    off = [("auction_sale_payments", "auction_sale_payments_append_only"),
           ("auction_sale_contract_events", "auction_sale_contract_events_append_only"),
           ("auction_bids", "auction_bids_guard"),
           ("auction_lot_events", "auction_lot_events_append_only"),
           ("auction_deposit_events", "auction_deposit_events_append_only"),
           ("auction_session_minutes", "auction_session_minutes_append_only"),
           ("auction_contract_review_events", "auction_contract_review_events_append_only"),
           ("auction_session_items", "auction_session_items_guard_delete"),
           ("auction_session_items", "auction_session_items_bidding_lock")]
    s += [f"alter table {t} disable trigger {g};" for t, g in off]
    w = f"session_id = any({lit(SESSION_IDS)}::uuid[])"
    sale = f"(select id from auction_sale_contracts where {w})"
    s += [f"delete from auction_sale_contract_events where contract_id in {sale};",
          f"delete from auction_sale_payments where contract_id in {sale};",
          f"delete from auction_sale_installments where contract_id in {sale};",
          f"delete from auction_sale_contracts where {w};",
          f"delete from auction_session_minutes where {w};",
          f"delete from auction_lot_states where {w};",
          f"delete from auction_bids where {w};",
          f"delete from auction_lot_events where {w};",
          f"delete from auction_deposit_events where {w};",
          f"delete from auction_contract_review_events where contract_id in (select id from auction_bidding_contracts where {w});",
          f"delete from auction_bidding_contracts where {w};",
          "delete from orders where id in (select order_id from _o);",
          f"delete from auction_session_items where {w};",
          f"delete from auction_sessions where id = any({lit(SESSION_IDS)}::uuid[]);",
          f"delete from listings where id = any({lit(LISTING_IDS)}::uuid[]);",
          f"delete from asset_owners where id = {lit(SELLER)};",
          f"delete from supplier_contract_lines where id = {lit(SUPPLIER_LINE)};",
          f"delete from supplier_contracts where id = {lit(SUPPLIER_CONTRACT)};",
          f"delete from suppliers where id = {lit(SUPPLIER)};"]
    s += [f"alter table {t} enable trigger {g};" for t, g in off]
    s.append("commit;")
    return "\n".join(s) + "\n"


# ─── Storage ──────────────────────────────────────────────────────────────────
def upload_draft():
    lines = [
        f"Phiên đấu giá: [DEMO] {SES[9][1]}",
        f"Lô 1 — {LST[10][2]}",
        f"Giá trúng đấu giá: {price(10) + 5 * step(10):,} VNĐ",
        f"Tiền đặt trước chuyển thành tiền mua: {session_deposit(9):,} VNĐ",
        f"Còn phải thanh toán: {price(10) + 5 * step(10) - session_deposit(9):,} VNĐ",
        f"Bên bán: {ORG_NAME} ký thay chủ tài sản ({SELLER_NAME})",
        "Bên mua: Harley Nguyễn — người trúng đấu giá, số báo danh 12",
        f"Tổ chức đấu giá: {ORG_NAME}",
    ]
    blob = hdmb.doc_pdf("DỰ THẢO — CHƯA KÝ", "HỢP ĐỒNG MUA BÁN TÀI SẢN ĐẤU GIÁ", lines)
    if not hdmb.upload(od.KEY, SALE_DRAFT, blob):
        sys.exit("Không tải được dự thảo hợp đồng mua bán lên storage.")
    print(f"  tải {SALE_BUCKET}/{SALE_DRAFT} ({len(blob):,} bytes)")


def remove_sale_files():
    prefix = f"{ORG}/{SALE_CONTRACT}/"
    names = [prefix + o["name"] for o in api("POST", f"/storage/v1/object/list/{SALE_BUCKET}", {"prefix": prefix}) or []]
    if names:
        api("DELETE", f"/storage/v1/object/{SALE_BUCKET}", {"prefixes": names})
    print(f"  xoá {len(names)} tệp trong {SALE_BUCKET}/{prefix}")


def main():
    args = set(sys.argv[1:])
    if "--teardown" in args:
        print("Gỡ bộ demo người mua harleyngx…")
        psql(teardown_sql())
        remove_sale_files()
        print("Xong.")
        return
    commit = "--dry-run" not in args
    missing = psql(f"select 'thiếu ' || x from unnest(array[{', '.join(lit(p[0]) for p in PEOPLE.values())}, {lit(OWNER)}]) x "
                   f"where not exists (select 1 from auth.users u where u.id = x::uuid)", rows=True)
    if missing:
        sys.exit("Thiếu tài khoản: " + ", ".join(missing))
    print(f"Seed bộ demo người mua harleyngx (bây giờ {NOW:%Y-%m-%d %H:%M})…" + ("" if commit else " (dry-run, ROLLBACK)"))
    upload_draft()
    print(psql(seed_sql(commit)))
    print("Xong." if commit else "Dry-run xong — không ghi gì vào DB (tệp dự thảo PDF vẫn nằm trong storage).")


if __name__ == "__main__":
    main()
