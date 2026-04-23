

## Triển khai: Diện tích vào logic giá + hiển thị ở chi tiết tài sản

Gộp BLOCK 1 (area bucketing trong analytics) + plan hiển thị diện tích ở chi tiết BĐS thành một lần triển khai.

### Files thay đổi

**Logic & data**
- `src/lib/auctionPriceAnalytics.ts` — area buckets, fallback ladder, outlier guard, tất cả metric trên giá/m².
- `src/lib/mockAuctionSessions.ts` — sinh thêm field `area` (lognormal quanh `assetArea`, deterministic theo seed).
- `src/lib/auctionPriceAnalytics.test.ts` — thêm 6 test case mới.
- `src/utils/formatters.ts` — bổ sung `formatAreaM2(n)` (số nguyên + dấu phân cách + " m²").

**UI hiển thị diện tích**
- `src/components/auction/AuctionQuickInfo.tsx` — chip "Diện tích: X m²" (chỉ khi BĐS + area>0).
- `src/components/auction/AuctionInfoTable.tsx` — row "Diện tích" ngay sau "Loại tài sản".
- `src/components/auction/AuctionPriceHistory.tsx` — wire bucket vào header context line, tooltip secondary (tổng giá), insight có context bucket, dòng phụ "Diện tích tài sản: X m² → đối chiếu nhóm Y–Z m²".

### Logic chi tiết (BLOCK 1)

**Area buckets**: `<40`, `40–60`, `60–80`, `80–120`, `>120` m². Auto match theo `assetArea` (round → pick).

**Pipeline trong `computeAnalytics`**:
```text
1. AC1: assetArea invalid/<=0 → mode='no-area'
2. AC7a: assetArea > 3× median(area khu vực) → mode='no-area' (outlier)
3. AC2: pick bucket → filter sessions theo bucket
4. AC3 ladder:
   - <5 phiên → merge bucket liền kề (ưu tiên phía gần median khu vực)
   - vẫn <5 → mode='no-area'
   - else → mode='area-bucket'
5. AC7b: bucket sau merge bao >2 bucket gốc → flags.skipPosition=true
6. AC4: median/p25/p75/trend/vol/position tính trên filtered set (giá đã là tr/m²)
```

**AnalyticsResult mở rộng**: `{ ...current, areaMode, bucketLabel?, bucketRange?, skipPosition?, mergedFrom? }`

### UI hiển thị (cả 2 plan)

| Vị trí | Mode `area-bucket` | Mode `no-area` |
|--------|--------------------|-----------------|
| Quick info chip | `🏠 60 m²` | `🏠 60 m²` (nếu có) |
| Bảng thông tin | row `Diện tích \| 60 m²` | row `Diện tích \| 60 m²` |
| Header price block | `Dữ liệu từ N phiên ~60–80 m² trong khu vực` (+ badge "Đã mở rộng dải" nếu merged) | `Dữ liệu từ N phiên trong khu vực (không phân theo diện tích)` + tooltip lý do |
| Tooltip chart | giá/m² (primary) + tổng giá `median × assetArea` (secondary) | giá/m² only |
| Insight | prepend `nhóm {bucketLabel} m²` vào mọi bullet | suffix `(không phân theo diện tích)` |
| Position bullet | hiện | ẩn nếu `skipPosition=true` |

### Điều kiện hiển thị diện tích chi tiết

- Property type ∈ nhóm BĐS.
- `area > 0` và là số hợp lệ (`listing.custom_attributes.area` → fallback `listing.area`).
- Thiếu/invalid → ẩn hoàn toàn (không show "—").
- Format: `1.250 m²` (số nguyên, dấu phân cách `.`, suffix ` m²`).

### Test coverage

6 case mới trong `auctionPriceAnalytics.test.ts`:
1. Bucket 60-80 đủ ≥5 → `area-bucket` range [60,80].
2. Bucket 60-80 có 3 phiên → merge 40-80, đủ ≥5 → `mergedFrom=['40-60','60-80']`.
3. Sau merge vẫn <5 → `no-area`.
4. assetArea=500, median khu vực=80 → outlier → `no-area`.
5. Merge bao >2 bucket → `skipPosition=true`.
6. assetArea=0 → `no-area`.

### Out of scope

- Không đổi DB schema, không đổi form nhập liệu.
- Không cho user chọn bucket (Phase 1 auto only).
- Không thêm filter diện tích ở trang `Listings`.
- Không đụng chi tiết tài sản phi BĐS (xe, máy móc).
- Không update lại tài liệu PDF/Markdown đã tạo trước.

