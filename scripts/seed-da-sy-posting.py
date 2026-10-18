"""Hồ sơ số hoá cho Trạm "Làng rèn Đa Sỹ" của secsosoo — đi đúng mẫu scripts/seed-craft-villages.py.

Ảnh Commons (tất cả là MINH HOẠ cùng dòng nghề, không chụp tại Đa Sỹ) chép về asset-media,
hồ sơ đã duyệt. Hồ sơ có `publish` được chủ bật "Hiện trong trang làng"; làng (một ghim trên bản đồ)
được lập + công khai qua owner_set_craft_village_profile, hồ sơ đầu danh sách làm ảnh bìa.
Bước đồng bộ làng + cờ hiện chạy lại MỌI lần (kể cả khi đủ hồ sơ).

    python3 -I scripts/seed-da-sy-posting.py [--dry-run | --teardown]   # chỉ seed hồ sơ chưa có
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

REPO = Path("/Users/m116gb/Downloads/Agency/taisandaugia")
REF = "vewtnkewyawmkpeymdot"
URL = f"https://{REF}.supabase.co"
POOLER = "aws-0-ap-southeast-1.pooler.supabase.com"
UA = "taisandaugia-seed/1.0 (harleyngx@gmail.com)"

env = {}
for l in (REPO / ".env.local").read_text().splitlines():
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, v = l.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
DB = urllib.parse.urlparse(env["SUPABASE_DB_URI"])

ADMIN = "95d7e29c-f1f5-4361-a3af-e9aeaf792f3f"
OWNER = "ae9bfef5-2694-466f-a97e-5efdf138ac43"      # secsosoo
WS = "74d4c196-220d-4950-acde-ab37cf3c4de7"        # Trạm Làng rèn Đa Sỹ
LAT, LNG = 20.9575, 105.7855                        # làng Đa Sỹ, Kiến Hưng, Hà Đông
VILLAGE_PRODUCT = "Dao kéo & nông cụ rèn tay"
VILLAGE_INTRO = ("Làng rèn Đa Sỹ (phường Kiến Hưng, Hà Đông, Hà Nội) có nghề rèn từ hơn 400 năm, "
                 "nổi tiếng với dao, kéo, liềm, hái và dụng cụ làm bếp rèn tay. Các lò gia đình vẫn giữ "
                 "kỹ thuật nung than, quai búa và tôi thép truyền thống.")

ASSETS = [
    dict(
        id="5ec5a000-0000-4000-8000-000000000005", slug="da-sy", publish=True,
        product="Dao kéo & nông cụ rèn tay", material="Thép rèn tay",
        title="Dao kéo, nông cụ rèn tay làng Đa Sỹ",
        desc="Làng rèn Đa Sỹ (Kiến Hưng, Hà Đông) giữ nghề rèn hàng trăm năm, nổi tiếng với dao, kéo, "
             "liềm, cuốc và dụng cụ làm bếp rèn tay: thép được nung đỏ trong lò than, quai búa, tôi nước "
             "rồi mài sắc thủ công. Hồ sơ giới thiệu các dòng sản phẩm chủ lực của các lò gia đình trong làng.",
        photos=[  # (tệp Commons, chú thích) — ảnh đầu = thẻ bìa
            ("Lò Rèn.jpg", "Mô hình lò rèn thủ công"),
            ("Bảo tàng TP-Phòng kỷ vật thời CM (lò rèn vũ khí trong thời Nam Kỳ khởi nghĩa) (1).jpg",
             "Bễ thổi và lò rèn truyền thống"),
            ("Knife, Muong - Vietnam Museum of Ethnology - Hanoi, Vietnam - DSC02622.JPG", "Dao rèn tay người Mường"),
            ("Blacksmith at work Lo Ren street (3694367427).jpg", "Thợ gia công kim loại ở phố Lò Rèn, Hà Nội"),
        ]),
    dict(
        id="5ec5a000-0000-4000-8000-000000000006", slug="da-sy-nong-cu", publish=True,
        product="Liềm, hái, phảng nông nghiệp", material="Thép cacbon rèn tay, cán tre",
        title="Bộ nông cụ rèn tay Đa Sỹ: liềm, hái, phảng",
        desc="Dòng nông cụ truyền thống của các lò rèn Đa Sỹ: liềm gặt lúa, hái cắt cỏ, phảng phát bờ và "
             "dao rựa làm vườn. Lưỡi thép cacbon rèn nguội nhiều lượt cho độ cứng, cán tre hoặc gỗ "
             "nhãn tra khâu sắt. Nhận đặt hàng số lượng lớn cho hợp tác xã nông nghiệp.",
        photos=[
            ("Bảo tàng Lịch sử TP (hiện vật cổ, nông cụ người Việt).jpg",
             "Nông cụ của người Việt: phảng, cù nèo, nọc cấy, vòng hái"),
            ("Bảo tàng Lịch sử TP (hiện vật cổ, nông cụ của người Miên).jpg", "Liềm và nông cụ cổ"),
            ("Bảo tàng Lịch sử TP (Cổ vật thời Đông Sơn, dao).jpg", "Dao sắt thời Đông Sơn — gốc nghề rèn Việt"),
        ]),
]


def api(method, path, body=None, *, raw=None, ctype="application/json", extra=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(URL + path, data=data, method=method)
    for h, v in (("Authorization", f"Bearer {KEY}"), ("apikey", KEY), *(extra or {}).items()):
        req.add_header(h, v)
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            t = r.read().decode()
            return json.loads(t) if t else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:400]}") from None


def psql(sql):
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
        f.write(sql)
    conn = f"host={POOLER} port=5432 user=postgres.{REF} dbname=postgres sslmode=require"
    r = subprocess.run(["psql", conn, "-X", "-v", "ON_ERROR_STOP=1", "-f", f.name],
                       env={**os.environ, "PGPASSWORD": urllib.parse.unquote(DB.password)},
                       capture_output=True, text=True)
    os.unlink(f.name)
    if r.returncode:
        sys.exit(f"psql lỗi:\n{r.stdout[-3000:]}\n{r.stderr}")
    return r.stdout + r.stderr


def lit(v):
    if isinstance(v, (dict, list)):
        return lit(json.dumps(v, ensure_ascii=False)) + "::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def as_user(uid):
    return f"select set_config('request.jwt.claims', {lit(json.dumps({'sub': uid, 'role': 'authenticated'}))}, true);"


def path(a, k):
    return f"{OWNER}/lang-nghe/{a['slug']}-{k}.jpg"


def commons_meta(photos):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1280,
                                "titles": "|".join("File:" + f for f, _ in photos)})
    d = json.load(urllib.request.urlopen(urllib.request.Request(
        f"https://commons.wikimedia.org/w/api.php?{q}", headers={"User-Agent": UA}), timeout=30))
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    out = {}
    for p in d["query"]["pages"].values():
        ii = p["imageinfo"][0]
        m = ii.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip() or "không rõ tác giả"
        out[norm.get(p["title"], p["title"])[5:]] = {
            "url": ii["thumburl"], "artist": artist[:80],
            "license": m.get("LicenseShortName", {}).get("value", "") or "xem trang tệp"}
    return [out[f] for f, _ in photos]


def fetch(url):
    for wait in (1, 5, 15, 30, 60):
        time.sleep(wait)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    sys.exit(f"Wikimedia vẫn trả 429: {url}")


def asset_sql(a, imgs, meta):
    credits = "\n".join(
        ["Nguồn ảnh (Wikimedia Commons):",
         "Toàn bộ ảnh là minh hoạ nghề rèn, không chụp tại làng Đa Sỹ."] +
        [f"• {cap} — {m['artist']}, {m['license']} · minh hoạ" for (_, cap), m in zip(a["photos"], meta)])
    decl = {"name": "Làng rèn Đa Sỹ", "accepted_at": "2026-10-18T09:00:00+07:00", "version": "2026-09-06"}
    sql = f"""
select set_config('request.jwt.claims', '', true);
insert into asset_postings (id, user_id, workspace_id, parent_slug, child_slug, title, description, province,
  district, ward, address, pricing_mode, auction_format, expected_timeline, has_dispute, has_mortgage, is_seized,
  right_to_sell, delta_fields, image_urls, status, submitted_at, review_status, reviewed_at, reviewed_by,
  ownership_declaration)
values ({lit(a['id'])}, {lit(OWNER)}, {lit(WS)}, 'thu-cong-my-nghe', 'do-dong', {lit(a['title'])},
  {lit(a['desc'] + chr(10) + chr(10) + credits)}, 'Hà Nội', 'Hà Đông', 'Kiến Hưng', 'Làng Đa Sỹ, phường Kiến Hưng',
  'self', 'truc_tiep', 'flexible', false, false, false, true,
  {lit({'material': a['material'], 'origin': 'Làng rèn Đa Sỹ'})}, array[{', '.join(lit(x) for x in imgs)}]::text[],
  'active', now() - interval '1 day', 'approved', now(), {lit(ADMIN)}, {lit(decl)});"""
    return sql


def sync_sql():
    """Cờ hiện từng hồ sơ + Hồ sơ làng (chạy lại an toàn)."""
    shown = [a for a in ASSETS if a["publish"]]
    lines = [as_user(OWNER)]
    lines += [f"select pg_temp.ok(owner_set_craft_asset_visibility({lit(a['id'])}, true));" for a in shown]
    lines.append(f"select pg_temp.ok(owner_set_craft_village_profile({lit(WS)}, true, {LAT}, {LNG}, 'Hà Nội', "
                 f"{lit(VILLAGE_PRODUCT)}, {lit(VILLAGE_INTRO)}, {lit(shown[0]['id'])}));")
    return "\n".join(lines)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    ids = ", ".join(lit(a["id"]) for a in ASSETS)
    if arg == "--teardown":
        print(psql(f"begin; delete from asset_postings where id in ({ids}); commit;"))
        api("DELETE", "/storage/v1/object/asset-media",
            {"prefixes": [path(a, k) for a in ASSETS for k in range(1, len(a["photos"]) + 1)]})
        print("Đã gỡ hồ sơ + ảnh.")
        return
    if arg not in ("", "--dry-run"):
        sys.exit(__doc__)
    dry = arg == "--dry-run"
    have = psql(f"select string_agg(id::text, ',') from asset_postings where id in ({ids});")
    todo = [a for a in ASSETS if a["id"] not in have]
    print(f"  cần seed: {len(todo)}/{len(ASSETS)} hồ sơ")
    ver = int(time.time())
    parts = []
    for a in todo:
        meta = commons_meta(a["photos"])
        if not dry:
            for k, m in enumerate(meta, start=1):
                data = fetch(m["url"])
                ctype = "image/png" if data[:8] == b"\x89PNG\r\n\x1a\n" else "image/jpeg"
                api("POST", f"/storage/v1/object/asset-media/{path(a, k)}", raw=data, ctype=ctype,
                    extra={"x-upsert": "true"})
            print(f"  {a['slug']}: {len(meta)} ảnh đã tải lên asset-media")
        imgs = [f"{URL}/storage/v1/object/public/asset-media/{path(a, k)}?v={ver}" for k in range(1, len(meta) + 1)]
        parts.append(asset_sql(a, imgs, meta))
    sql = f"""
begin;
create function pg_temp.ok(j jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce((j->>'ok')::boolean, false) is not true then raise exception 'RPC lỗi: %', j; end if;
  return j;
end $$;
{chr(10).join(parts)}
{sync_sql()}
select set_config('request.jwt.claims', '', true);
\\echo '── Hồ sơ của Trạm Làng rèn Đa Sỹ ──'
select p.code, p.title, p.review_status, coalesce(c.is_published, false) as hien_trong_lang
  from asset_postings p left join craft_village_publications c on c.asset_posting_id = p.id
 where p.id in ({ids}) order by p.code;
set local role anon;
\\echo '── Trên bản đồ công khai (quyền anon) ──'
select village_name, product, jsonb_array_length(assets) as so_ho_so, cover_image is not null as co_bia
  from public_craft_villages() where workspace_id = {lit(WS)};
reset role;
{"rollback;" if dry else "commit;"}
"""
    print(psql(sql))
    print("Dry-run: ROLLBACK." if dry else "Xong.")


if __name__ == "__main__":
    main()
