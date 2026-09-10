#!/usr/bin/env python3
"""Copy every Storage object from the old Supabase project to the new one.

pg_dump moves the `storage.objects` ROWS but not the files behind them, so this
script streams each file across with the two service_role keys.

RLS note: 23 of the 35 policies on storage.objects test `owner`, and an upload
made with a service_role key lands with owner = NULL. So this script only moves
BYTES — ownership/timestamps are restored afterwards by
`dump/08_storage_objects_fixup.sql`. Run that immediately after this.

Env (put them in .env.local, never commit):
    SRC_SUPABASE_URL, SRC_SERVICE_ROLE_KEY
    DST_SUPABASE_URL, DST_SERVICE_ROLE_KEY
Usage:
    python3 scripts/migrate-storage.py <manifest.tsv>      # bucket_id \t name \t size \t mimetype
    python3 scripts/migrate-storage.py <manifest.tsv> --verify
"""
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TIMEOUT = 120


def _env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"missing env var: {name}")
    return v.rstrip("/") if name.endswith("URL") else v


def _req(method, url, key, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("apikey", key)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    return urllib.request.urlopen(req, timeout=TIMEOUT)


def download(src_url, src_key, bucket, name):
    path = urllib.parse.quote(name)
    with _req("GET", f"{src_url}/storage/v1/object/{bucket}/{path}", src_key) as r:
        return r.read()


def upload(dst_url, dst_key, bucket, name, blob, mimetype):
    path = urllib.parse.quote(name)
    _req(
        "POST",
        f"{dst_url}/storage/v1/object/{bucket}/{path}",
        dst_key,
        data=blob,
        headers={"Content-Type": mimetype or "application/octet-stream", "x-upsert": "true"},
    ).close()


def head_size(url, key, bucket, name):
    """Return the byte size of an object, or None when it is absent."""
    path = urllib.parse.quote(name)
    try:
        with _req("GET", f"{url}/storage/v1/object/{bucket}/{path}", key) as r:
            return len(r.read())
    except urllib.error.HTTPError as e:
        if e.code in (400, 404):
            return None
        raise


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    manifest, verify = sys.argv[1], "--verify" in sys.argv
    src_url, src_key = _env("SRC_SUPABASE_URL"), _env("SRC_SERVICE_ROLE_KEY")
    dst_url, dst_key = _env("DST_SUPABASE_URL"), _env("DST_SERVICE_ROLE_KEY")

    rows = []
    with open(manifest, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            parts = line.split("\t")
            bucket, name = parts[0], parts[1]
            size = int(parts[2]) if len(parts) > 2 and parts[2] else 0
            mime = parts[3] if len(parts) > 3 else "application/octet-stream"
            rows.append((bucket, name, size, mime))

    ok = failed = skipped = 0
    problems = []
    for i, (bucket, name, size, mime) in enumerate(rows, 1):
        label = f"[{i}/{len(rows)}] {bucket}/{name}"
        try:
            if verify:
                got = head_size(dst_url, dst_key, bucket, name)
                if got is None:
                    problems.append(f"MISSING  {bucket}/{name}")
                    failed += 1
                elif size and got != size:
                    problems.append(f"SIZE {size}->{got}  {bucket}/{name}")
                    failed += 1
                else:
                    ok += 1
                continue

            if head_size(dst_url, dst_key, bucket, name) == size and size:
                skipped += 1
                print(f"{label} — already present, skip")
                continue

            blob = download(src_url, src_key, bucket, name)
            upload(dst_url, dst_key, bucket, name, blob, mime)
            ok += 1
            print(f"{label} — {len(blob)} B")
        except urllib.error.HTTPError as e:
            failed += 1
            body = e.read()[:200].decode("utf-8", "replace")
            problems.append(f"HTTP {e.code} {bucket}/{name}: {body}")
            print(f"{label} — FAILED HTTP {e.code}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            problems.append(f"{type(e).__name__} {bucket}/{name}: {e}")
            print(f"{label} — FAILED {e}")

    print(f"\n{'verified' if verify else 'copied'}: {ok}  skipped: {skipped}  failed: {failed}")
    if problems:
        print("\nproblems:")
        for p in problems:
            print("  " + p)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
