# -*- coding: utf-8 -*-
"""Sinh migration seed admin_units từ docs/admin-units/admin-units-2025.csv."""
import csv, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs/admin-units/admin-units-2025.csv')
OUT = os.path.join(ROOT, 'supabase/migrations/20261026100100_admin_units_seed.sql')

def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').replace('đ', 'd')
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    s = re.sub(r'^(thanh pho|tp|tinh|thi xa|thi tran|xa|phuong|dac khu)\s+', '', s)
    return s

# Nghị quyết 202/2025/QH15, Điều 1 khoản 1–23: đơn vị mới ← các tỉnh TRƯỚC sáp nhập
MERGERS = {
 "Tỉnh Tuyên Quang": ["Hà Giang", "Tuyên Quang"],
 "Tỉnh Lào Cai": ["Yên Bái", "Lào Cai"],
 "Tỉnh Thái Nguyên": ["Bắc Kạn", "Thái Nguyên"],
 "Tỉnh Phú Thọ": ["Vĩnh Phúc", "Hòa Bình", "Phú Thọ"],
 "Tỉnh Bắc Ninh": ["Bắc Giang", "Bắc Ninh"],
 "Tỉnh Hưng Yên": ["Thái Bình", "Hưng Yên"],
 "Thành phố Hải Phòng": ["Hải Phòng", "Hải Dương"],
 "Tỉnh Ninh Bình": ["Hà Nam", "Nam Định", "Ninh Bình"],
 "Tỉnh Quảng Trị": ["Quảng Bình", "Quảng Trị"],
 "Thành phố Đà Nẵng": ["Đà Nẵng", "Quảng Nam"],
 "Tỉnh Quảng Ngãi": ["Kon Tum", "Quảng Ngãi"],
 "Tỉnh Gia Lai": ["Bình Định", "Gia Lai"],
 "Tỉnh Khánh Hòa": ["Ninh Thuận", "Khánh Hòa"],
 "Tỉnh Lâm Đồng": ["Đắk Nông", "Bình Thuận", "Lâm Đồng"],
 "Tỉnh Đắk Lắk": ["Phú Yên", "Đắk Lắk"],
 "Thành phố Hồ Chí Minh": ["Hồ Chí Minh", "Bà Rịa - Vũng Tàu", "Bình Dương"],
 "Tỉnh Đồng Nai": ["Bình Phước", "Đồng Nai"],
 "Tỉnh Tây Ninh": ["Long An", "Tây Ninh"],
 "Thành phố Cần Thơ": ["Cần Thơ", "Sóc Trăng", "Hậu Giang"],
 "Tỉnh Vĩnh Long": ["Bến Tre", "Trà Vinh", "Vĩnh Long"],
 "Tỉnh Đồng Tháp": ["Tiền Giang", "Đồng Tháp"],
 "Tỉnh Cà Mau": ["Bạc Liêu", "Cà Mau"],
 "Tỉnh An Giang": ["Kiên Giang", "An Giang"],
}
# Điều 1 khoản 24: 11 đơn vị không thực hiện sắp xếp. Huế giữ nguyên theo NQ 202,
# nhưng tên trước 01/01/2025 là "Thừa Thiên Huế" (NQ 175/2024/QH15) ⇒ legacy.
UNCHANGED_LEGACY = {"Thành phố Huế": ["Thừa Thiên Huế"]}

rows = list(csv.DictReader(open(SRC, newline='', encoding='utf-8')))
provs = [r for r in rows if r['level'] == 'province']
comms = [r for r in rows if r['level'] == 'commune']
assert len(provs) == 34 and len(comms) == 3321, (len(provs), len(comms))
names = {r['name'] for r in provs}
assert set(MERGERS) <= names and set(UNCHANGED_LEGACY) <= names

def legacy_for(name):
    if name in MERGERS:
        own = norm(name)
        return [p for p in MERGERS[name] if norm(p) != own]
    return UNCHANGED_LEGACY.get(name, [])

def lit(s):
    return "'" + s.replace("'", "''") + "'"

def arr(xs):
    return "'{}'::TEXT[]" if not xs else "ARRAY[" + ", ".join(lit(x) for x in xs) + "]::TEXT[]"

def tuples(rs, with_legacy):
    out = []
    for r in rs:
        parent = lit(r['parent_code']) if r['parent_code'] else 'NULL'
        leg = arr(legacy_for(r['name'])) if with_legacy else "'{}'::TEXT[]"
        out.append(f"  ({lit(r['code'])}, {lit(r['name'])}, {lit(r['level'])}, {lit(r['unit_type'])}, {parent}, {leg})")
    return out

HEAD = """-- ─────────────────────────────────────────────────────────────────────────────
-- Seed `admin_units` — 34 tỉnh/thành + 3.321 đơn vị cấp xã (01/07/2025)
--
-- TỆP NÀY ĐƯỢC SINH TỰ ĐỘNG. Nguồn: docs/admin-units/admin-units-2025.csv
-- (tải 2026-10-26 từ https://provinces.open-api.vn/api/v2/?depth=2, phản ánh
-- Danh mục mã ĐVHC sau sáp nhập — Nghị quyết 202/2025/QH15, hiệu lực 01/07/2025).
-- Xem docs/admin-units/README.md. KHÔNG sửa mã/tên bằng tay ở đây: sửa ở nguồn.
--
-- `legacy_names` cấp TỈNH = ánh xạ 63 → 34 theo Điều 1 NQ 202/2025/QH15
-- (23 đơn vị hình thành từ 52 tỉnh cũ + 11 đơn vị giữ nguyên = 34; mỗi tỉnh cũ
-- xuất hiện đúng một lần). Tên trùng với tên mới được bỏ khỏi mảng vì
-- `normalized_name` đã khớp. Riêng "Thừa Thiên Huế" → Thành phố Huế là theo
-- NQ 175/2024/QH15 (hiệu lực 01/01/2025), không phải NQ 202.
-- `legacy_names` cấp XÃ để trống ở v1 (nguồn không có): `admin_unit_resolve`
-- vẫn so khớp theo `normalized_name` trong phạm vi tỉnh đã giải.
--
-- Chạy lại được: ON CONFLICT (code) DO UPDATE để đồng bộ lại tên/cha/legacy.
-- ─────────────────────────────────────────────────────────────────────────────

"""

INS = "INSERT INTO public.admin_units (code, name, level, unit_type, parent_code, legacy_names) VALUES\n"
TAIL = """ON CONFLICT (code) DO UPDATE SET
  name         = EXCLUDED.name,
  level        = EXCLUDED.level,
  unit_type    = EXCLUDED.unit_type,
  parent_code  = EXCLUDED.parent_code,
  legacy_names = EXCLUDED.legacy_names;

"""

parts = [HEAD, "-- ─── Cấp tỉnh (34) ───────────────────────────────────────────────────────────\n", INS,
         ",\n".join(tuples(provs, True)), "\n", TAIL,
         "-- ─── Cấp xã / phường / đặc khu (3.321) ───────────────────────────────────────\n"]

# chia lô 500 dòng cho dễ đọc / dễ chẩn đoán
for i in range(0, len(comms), 500):
    chunk = comms[i:i + 500]
    parts += [INS, ",\n".join(tuples(chunk, False)), "\n", TAIL]

parts.append("""-- ─── Tự kiểm: đếm đúng danh mục nguồn ────────────────────────────────────────
DO $$
DECLARE v_prov INT; v_comm INT; v_tinh INT; v_tp INT; v_xa INT; v_ph INT; v_dk INT; v_orphan INT;
BEGIN
  SELECT count(*) INTO v_prov FROM public.admin_units WHERE level = 'province';
  SELECT count(*) INTO v_comm FROM public.admin_units WHERE level = 'commune';
  SELECT count(*) INTO v_tinh FROM public.admin_units WHERE unit_type = 'tinh';
  SELECT count(*) INTO v_tp   FROM public.admin_units WHERE unit_type = 'thanh_pho';
  SELECT count(*) INTO v_xa   FROM public.admin_units WHERE unit_type = 'xa';
  SELECT count(*) INTO v_ph   FROM public.admin_units WHERE unit_type = 'phuong';
  SELECT count(*) INTO v_dk   FROM public.admin_units WHERE unit_type = 'dac_khu';
  SELECT count(*) INTO v_orphan FROM public.admin_units c
    WHERE c.level = 'commune' AND NOT EXISTS (
      SELECT 1 FROM public.admin_units p WHERE p.code = c.parent_code AND p.level = 'province');
  IF v_prov <> 34 OR v_comm <> 3321 OR v_tinh <> 28 OR v_tp <> 6
     OR v_xa <> 2621 OR v_ph <> 687 OR v_dk <> 13 OR v_orphan <> 0 THEN
    RAISE EXCEPTION 'admin_units seed lệch: tỉnh=% xã=% tinh=% tp=% xa=% phuong=% dac_khu=% mo_cong=%',
      v_prov, v_comm, v_tinh, v_tp, v_xa, v_ph, v_dk, v_orphan;
  END IF;
  -- 52 tỉnh cũ bị sáp nhập, trừ 23 tên trùng tên mới = 29 tên legacy, + Thừa Thiên Huế = 30
  SELECT count(*) INTO v_prov FROM (
    SELECT unnest(legacy_names) FROM public.admin_units WHERE level = 'province') s;
  IF v_prov <> 30 THEN
    RAISE EXCEPTION 'admin_units: legacy_names cấp tỉnh phải có 30 tên, đang có %', v_prov;
  END IF;
END $$;
""")

open(OUT, 'w', encoding='utf-8').write("".join(parts))
n_leg = sum(len(legacy_for(r['name'])) for r in provs)
print("wrote", OUT)
print("provinces", len(provs), "communes", len(comms), "legacy names total", n_leg)
