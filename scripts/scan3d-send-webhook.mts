// Gửi một webhook quét 3D ĐÃ KÝ tới edge function scan3d-webhook — để thử hợp đồng
// sau khi deploy, hoặc đưa đối tác làm mẫu tích hợp.
//
//   SCAN3D_WEBHOOK_SECRET=... node --experimental-strip-types scripts/scan3d-send-webhook.mts \
//     --event model.ready --scan <asset_3d_scans.id> --lot <asset_postings.id> --job job-123 \
//     [--model https://…/model.glb] [--format glb] [--poster https://…] [--reason "…"] [--stale] [--bad-sig]
//
// --stale: timestamp lùi 10 phút (mong đợi 401) · --bad-sig: sai chữ ký (mong đợi 401).

import { sign } from "../supabase/functions/_shared/scan3dSignature.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const secret = process.env.SCAN3D_WEBHOOK_SECRET;
const url = process.env.SCAN3D_WEBHOOK_URL ?? "https://vewtnkewyawmkpeymdot.supabase.co/functions/v1/scan3d-webhook";
if (!secret) throw new Error("Thiếu SCAN3D_WEBHOOK_SECRET");

const body = JSON.stringify({
  event: arg("event") ?? "model.ready",
  job_id: arg("job") ?? `job-${Date.now()}`,
  scan_ref: arg("scan"),
  lot_id: arg("lot"),
  model_url: arg("model") ?? "https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-3d/samples/sheen-chair.glb",
  poster_url: arg("poster"),
  format: arg("format") ?? "glb",
  reason: arg("reason"),
});

const ts = String(Math.floor(Date.now() / 1000) - (flag("stale") ? 600 : 0));
const signature = flag("bad-sig") ? "sha256=" + "0".repeat(64) : await sign(secret, ts, body);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Scan3D-Timestamp": ts, "X-Scan3D-Signature": signature },
  body,
});
console.log(res.status, await res.text());
