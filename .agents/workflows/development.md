---
description: Quy trình phát triển 4 phase cho taisandaugia. Bắt buộc cho MỌI task code.
---

# Quy trình phát triển (BẮT BUỘC)

**QUAN TRỌNG:** Theo quy trình này cho MỌI task code. KHÔNG nhảy thẳng vào viết code — bắt đầu bằng
ước lượng độ lớn + phân tích.

taisandaugia là **sản phẩm thật đang chạy** (deploy trên Vercel): React 18 + TS + Vite + shadcn-ui +
Tailwind + TanStack React Query + React Hook Form/Zod + **Supabase thật** (Postgres có RLS, migrations,
project `bcusbpkfnydqcvxxjvew`) + Leaflet/Mapbox + Recharts + vite-plugin-pwa. **Có database, có auth, có
paywall/credit thật.** Copy UI là **tiếng Việt** inline, không dùng thư viện i18n. Mock data trong `src/lib/`
chỉ là tàn dư — **không xây feature mới trên mock**, luôn nối thẳng Supabase (xem `CLAUDE.md`).

---

## Tương thích đa AI-tool

Quy trình này hay nói "delegate cho chuyên gia X" (`cpo`, `kyc-expert`, `credits-paywall-expert`, `cto`,
`ui-ux-designer`, `data-analyst`, `system-architect`, `qa-qc`). Mọi tool chạy giống nhau về tinh thần — cùng
tri thức chuyên gia, cùng đánh giá có cấu trúc, cùng các gate — chỉ khác cơ chế:

| AI Tool | Cách chạy "delegate cho chuyên gia X" |
|---------|----------------------------------------|
| **Claude Code** | Spawn subagent `.claude/agents/<x>` (delegation native). `ui-ux`→persona `ui-ux-designer`, `qa`→persona `qa-qc`. |
| **Codex / Gemini / tool khác** | Đọc `.agents/skills/<persona>/SKILL.md` inline, nhập vai, tự tạo đánh giá có cấu trúc y hệt. |

Persona nằm ở `.agents/skills/`: `orchestrator`, `cpo`, `cto`, `system-architect`, `qa-qc`,
`ui-ux-designer`, `data-analyst`, `kyc-expert`, `credits-paywall-expert`. Persona `orchestrator` sở hữu định
tuyến, giải quyết xung đột và format tổng hợp — các slug là **canonical**, dùng đúng để cross-reference
resolve được.

---

## Ước lượng độ lớn task (xác định trước tiên)

Khớp task với một tier — tier cố định phase nào bắt buộc và triệu tập chuyên gia nào. Bảng này khớp với bảng
tier trong `orchestrator/SKILL.md`.

| Tier | Ví dụ | Phase bắt buộc | Chuyên gia |
|------|-------|----------------|------------|
| **Trivial** | Sửa typo, chỉnh copy Việt, rename biến, lint fix | Phase 3 → 4 | qa-qc (Phase 4) |
| **Small** | 1 bugfix, thêm 1 field/cột vào form/dashboard sẵn có | Phase 1 (tự) → 3 → 4 | qa-qc (Phase 4) |
| **Report / Dashboard** | Dashboard Recharts mới, đổi metric/roll-up, đổi period map — **không thêm bề mặt sản phẩm mới** | Phase 1 (tự) → 2 → 3 → 4 | Phase 2: **system-architect + data-analyst**. Phase 4: qa-qc. **Bỏ cpo/kyc/credits/ui-ux.** |
| **Medium** | Component mới, sửa feature, section trang mới, **đụng paywall/KYC** | Đủ 4 phase | Phase 1: cpo + kyc-expert + credits-paywall-expert. Phase 2: cto + ui-ux-designer. Phase 4: qa-qc |
| **Large** | Module mới, feature xuyên suốt, **đổi data-model / migration / RLS** | Đủ 4 phase | Phase 1: cpo + kyc-expert + credits-paywall-expert. Phase 2: cto + ui-ux-designer + system-architect + data-analyst. Phase 4: qa-qc |

**Luật:**
- Mặc định **Medium** khi không chắc — thà phân tích thừa còn hơn bỏ sót.
- Bất kỳ thứ gì đụng **credit/paywall/unlock** → kéo `credits-paywall-expert`. Bất kỳ thứ gì đụng
  **KYC / org roles / authorization / RLS** → kéo `kyc-expert`. Mọi **report/chart/metric/roll-up** → kéo
  `data-analyst`. Bất kỳ thứ gì đụng **bảng/migration/RLS** → kéo `system-architect`.
- User được override: "bỏ phân tích" / "làm luôn" → Trivial; "phân tích đầy đủ" → Medium/Large.
- **Phase 4 (lint + build) LUÔN bắt buộc**, mọi tier. Test là **theo yêu cầu**, không phải gate.

---

## Chạy song song việc Large

Với task **Large** và các đợt quét rộng, fan-out thay vì làm tuần tự — giảm wall-clock và tăng độ kỹ. Dùng
khi một feature Large trải nhiều module (ví dụ: bảng + migration + hook + wizard + types + test), khi đổi
signature một hook/helper cần quét *mọi caller*, hoặc refactor/quét dead-code rộng / `/code-review ultra`.

- **Claude Code:** dùng subagent (Agent tool) cho từng bề mặt độc lập, rồi reconcile; verify phát hiện một
  cách phản biện trước khi hành động.
- **Tool khác:** chạy cùng phân rã đó thành các sub-task tuần tự.

Orchestration là opt-in và tốn token — bỏ qua cho việc Small/Medium thường ngày.

---

## Phase 1: Phân tích

**Medium/Large:** delegate `cpo`, `kyc-expert`, `credits-paywall-expert` **song song** ngay từ đầu.
**Small:** tự phân tích ngắn (use case, tác động) — không chuyên gia.
**Report / Dashboard:** tự phân tích ngắn về hợp đồng dữ liệu (data contract) — hội đồng chạy ở Phase 2.
**Trivial:** nhảy thẳng Phase 3.

1. **Delegate `cpo` + `kyc-expert` + `credits-paywall-expert` (Medium/Large):**
   - **cpo** — định nghĩa vấn đề, personas (khách mua / rep công ty đấu giá / khách vãng lai / chủ tài sản),
     phù hợp chiến lược, phạm vi MVP, ưu tiên.
   - **kyc-expert** — đúng đắn về governance & authorization: luồng KYC 3-milestone,
     `organizations.kyc_status` `PENDING_KYC → APPROVED | REJECTED`, org roles Owner/Manager/Agent, quy ước
     RLS "own rows", validate CCCD (9–12 số) / passport (≥6) / phone OTP `/^0[0-9]{9}$/`, upload legal docs.
   - **credits-paywall-expert** — đúng đắn về credit/paywall: ledger `credit_transactions` append-only,
     `unlockAsset` **vĩnh viễn** vs `unlockCompany`/`unlockOwner` **có hạn & cộng dồn** (gia hạn từ expiry cũ),
     `unlockDeepReportPeriod` key `"{slug}:{periodId}"` + `expandUnlock`, credit tier/cost, `PaywallContext`,
     `useCredits` là điểm truy cập duy nhất.
2. **Tổng hợp** output chuyên gia theo luật giải quyết xung đột trong `orchestrator/SKILL.md`.
3. **Rồi tự đào sâu:**
   - **Use case** — luồng chính, luồng thay thế, edge case, trạng thái lỗi.
   - **Tác động** — hook/helper/route/role/bảng/RLS nào bị đụng; hiệu ứng chéo module; có chạm auth gate,
     paywall, deduct credit, hay luồng KYC không.
   - **Kiểm tra tái sử dụng** — search hook/helper/component sẵn có trước khi thêm mới (`useCredits`,
     `useAssetPosting`, `orgMatching.ts`, `assetUnlocked`, `companyAccess`, `ownerAccess`, …).
   - **Data flow** — bảng Supabase nào, query key React Query nào, policy RLS nào liên quan.

**GATE — trình phân tích đã tổng hợp cho user và ĐỢI xác nhận. KHÔNG code trước khi được xác nhận.**
Trình: đánh giá cpo, đánh giá kyc/credits, use case, phân tích tác động, câu hỏi mở.

---

## Phase 2: Thiết kế giải pháp

Sau khi phân tích được xác nhận (Report/Dashboard bắt đầu từ đây):

1. **Đề xuất cách tiếp cận** — liệt kê file tạo/sửa và lý do.
2. **Thiết kế component** — tái sử dụng, single-responsibility; giữ page < 300 dòng bằng cách tách section
   ra sub-component. `components/ui/` là shadcn — **không sửa trực tiếp**. Trang mới scaffold bằng
   **`/new-page`**.
3. **Thay đổi dữ liệu / schema** — lên kế hoạch bảng/cột/policy mới.
   - Bảng/migration mới → scaffold bằng **`/migration`** (file `supabase/migrations/<timestamp>_<desc>.sql`,
     có RLS "own rows" nếu là dữ liệu per-user).
   - Query/mutation React Query mới → scaffold bằng **`/add-query`** (mutation phải `invalidate` đúng query
     key, ví dụ `["user-credits", userId]`).
   - Tier/cost/loại unlock mới → dùng **`/add-unlock`** (khớp `lib/credits.ts` + `useCredits`).
4. **Xác định test case từ trước** dựa trên use case Phase 1 — nhất là logic thuần trong `src/lib/**`
   (ví dụ `orgMatching.test.ts`).
5. **Delegate review thiết kế song song:**
   - **Medium:** `cto` (kiến trúc, correctness, bẫy) + `ui-ux-designer` (bố cục, accessibility, nhất quán
     shadcn/design-token HSL).
   - **Report / Dashboard:** `system-architect` (data-model, roll-up, performance, RLS) + `data-analyst`
     (định nghĩa metric/cột, độ chính xác) — **trung tâm cho báo cáo**. Bỏ cpo/kyc/credits/ui-ux.
   - **Large:** cto + ui-ux-designer + system-architect + data-analyst.

**GATE — trình thiết kế cho user và ĐỢI phê duyệt trước khi implement.**

---

## Phase 3: Triển khai

Sau khi thiết kế được duyệt:

1. Theo pattern trong `CLAUDE.md` và `.agents/knowledge/architecture.md`.
2. **Supabase là client typed thật** — luôn `import { supabase } from "@/integrations/supabase/client"`.
   Không có versioned client. Đọc qua React Query; **mutation phải `invalidate`** đúng query key để refresh
   state (ví dụ `queryClient.invalidateQueries({ queryKey: ["user-credits", userId] })`).
3. **RLS được tôn trọng ở mọi đọc/ghi** — bảng credit/unlock chỉ có policy `"own rows"`
   (`USING (auth.uid() = user_id)`). Không lộ dữ liệu credit chéo user.
4. **Nếu đụng schema — chạy migration NGAY tại đây, tự làm bằng Supabase CLI (đừng nhờ user):**
   ```bash
   npx supabase db push                 # áp migration đang chờ lên remote
   npx supabase db push --include-all   # nếu có migration lệch thứ tự
   npx supabase migration list          # xác nhận trạng thái đã áp
   # Regenerate types SAU MỌI đổi schema:
   npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
   ```
   `src/integrations/supabase/types.ts` là **auto-generated — không sửa tay**. Commit lại sau khi regen.
5. **Auth toàn cục** — dùng `useAuth()`/`useProfile()`; mở modal đăng nhập qua `useAuthDialog()`. Đừng thêm
   subscription auth mới (xem memory Auth/Profile Dedup).
6. **Paywall/credit** — mọi thao tác credit qua `useCredits`; đừng gọi `lib/credits.ts` trực tiếp từ
   component. `unlockAsset` vĩnh viễn (`user_asset_unlocks`); `unlockCompany`/`unlockOwner` có hạn & cộng
   dồn; report-period key `"{slug}:{periodId}"`.
7. **Không `asChild` với `<Button>` + `<Link>`** — dùng `useNavigate()` (nếu không button biến mất khỏi DOM,
   không báo lỗi).
8. **Copy tiếng Việt** — mọi text hướng người dùng là tiếng Việt inline; không thêm `t()`/i18next.
9. **Test cạnh code** cho logic thuần `src/lib/**` — co-located `*.test.ts`, viết cùng lúc, không phải sau.
   Tùy chọn cho component/page.

---

## Phase 4: Xác minh (qua qa-qc)

Sau khi implement, delegate `qa-qc`. Chạy cho dự án:

```bash
npm run lint     # 1. Linter
npm run build    # 2. Production build
```

**Cả hai phải pass thì change mới xong.** Đây là **machine-gate** — bắt buộc mọi tier.

- Nếu đụng schema: xác nhận `npx supabase migration list` cho thấy migration đã áp và
  `src/integrations/supabase/types.ts` đã regen + commit.
- `npm run test` chạy **theo yêu cầu** — khi bạn đụng helper/logic `src/lib/**`, nghi có regression, hoặc
  user yêu cầu. **Không** phải gate Phase 4.
- Nếu `CLAUDE.md` hoặc file knowledge bị sửa (luật mới), xác nhận đã cập nhật đúng chỗ (xem Post-Task).

---

## Post-Task: Ghi lại quyết định

**Sau bất kỳ task nào** giới thiệu pattern mới, fix bug không hiển nhiên, hoặc ra quyết định kiến trúc/nghiệp
vụ — chạy **`/log-decision`**: thêm entry gọn có timestamp vào `.agents/knowledge/decisions-log.md` VÀ cập
nhật file knowledge current-truth liên quan (`architecture.md`, `business-rules.md`, `common-pitfalls.md`,
`component-registry.md`, `design-system.md`). Nếu luật thay đổi ảnh hưởng toàn dự án, cập nhật cả `CLAUDE.md`.

---

## Quy ước test

| Mục | Quy ước |
|-----|---------|
| Runner | Vitest (khi cấu hình) — `*.test.ts` co-located |
| Vị trí | Cạnh source: `src/lib/orgMatching.ts` → `src/lib/orgMatching.test.ts` |
| Tập trung coverage | `src/lib/**` (logic credit/unlock, matching, helper) + `src/hooks/**` |
| Không tính coverage | `src/components/**`, `src/pages/**`, `src/components/ui/**` (shadcn) |

Coverage là kỳ vọng, không phải gate. Đẩy logic vào helper thuần, testable để test được mà không cần React.
