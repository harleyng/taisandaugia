// Đối chiếu BẢN SAO SQL ↔ TS của "kế hoạch so thực tế theo kỳ" (A5).
//
// ⚠️ CẶP NHÂN BẢN THỨ SÁU: `planVsActual()` (src/lib/auctionPlan/period.ts) ↔
// `public.auction_plan_period_metrics(plan, period_type, period_start)`
// (migration `20261026150000`).
//
// Mẫu: Trạm demo "UBND tỉnh Bắc Ninh" (`is_demo`), 4 kế hoạch năm 2026 đã duyệt
// (bản mốc v1), 20 tài sản — 6 tài sản gắn hồ sơ số hoá có kết quả thật (4 đấu
// thành đã thu đủ, 2 không thành), 13 chưa liên kết, 1 đã bỏ khỏi kế hoạch.
// Mỗi kế hoạch được đối chiếu trên 17 kỳ: 12 tháng + 4 quý + cả năm ⇒ 68 cặp,
// mỗi cặp 11 chỉ số.
//
// `sql` của mỗi kỳ là kết quả THẬT của `auction_plan_period_metrics` chạy trên
// DB sống, chụp ngày 2026-10-26. `rows` là ĐÚNG đầu vào mà client dựng
// (`planPeriodRows`): tháng + giá trị khởi điểm của BẢN MỐC, kết quả thật của
// `auction_plan_item_outcomes`.
//
// Sửa luật ở một bên mà quên bên kia thì test này đỏ. Sau khi sửa CẢ HAI bên,
// chụp lại mẫu bằng truy vấn trong phần mô tả của báo cáo Phase 6.

import { describe, expect, it } from "vitest";
import { planVsActual, type PlanPeriod, type PlanPeriodRow } from "./period";

interface SqlMetrics {
  type: "month" | "quarter" | "year";
  start: string;
  end: string;
  plannedCount: number;
  plannedStartValue: number;
  offeredCount: number;
  soldCount: number;
  actualStartValue: number;
  winningTotal: number;
  collected: number;
  recorded: number;
  estimated: number;
  awaiting: number;
  donePct: number | null;
}

interface ParityPlan {
  planId: string;
  title: string;
  planYear: number;
  rows: PlanPeriodRow[];
  sql: SqlMetrics[];
}

/** Chụp từ DB sống — xem đầu file. */
const SAMPLE: ParityPlan[] = [
  {
    "planId": "32a761fe-2472-42ee-ae91-1e844e6bd19d",
    "title": "Kế hoạch đấu giá QSDĐ năm 2026 · Phường Bắc Giang",
    "planYear": 2026,
    "rows": [
      {
        "itemId": "3aeaf92d-c948-48b6-af41-4570b9778127",
        "itemCode": "KH26-001",
        "title": "Khu dân cư Bắc Giang — lô A",
        "planned": true,
        "baselineMonth": "2026-06-01",
        "baselineExpected": 46080000000,
        "outcome": {
          "outcome": "sold",
          "paid_amount": 54374400000,
          "auction_date": "2026-06-15",
          "winning_price": 54374400000,
          "payment_status": "paid",
          "starting_price": 46080000000
        }
      },
      {
        "itemId": "52e57eff-09eb-42a0-a486-b3a76f0055d6",
        "itemCode": "KH26-002",
        "title": "Khu dân cư Bắc Giang — lô B",
        "planned": true,
        "baselineMonth": "2026-08-01",
        "baselineExpected": 15600000000,
        "outcome": null
      },
      {
        "itemId": "eea67aff-83b8-4b13-87ce-ff154732821b",
        "itemCode": "KH26-003",
        "title": "Đất ở Thọ Xương",
        "planned": true,
        "baselineMonth": "2026-11-01",
        "baselineExpected": 11180000000,
        "outcome": null
      },
      {
        "itemId": "06a92ffe-7c2e-417d-8d5e-443b9de53f67",
        "itemCode": "KH26-004",
        "title": "Khu tái định cư Dĩnh Kế — phần còn lại",
        "planned": true,
        "baselineMonth": "2026-12-01",
        "baselineExpected": 13800000000,
        "outcome": null
      },
      {
        "itemId": "47f11986-a1a4-4132-a151-451ac3ab3b25",
        "itemCode": "KH26-005",
        "title": "Đất ở Đa Mai (chuyển sang năm sau)",
        "planned": false,
        "baselineMonth": "2026-09-01",
        "baselineExpected": 3600000000,
        "outcome": null
      }
    ],
    "sql": [
      {
        "end": "2026-01-31",
        "type": "month",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-02-28",
        "type": "month",
        "start": "2026-02-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-03-31",
        "type": "month",
        "start": "2026-03-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-04-30",
        "type": "month",
        "start": "2026-04-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-05-31",
        "type": "month",
        "start": "2026-05-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-06-30",
        "type": "month",
        "start": "2026-06-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 54374400000,
        "collected": 54374400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 54374400000,
        "actualStartValue": 46080000000,
        "plannedStartValue": 46080000000
      },
      {
        "end": "2026-07-31",
        "type": "month",
        "start": "2026-07-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-08-31",
        "type": "month",
        "start": "2026-08-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 15600000000
      },
      {
        "end": "2026-09-30",
        "type": "month",
        "start": "2026-09-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-10-31",
        "type": "month",
        "start": "2026-10-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-11-30",
        "type": "month",
        "start": "2026-11-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 11180000000
      },
      {
        "end": "2026-12-31",
        "type": "month",
        "start": "2026-12-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 13800000000
      },
      {
        "end": "2026-03-31",
        "type": "quarter",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-06-30",
        "type": "quarter",
        "start": "2026-04-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 54374400000,
        "collected": 54374400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 54374400000,
        "actualStartValue": 46080000000,
        "plannedStartValue": 46080000000
      },
      {
        "end": "2026-09-30",
        "type": "quarter",
        "start": "2026-07-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 15600000000
      },
      {
        "end": "2026-12-31",
        "type": "quarter",
        "start": "2026-10-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 2,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 24980000000
      },
      {
        "end": "2026-12-31",
        "type": "year",
        "start": "2026-01-01",
        "donePct": 25,
        "awaiting": 0,
        "recorded": 54374400000,
        "collected": 54374400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 4,
        "winningTotal": 54374400000,
        "actualStartValue": 46080000000,
        "plannedStartValue": 86660000000
      }
    ]
  },
  {
    "planId": "731a8f60-29e9-4955-b349-3e51b931cac5",
    "title": "Kế hoạch đấu giá QSDĐ năm 2026 · Phường Việt Yên",
    "planYear": 2026,
    "rows": [
      {
        "itemId": "3b40ae2c-5366-489f-ad76-076e577cadac",
        "itemCode": "KH26-001",
        "title": "Khu dân cư Việt Yên — lô C",
        "planned": true,
        "baselineMonth": "2026-05-01",
        "baselineExpected": 29160000000,
        "outcome": null
      },
      {
        "itemId": "5c232f4f-fb05-476d-ae26-745de7d509c9",
        "itemCode": "KH26-002",
        "title": "Khu dân cư Việt Yên — lô D",
        "planned": true,
        "baselineMonth": "2026-06-01",
        "baselineExpected": 18480000000,
        "outcome": {
          "outcome": "unsold",
          "paid_amount": null,
          "auction_date": "2026-06-13",
          "winning_price": null,
          "payment_status": null,
          "starting_price": 18480000000
        }
      },
      {
        "itemId": "9be640ef-6de7-466f-ba31-1fa229aa8dd1",
        "itemCode": "KH26-003",
        "title": "Đất ở Bích Động",
        "planned": true,
        "baselineMonth": "2026-07-01",
        "baselineExpected": 23460000000,
        "outcome": {
          "outcome": "sold",
          "paid_amount": 27682800000,
          "auction_date": "2026-07-15",
          "winning_price": 27682800000,
          "payment_status": "paid",
          "starting_price": 23460000000
        }
      },
      {
        "itemId": "e9f4ffc6-67f4-4d8e-a037-de3f8fad662f",
        "itemCode": "KH26-004",
        "title": "Khu đấu giá Nếnh — đợt 1",
        "planned": true,
        "baselineMonth": "2026-11-01",
        "baselineExpected": 33000000000,
        "outcome": null
      },
      {
        "itemId": "64bcddf8-fead-4ded-ac10-5b696d1d0c33",
        "itemCode": "KH26-005",
        "title": "Khu đấu giá Nếnh — đợt 2",
        "planned": true,
        "baselineMonth": "2026-12-01",
        "baselineExpected": 28750000000,
        "outcome": null
      },
      {
        "itemId": "3fbacd15-db82-49df-9629-c2b9a556d459",
        "itemCode": "KH26-006",
        "title": "Nhà làm việc cũ UBND phường (tài sản công)",
        "planned": true,
        "baselineMonth": "2026-12-01",
        "baselineExpected": 5760000000,
        "outcome": null
      }
    ],
    "sql": [
      {
        "end": "2026-01-31",
        "type": "month",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-02-28",
        "type": "month",
        "start": "2026-02-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-03-31",
        "type": "month",
        "start": "2026-03-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-04-30",
        "type": "month",
        "start": "2026-04-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-05-31",
        "type": "month",
        "start": "2026-05-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 29160000000
      },
      {
        "end": "2026-06-30",
        "type": "month",
        "start": "2026-06-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 18480000000,
        "plannedStartValue": 18480000000
      },
      {
        "end": "2026-07-31",
        "type": "month",
        "start": "2026-07-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 27682800000,
        "collected": 27682800000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 27682800000,
        "actualStartValue": 23460000000,
        "plannedStartValue": 23460000000
      },
      {
        "end": "2026-08-31",
        "type": "month",
        "start": "2026-08-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-09-30",
        "type": "month",
        "start": "2026-09-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-10-31",
        "type": "month",
        "start": "2026-10-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-11-30",
        "type": "month",
        "start": "2026-11-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 33000000000
      },
      {
        "end": "2026-12-31",
        "type": "month",
        "start": "2026-12-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 2,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 34510000000
      },
      {
        "end": "2026-03-31",
        "type": "quarter",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-06-30",
        "type": "quarter",
        "start": "2026-04-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 1,
        "plannedCount": 2,
        "winningTotal": 0,
        "actualStartValue": 18480000000,
        "plannedStartValue": 47640000000
      },
      {
        "end": "2026-09-30",
        "type": "quarter",
        "start": "2026-07-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 27682800000,
        "collected": 27682800000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 27682800000,
        "actualStartValue": 23460000000,
        "plannedStartValue": 23460000000
      },
      {
        "end": "2026-12-31",
        "type": "quarter",
        "start": "2026-10-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 3,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 67510000000
      },
      {
        "end": "2026-12-31",
        "type": "year",
        "start": "2026-01-01",
        "donePct": 16,
        "awaiting": 0,
        "recorded": 27682800000,
        "collected": 27682800000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 2,
        "plannedCount": 6,
        "winningTotal": 27682800000,
        "actualStartValue": 41940000000,
        "plannedStartValue": 138610000000
      }
    ]
  },
  {
    "planId": "c0bfd4d4-d3cd-4f63-a971-a68f4cfd9237",
    "title": "Kế hoạch đấu giá QSDĐ năm 2026 · Phường Vũ Ninh",
    "planYear": 2026,
    "rows": [
      {
        "itemId": "5cb85166-70d7-4bf1-a016-4997420af268",
        "itemCode": "KH26-001",
        "title": "Khu dân cư mới Vũ Ninh — lô LK1",
        "planned": true,
        "baselineMonth": "2026-06-01",
        "baselineExpected": 26880000000,
        "outcome": {
          "outcome": "sold",
          "paid_amount": 31718400000,
          "auction_date": "2026-06-15",
          "winning_price": 31718400000,
          "payment_status": "paid",
          "starting_price": 26880000000
        }
      },
      {
        "itemId": "f2ea5f78-07ed-4bcf-9e72-7fba084ca0ed",
        "itemCode": "KH26-002",
        "title": "Khu dân cư mới Vũ Ninh — lô LK2",
        "planned": true,
        "baselineMonth": "2026-05-01",
        "baselineExpected": 17280000000,
        "outcome": null
      },
      {
        "itemId": "3c3567fd-d9b7-4671-8e54-d56881048a00",
        "itemCode": "KH26-003",
        "title": "Đất ở xen kẹp tổ 4 Vũ Ninh",
        "planned": true,
        "baselineMonth": "2026-07-01",
        "baselineExpected": 7255500000,
        "outcome": {
          "outcome": "unsold",
          "paid_amount": null,
          "auction_date": "2026-07-13",
          "winning_price": null,
          "payment_status": null,
          "starting_price": 7255500000
        }
      },
      {
        "itemId": "07f7fec3-527c-45c7-84cf-6abae9380b46",
        "itemCode": "KH26-004",
        "title": "Khu đấu giá Đồng Mạ — đợt 1",
        "planned": true,
        "baselineMonth": "2026-11-01",
        "baselineExpected": 23750000000,
        "outcome": null
      },
      {
        "itemId": "078449ea-777b-486a-bb3a-87892058d667",
        "itemCode": "KH26-005",
        "title": "Khu đấu giá Đồng Mạ — đợt 2",
        "planned": true,
        "baselineMonth": "2026-12-01",
        "baselineExpected": 19190000000,
        "outcome": null
      }
    ],
    "sql": [
      {
        "end": "2026-01-31",
        "type": "month",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-02-28",
        "type": "month",
        "start": "2026-02-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-03-31",
        "type": "month",
        "start": "2026-03-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-04-30",
        "type": "month",
        "start": "2026-04-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-05-31",
        "type": "month",
        "start": "2026-05-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 17280000000
      },
      {
        "end": "2026-06-30",
        "type": "month",
        "start": "2026-06-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 31718400000,
        "collected": 31718400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 31718400000,
        "actualStartValue": 26880000000,
        "plannedStartValue": 26880000000
      },
      {
        "end": "2026-07-31",
        "type": "month",
        "start": "2026-07-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 7255500000,
        "plannedStartValue": 7255500000
      },
      {
        "end": "2026-08-31",
        "type": "month",
        "start": "2026-08-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-09-30",
        "type": "month",
        "start": "2026-09-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-10-31",
        "type": "month",
        "start": "2026-10-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-11-30",
        "type": "month",
        "start": "2026-11-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 23750000000
      },
      {
        "end": "2026-12-31",
        "type": "month",
        "start": "2026-12-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 19190000000
      },
      {
        "end": "2026-03-31",
        "type": "quarter",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-06-30",
        "type": "quarter",
        "start": "2026-04-01",
        "donePct": 50,
        "awaiting": 0,
        "recorded": 31718400000,
        "collected": 31718400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 2,
        "winningTotal": 31718400000,
        "actualStartValue": 26880000000,
        "plannedStartValue": 44160000000
      },
      {
        "end": "2026-09-30",
        "type": "quarter",
        "start": "2026-07-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 7255500000,
        "plannedStartValue": 7255500000
      },
      {
        "end": "2026-12-31",
        "type": "quarter",
        "start": "2026-10-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 2,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 42940000000
      },
      {
        "end": "2026-12-31",
        "type": "year",
        "start": "2026-01-01",
        "donePct": 20,
        "awaiting": 0,
        "recorded": 31718400000,
        "collected": 31718400000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 2,
        "plannedCount": 5,
        "winningTotal": 31718400000,
        "actualStartValue": 34135500000,
        "plannedStartValue": 94355500000
      }
    ]
  },
  {
    "planId": "e0425fc6-81f4-4f58-829d-73f2feb3714c",
    "title": "Kế hoạch đấu giá QSDĐ năm 2026 · Xã Tân Yên",
    "planYear": 2026,
    "rows": [
      {
        "itemId": "92ae47fa-7dc5-4c28-a721-54eb3e888c3a",
        "itemCode": "KH26-001",
        "title": "Khu dân cư Tân Yên — lô E",
        "planned": true,
        "baselineMonth": "2026-05-01",
        "baselineExpected": 11200000000,
        "outcome": null
      },
      {
        "itemId": "283a2bc5-36ef-47f4-8079-6eec8f9d36b1",
        "itemCode": "KH26-002",
        "title": "Đất ở Ngọc Thiện",
        "planned": true,
        "baselineMonth": "2026-07-01",
        "baselineExpected": 8400000000,
        "outcome": {
          "outcome": "sold",
          "paid_amount": 9912000000,
          "auction_date": "2026-07-15",
          "winning_price": 9912000000,
          "payment_status": "paid",
          "starting_price": 8400000000
        }
      },
      {
        "itemId": "df6cade3-892c-41ba-aa6e-b88fa594a600",
        "itemCode": "KH26-003",
        "title": "Khu đấu giá Cao Thượng",
        "planned": true,
        "baselineMonth": "2026-11-01",
        "baselineExpected": 15640000000,
        "outcome": null
      },
      {
        "itemId": "dd403e41-05e0-4455-9690-c46a74ec7efe",
        "itemCode": "KH26-004",
        "title": "Đất ở Quang Tiến",
        "planned": true,
        "baselineMonth": "2026-12-01",
        "baselineExpected": 4620000000,
        "outcome": null
      }
    ],
    "sql": [
      {
        "end": "2026-01-31",
        "type": "month",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-02-28",
        "type": "month",
        "start": "2026-02-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-03-31",
        "type": "month",
        "start": "2026-03-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-04-30",
        "type": "month",
        "start": "2026-04-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-05-31",
        "type": "month",
        "start": "2026-05-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 11200000000
      },
      {
        "end": "2026-06-30",
        "type": "month",
        "start": "2026-06-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-07-31",
        "type": "month",
        "start": "2026-07-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 9912000000,
        "collected": 9912000000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 9912000000,
        "actualStartValue": 8400000000,
        "plannedStartValue": 8400000000
      },
      {
        "end": "2026-08-31",
        "type": "month",
        "start": "2026-08-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-09-30",
        "type": "month",
        "start": "2026-09-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-10-31",
        "type": "month",
        "start": "2026-10-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-11-30",
        "type": "month",
        "start": "2026-11-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 15640000000
      },
      {
        "end": "2026-12-31",
        "type": "month",
        "start": "2026-12-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 4620000000
      },
      {
        "end": "2026-03-31",
        "type": "quarter",
        "start": "2026-01-01",
        "donePct": null,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 0,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 0
      },
      {
        "end": "2026-06-30",
        "type": "quarter",
        "start": "2026-04-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 1,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 11200000000
      },
      {
        "end": "2026-09-30",
        "type": "quarter",
        "start": "2026-07-01",
        "donePct": 100,
        "awaiting": 0,
        "recorded": 9912000000,
        "collected": 9912000000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 1,
        "winningTotal": 9912000000,
        "actualStartValue": 8400000000,
        "plannedStartValue": 8400000000
      },
      {
        "end": "2026-12-31",
        "type": "quarter",
        "start": "2026-10-01",
        "donePct": 0,
        "awaiting": 0,
        "recorded": 0,
        "collected": 0,
        "estimated": 0,
        "soldCount": 0,
        "offeredCount": 0,
        "plannedCount": 2,
        "winningTotal": 0,
        "actualStartValue": 0,
        "plannedStartValue": 20260000000
      },
      {
        "end": "2026-12-31",
        "type": "year",
        "start": "2026-01-01",
        "donePct": 25,
        "awaiting": 0,
        "recorded": 9912000000,
        "collected": 9912000000,
        "estimated": 0,
        "soldCount": 1,
        "offeredCount": 1,
        "plannedCount": 4,
        "winningTotal": 9912000000,
        "actualStartValue": 8400000000,
        "plannedStartValue": 39860000000
      }
    ]
  }
];

const CASES = SAMPLE.flatMap((plan) =>
  plan.sql.map((m) => ({
    name: `${plan.title.replace("Kế hoạch đấu giá QSDĐ năm 2026 · ", "")} · ${m.type} ${m.start}`,
    plan,
    m,
  })),
);

describe("auction_plan_period_metrics (SQL) ↔ planVsActual (TS)", () => {
  it("mẫu đủ 4 kế hoạch × 17 kỳ", () => {
    expect(SAMPLE).toHaveLength(4);
    expect(CASES).toHaveLength(68);
    expect(SAMPLE.flatMap((p) => p.rows)).toHaveLength(20);
    expect(SAMPLE.flatMap((p) => p.rows).filter((r) => r.outcome)).toHaveLength(6);
  });

  it.each(CASES.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const period: PlanPeriod = { type: c.m.type, start: c.m.start };
    const ts = planVsActual(c.plan.rows, period);
    expect({
      end: ts.periodEnd,
      plannedCount: ts.plannedCount,
      plannedStartValue: ts.plannedStartValue,
      offeredCount: ts.offeredCount,
      soldCount: ts.soldCount,
      actualStartValue: ts.actualStartValue,
      winningTotal: ts.winningTotal,
      collected: ts.collected,
      recorded: ts.recorded,
      estimated: ts.estimated,
      awaiting: ts.awaiting,
      donePct: ts.donePct,
    }).toEqual({
      end: c.m.end,
      plannedCount: c.m.plannedCount,
      plannedStartValue: c.m.plannedStartValue,
      offeredCount: c.m.offeredCount,
      soldCount: c.m.soldCount,
      actualStartValue: c.m.actualStartValue,
      winningTotal: c.m.winningTotal,
      collected: c.m.collected,
      recorded: c.m.recorded,
      estimated: c.m.estimated,
      awaiting: c.m.awaiting,
      donePct: c.m.donePct,
    });
  });

  it("khớp 100% trên toàn mẫu", () => {
    const bad = CASES.filter((c) => {
      const ts = planVsActual(c.plan.rows, { type: c.m.type, start: c.m.start });
      return (
        ts.plannedCount !== c.m.plannedCount ||
        ts.plannedStartValue !== c.m.plannedStartValue ||
        ts.offeredCount !== c.m.offeredCount ||
        ts.soldCount !== c.m.soldCount ||
        ts.actualStartValue !== c.m.actualStartValue ||
        ts.winningTotal !== c.m.winningTotal ||
        ts.collected !== c.m.collected ||
        ts.donePct !== c.m.donePct
      );
    });
    expect(bad.map((c) => c.name)).toEqual([]);
  });

  it("tổng 12 tháng của mỗi kế hoạch = chỉ số cả năm (cả hai phía)", () => {
    for (const plan of SAMPLE) {
      const months = plan.sql.filter((m) => m.type === "month");
      const year = plan.sql.find((m) => m.type === "year")!;
      expect(months.reduce((s, m) => s + m.plannedCount, 0)).toBe(year.plannedCount);
      expect(months.reduce((s, m) => s + m.winningTotal, 0)).toBe(year.winningTotal);
      expect(months.reduce((s, m) => s + m.collected, 0)).toBe(year.collected);
    }
  });
});
