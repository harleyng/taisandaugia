"""Hai phiên [DEMO] ĐANG DIỄN RA để xem phòng đấu giá của hai phương thức mới (20261018190000):

  13  Đặt giá xuống  — 1 tài sản đang mở: giá tự giảm 10,000,000 ₫ mỗi 10 phút từ 8,200,000,000 ₫ xuống
                       sàn 7,000,000,000 ₫ (~20 giờ). Chưa ai chấp nhận — harleyngx bấm "Chấp nhận giá" là trúng.
  14  Bỏ phiếu kín   — 1 tài sản đang nhận phiếu 24 giờ; 2 người khác đã nộp phiếu kín, harleyngx chưa nộp.

harleyngx (SBD 27) cùng B1 (SBD 8), B2 (SBD 51) đã điểm danh, đủ điều kiện trả giá. Tổ chức = ĐG Hợp danh
Việt Nam (chủ secsosoo) như bộ seed-harley-buyer-demo.py — bộ đó PHẢI đã seed (dùng lại pháp nhân hư cấu
và người mua). Lô được mở bằng RPC THẬT org_open_lot (dưới danh nghĩa chủ tổ chức), phiếu kín nộp bằng
submit_sealed_bid ⇒ đi đúng đường của engine.

    python3 scripts/seed-method-demo.py              # seed (dừng nếu đã seed)
    python3 scripts/seed-method-demo.py --dry-run    # chạy hết rồi ROLLBACK
    python3 scripts/seed-method-demo.py --teardown   # gỡ sạch 2 phiên (cả lượt / phiếu người dùng tự tạo)

Tài sản đóng theo giờ (đặt giá xuống ~20 giờ, bỏ phiếu kín 24 giờ) hoặc khi harleyngx chấp nhận giá —
muốn xem lại từ đầu: --teardown rồi seed lại. Id tiền tố ba7e, phiên 13/14 (không đụng 12 phiên của bộ gốc).
"""
import importlib.util
import sys
from datetime import timedelta
from pathlib import Path


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(file))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


hb = _load("harley_buyer_demo", "seed-harley-buyer-demo.py")
od, lit, ts, psql = hb.od, hb.lit, hb.ts, hb.psql
NOW, d = hb.NOW, hb.d

DESC, SEALED = 13, 14
START = NOW.replace(minute=0) - timedelta(hours=1)
END = hb.d(7, 17)
DROP_SECONDS = 600
SEALED_SECONDS = 86_400

# Tin minh hoạ của pháp nhân hư cấu (cùng khuôn LISTINGS của bộ gốc).
hb.LISTINGS += [
    (15, "nha-rieng", "Nhà riêng 5 tầng 70 m² – phố Hoàng Hoa Thám, Ba Đình, Hà Nội", 8_200_000_000, 10_000_000, 70,
     "Hà Nội", "Ba Đình", "Ngọc Hà", "Phố Hoàng Hoa Thám", "Nhà 5 tầng thang máy, ngõ ô tô, cách phố 20 m."),
    (16, "can-ho", "Căn hộ 3PN 120 m² – Sunwah Pearl, Bình Thạnh, TP.HCM", 12_000_000_000, 50_000_000, 120,
     "TP. Hồ Chí Minh", "Bình Thạnh", "Phường 22", "Đường Nguyễn Hữu Cảnh", "Căn góc tầng cao, view sông Sài Gòn."),
]
hb.LST.update({r[0]: r for r in hb.LISTINGS[-2:]})
FLOOR = {15: 7_000_000_000}
hb.SESSIONS += [
    (DESC, "Nhà riêng Hoàng Hoa Thám — ĐẶT GIÁ XUỐNG", "truc_tuyen", d(-20, 8), d(-3, 17), START, END, [15], 500_000),
    (SEALED, "Căn hộ Sunwah Pearl — BỎ PHIẾU KÍN", "truc_tuyen", d(-20, 8), d(-3, 17), START, END, [16], 500_000),
]
hb.SES.update({s[0]: s for s in hb.SESSIONS[-2:]})

SESSION_IDS = "{" + f"{hb.session_id(DESC)},{hb.session_id(SEALED)}" + "}"
LISTING_IDS = "{" + f"{hb.listing_id(15)},{hb.listing_id(16)}" + "}"
METHOD = {DESC: "descending", SEALED: "sealed"}


def listing_sql(n, k):
    _n, kind, title, start, stp, area, prov, dist, ward, street, desc = hb.LST[n]
    s = hb.SES[k]
    ca = {"auction_time": hb.iso(s[5]), "registration_deadline": hb.iso(s[4]), "asset_owner_name": hb.SELLER_NAME,
          "deposit_amount": hb.deposit(n), "document_fee": s[8], "bid_step": stp, "auction_location": hb.ONLINE_VENUE,
          "org_name": hb.ORG_NAME, "seed_batch": "method_demo"}
    addr = {"province": prov, "district": dist, "ward": ward, "street": street}
    return f"""
insert into listings (id, title, description, purpose, property_type_slug, price, area, image_url, legal_status, address,
  auction_org_id, asset_owner_id, status, price_unit, custom_attributes, views_count, created_at, updated_at)
values ({lit(hb.listing_id(n))}, {lit(title)}, {lit(hb.DEMO_NOTE + chr(10) + chr(10) + desc)}, 'FOR_SALE', {lit(kind)},
  {start}, {area}, {lit(hb.IMG.format(kind))}, 'Sổ hồng', {lit(addr)}, {lit(hb.AORG)}, {lit(hb.SELLER)}, 'ACTIVE', 'TOTAL',
  {lit(ca)}, {120 + n}, {ts(s[3] - timedelta(days=3))}, {ts(s[3] - timedelta(days=3))});"""


def session_sql(k):
    """Phiên của bộ gốc + phương thức (đặt lúc còn nháp, trước khi công bố)."""
    out = hb.session_sql(k)
    sess = hb.session_id(k)
    n = hb.SES[k][7][0]
    method = [f"update auction_sessions set bidding_method = {lit(METHOD[k])}, price_drop_seconds = {DROP_SECONDS} "
              f"where id = {lit(sess)};"]
    if n in FLOOR:
        method.append(f"update auction_session_items set floor_price = {FLOOR[n]} where id = {lit(hb.lot_id(k, 1))};")
    # Chèn ngay trước câu công bố.
    i = next(i for i, x in enumerate(out) if x.startswith("update auction_sessions set status = 'published'"))
    return out[:i] + method + out[i:]


def people_sql(k):
    s = []
    for j, (who, no, mins) in enumerate([("H", 27, 40), ("B1", 8, 55), ("B2", 51, 25)], start=1):
        s += hb.contract_sql(k, j, who, paid=d(-10, 10), reviewed=d(-9, 9), deposit_at=d(-5, 14),
                             checkin=START - timedelta(minutes=mins), bidder_no=no)
    return s + hb.roster_sql(k, START)


def states_sql():
    s = [listing_sql(15, DESC), listing_sql(16, SEALED)]
    s += session_sql(DESC) + people_sql(DESC)
    s += session_sql(SEALED) + people_sql(SEALED)
    # Mở lô bằng RPC thật (chủ tổ chức).
    s += [hb.as_uid(hb.OWNER),
          f"select pg_temp.ok(org_open_lot({lit(hb.lot_id(DESC, 1))}, null));",
          f"select pg_temp.ok(org_open_lot({lit(hb.lot_id(SEALED, 1))}, {SEALED_SECONDS}));"]
    # Hai người khác nộp phiếu kín (harleyngx để tự thử).
    for who, amount, nonce in [("B1", 12_350_000_000, "DEMOMD14B1"), ("B2", 12_500_000_000, "DEMOMD14B2")]:
        s += [hb.as_uid(hb.PEOPLE[who][0]),
              f"select pg_temp.ok(submit_sealed_bid({lit(hb.lot_id(SEALED, 1))}, {amount}, {lit(nonce)}));"]
    s.append(hb.AS_SYSTEM)
    return s


def checks_sql():
    return [f"""
do $$
begin
  if (select status || ':' || (price_anchor_amount is not null)::text from auction_lot_states
       where lot_id = {lit(hb.lot_id(DESC, 1))}) <> 'open:true' then
    raise exception 'lô đặt giá xuống chưa mở đúng';
  end if;
  if (select status || ':' || round_bid_count from auction_lot_states
       where lot_id = {lit(hb.lot_id(SEALED, 1))}) <> 'open:2' then
    raise exception 'lô bỏ phiếu kín chưa có 2 phiếu';
  end if;
  if exists (select 1 from auction_bids where session_id = any({lit(SESSION_IDS)}::uuid[])) then
    raise exception 'phiếu kín không được lộ sang auction_bids khi chưa đóng';
  end if;
end $$;"""]


def seed_sql(commit):
    s = list(od.SQL_HEADER)
    s.append(f"select case when not exists (select 1 from asset_owners where id = {lit(hb.SELLER)}) "
             f"then pg_temp.ok('{{\"ok\":false,\"reason\":\"chua_seed_bo_harley_buyer_demo\"}}') end;")
    s.append(f"select case when exists (select 1 from auction_sessions where id = {lit(hb.session_id(DESC))}) "
             f"then pg_temp.ok('{{\"ok\":false,\"reason\":\"da_seed_roi_chay_teardown_truoc\"}}') end;")
    s += states_sql() + checks_sql()
    s.append(f"select code, title, bidding_method from auction_sessions where id = any({lit(SESSION_IDS)}::uuid[]) order by code;")
    s.append("commit;" if commit else "rollback;")
    return "\n".join(s) + "\n"


def teardown_sql():
    off = [("auction_bids", "auction_bids_guard"),
           ("auction_sealed_bids", "auction_sealed_bids_append_only"),
           ("auction_lot_events", "auction_lot_events_append_only"),
           ("auction_deposit_events", "auction_deposit_events_append_only"),
           ("auction_contract_review_events", "auction_contract_review_events_append_only"),
           ("auction_session_items", "auction_session_items_guard_delete"),
           ("auction_session_items", "auction_session_items_bidding_lock")]
    w = f"session_id = any({lit(SESSION_IDS)}::uuid[])"
    s = ["\\set ON_ERROR_STOP 1", "begin;"]
    s += [f"alter table {t} disable trigger {g};" for t, g in off]
    s += [f"delete from auction_lot_states where {w};",
          f"delete from auction_sealed_bids where {w};",
          f"delete from auction_bids where {w};",
          f"delete from auction_lot_events where {w};",
          f"delete from auction_deposit_events where {w};",
          f"delete from auction_contract_review_events where contract_id in (select id from auction_bidding_contracts where {w});",
          f"delete from auction_contract_lots where contract_id in (select id from auction_bidding_contracts where {w});",
          f"delete from auction_bidding_contracts where {w};",
          f"delete from auction_session_items where {w};",
          f"delete from auction_sessions where id = any({lit(SESSION_IDS)}::uuid[]);",
          f"delete from listings where id = any({lit(LISTING_IDS)}::uuid[]);"]
    s += [f"alter table {t} enable trigger {g};" for t, g in off]
    s.append("commit;")
    return "\n".join(s) + "\n"


def main():
    args = set(sys.argv[1:])
    if "--teardown" in args:
        print("Gỡ 2 phiên demo phương thức…")
        psql(teardown_sql())
        print("Xong.")
        return
    commit = "--dry-run" not in args
    print(f"Seed 2 phiên demo đặt giá xuống + bỏ phiếu kín (bây giờ {NOW:%Y-%m-%d %H:%M})…"
          + ("" if commit else " (dry-run, ROLLBACK)"))
    print(psql(seed_sql(commit)))
    if commit:
        for k in (DESC, SEALED):
            print(f"  {METHOD[k]:<10} /sessions/{hb.session_id(k)}/dau-gia")
    print("Xong.")


if __name__ == "__main__":
    main()
