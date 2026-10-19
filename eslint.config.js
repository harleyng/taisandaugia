import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// ─── Ranh giới nền tảng thông tin ⟷ sàn đấu giá trực tuyến ─────────────────────
// docs/auction-platform-split-plan.md + docs/platform-ownership.md §7. Code AUC đã
// chuyển sang repo taisanviet (Phase 5 xoá khỏi đây) — danh sách dưới đây giữ lại
// để không ai tạo lại / import lại các module đó trong repo này. Link sang màn đấu
// giá đi qua `@/lib/auctionPlatform` / `<AuctionLink>` / `<AuctionRedirect>`.
const AUCTION_DIRS = [
  "components/auction-sessions", "components/bidding-room", "components/bidder-registration",
  "components/bidder-checkin", "components/bidding-contracts", "components/buyer-contracts",
  "components/case-qa", "components/ekyc", "components/vneid",
  "components/portal/auction-sessions", "components/portal/bidding-contracts", "components/portal/bidding-control",
  "components/portal/checkin", "components/portal/case-chat", "components/portal/case-documents",
  "components/portal/outreach",
  "lib/auctionSessions", "lib/bidding", "lib/biddingContracts", "lib/caseQa", "lib/outreach", "lib/ekyc", "lib/vneid",
];
const AUCTION_FILES = [
  "types/auction-session", "types/auction-bidding", "types/bidding-contract", "types/case-qa", "types/case-chat",
  "types/outreach",
  ...[
    "useAuctionSessions", "usePublicAuctionSessions", "usePublicSessionPage", "useBiddingContracts", "useBuyerContracts",
    "useCaseDocumentExtraction", "useCaseDocuments", "useCaseEscalations", "useCaseQaAnswer", "useCaseQuestions",
    "useCitableClauses", "useKycProfile", "useLotBids", "useLotDetail", "useLotStates", "useMethodBids",
    "useMyBidderStatus", "useOrgBidding", "useOrgBiddingContracts", "useOrgChat", "useOrgChatSettings",
    "useOrgTieRound", "useOutreachChannels", "useOutreachWorkspace", "useOutreachWriter", "usePlaceBid",
    "useSelfCheckIn", "useServerClock", "useSessionAudience", "useSessionCheckin", "useSessionOutreach",
    "useVneidIdentity",
  ].map((h) => `hooks/${h}`),
  ...[
    "AuctionBiddingRoomPage", "AuctionSessionDetail", "AuctionSessionQaPage", "AuctionSessions",
    "BidderRegistrationPage", "ContractDepositPage", "MyContractDetailPage", "chu-tai-san/OwnerSaleContractDetailPage",
    "portal/BidderCardPrintPage", "portal/HoSoThamGiaDetailPage", "portal/HoSoThamGiaPage", "portal/HoiDapPage",
    "portal/HopDongMuaBanDetailPage", "portal/PhienDauGiaDetailPage", "portal/PhienDauGiaFormPage",
    "portal/PhienDauGiaPage", "portal/PhienDauGiaQaPreviewPage", "portal/SessionRosterPrintPage",
  ].map((p) => `pages/${p}`),
];
const auctionBoundary = {
  files: ["src/**/*.{ts,tsx}"],
  ignores: [
    ...AUCTION_DIRS.map((d) => `src/${d}/**`),
    ...AUCTION_FILES.flatMap((f) => [`src/${f}.ts`, `src/${f}.tsx`, `src/${f}.test.ts`, `src/${f}.test.tsx`]),
  ],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: [...AUCTION_DIRS.flatMap((d) => [`@/${d}`, `@/${d}/**`]), ...AUCTION_FILES.map((f) => `@/${f}`)],
        message: "Module này thuộc sàn đấu giá trực tuyến (repo taisanviet). Dùng @/lib/auctionPlatform / <AuctionLink>, hoặc chuyển phần dùng chung sang @/lib/auctionCore | @/lib/messaging. Xem docs/platform-ownership.md §7.",
      }],
    }],
  },
};

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // shadcn-ui primitives là code vendored, sinh bởi `npx shadcn add`. CLAUDE.md
  // quy định không sửa: sửa tay sẽ bị ghi đè ở lần cập nhật component sau, và
  // diff vendored lẫn vào diff nghiệp vụ khiến review khó. Tắt đúng 2 rule mà
  // upstream vi phạm, KHÔNG tắt cả bộ.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  // Provider + hook `useX()` xuất chung một file là pattern chính tắc của React
  // Context. react-refresh cảnh báo vì file xuất cả component lẫn non-component,
  // nhưng tách ra chỉ đổi lấy 2 file cho mỗi context mà không được gì.
  {
    files: ["src/contexts/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  auctionBoundary,
);
