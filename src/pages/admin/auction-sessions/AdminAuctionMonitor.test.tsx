import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { AdminAuctionSessionRow, MonitorSessionDetail } from "@/lib/auctionMonitor/monitor";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const listState: { data: AdminAuctionSessionRow[] } = { data: [] };
const detailState: { data: MonitorSessionDetail | null } = { data: null };

vi.mock("@/hooks/useAdminAuctionMonitor", () => ({
  useAdminAuctionSessions: () => ({
    data: listState.data,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
    dataUpdatedAt: 1,
  }),
  useAdminAuctionSessionDetail: () => ({
    data: detailState.data,
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: vi.fn(),
    dataUpdatedAt: 1,
  }),
}));
vi.mock("@/hooks/useAdminPermissions", () => ({ useHasAdminPermission: () => true }));

import AdminAuctionSessionsPage from "./AdminAuctionSessionsPage";
import AdminAuctionSessionDetail from "./AdminAuctionSessionDetail";

const SESSION_ID = "f10d000e-0000-4000-8000-000000000001";

const row = (over: Partial<AdminAuctionSessionRow>): AdminAuctionSessionRow => ({
  id: SESSION_ID,
  code: "PDG000014",
  title: "Phiên đã chốt kết quả",
  status: "published",
  auction_format: "truc_tuyen",
  bidding_method: "ascending",
  province: "Quảng Nam",
  org_name: "Công ty Đấu giá Hợp danh Bảo Tín",
  registration_end_at: "2026-09-07T05:39:00+00:00",
  starts_at: "2026-09-09T05:39:00+00:00",
  ends_at: "2026-09-11T05:39:00+00:00",
  published_at: "2026-08-25T05:39:00+00:00",
  finalized_at: "2026-09-11T05:44:00+00:00",
  cancelled_reason: "",
  created_at: "2026-08-23T05:39:00+00:00",
  lot_count: 2,
  live_lot_count: 0,
  closed_lot_count: 2,
  sold_lot_count: 2,
  dossier_count: 2,
  paid_dossier_count: 2,
  checked_in_count: 2,
  sale_contract_count: 2,
  ...over,
});

// Khung theo payload thật của admin_auction_session_detail (PDG000014), thêm 1 lô đang đấu.
const detail = (): MonitorSessionDetail => ({
  session: {
    id: SESSION_ID,
    code: "PDG000014",
    title: "Phiên đã chốt kết quả",
    status: "published",
    auction_format: "truc_tuyen",
    bidding_method: "ascending",
    venue: "Trực tuyến trên sàn",
    province: "Quảng Nam",
    org_name: "Công ty Đấu giá Hợp danh Bảo Tín",
    organization_id: "c9d00002-0000-4000-8000-000000000001",
    registration_start_at: "2026-08-23T05:39:00+00:00",
    registration_end_at: "2026-09-07T05:39:00+00:00",
    starts_at: "2026-09-09T05:39:00+00:00",
    ends_at: "2026-09-11T05:39:00+00:00",
    dossier_fee: 500000,
    published_at: "2026-08-25T05:39:00+00:00",
    roster_closed_at: "2026-10-07T18:13:13+00:00",
    finalized_at: null,
    cancelled_reason: null,
    created_at: "2026-08-23T05:39:00+00:00",
    updated_at: "2026-10-07T18:13:13+00:00",
  },
  lots: [
    {
      id: "lot-1",
      lot_no: 1,
      title: "Nhà phố 4 tầng hẻm xe hơi, Quận 5",
      starting_price: 12500000000,
      deposit_amount: 1250000000,
      state: "closed",
      current_price: 12700000000,
      bid_count: 1,
      leading_bidder_no: 1,
      round_no: 1,
      opened_at: "2026-09-11T04:59:00+00:00",
      ends_at: "2026-09-11T05:39:00+00:00",
      closed_at: "2026-09-11T05:39:00+00:00",
      result: "sold",
      winning_amount: 12700000000,
      payment_status: "pending",
    },
    {
      id: "lot-2",
      lot_no: 2,
      title: "Nhà mặt ngõ Quảng Nam",
      starting_price: 33400000000,
      deposit_amount: 3340000000,
      state: "open",
      current_price: 33800000000,
      bid_count: 4,
      leading_bidder_no: 2,
      round_no: 1,
      opened_at: "2026-09-11T05:04:00+00:00",
      ends_at: "2026-09-11T05:39:00+00:00",
      closed_at: null,
      result: null,
      winning_amount: null,
      payment_status: null,
    },
  ],
  dossiers: {
    total: 3,
    pending_payment: 1,
    paid: 2,
    refunded: 0,
    cancelled: 0,
    review_pending: 0,
    needs_info: 0,
    approved: 2,
    rejected: 0,
    deposit_received: 2,
    checked_in: 2,
    absent: 0,
  },
  sale_contracts: [
    { id: "sc-1", code: "HDMB000002", lot_id: "lot-1", status: "signed", price: 12700000000, created_at: "2026-09-13T08:57:03+00:00" },
  ],
});

beforeEach(() => {
  listState.data = [];
  detailState.data = null;
});

describe("AdminAuctionSessionsPage", () => {
  it("lists every session with its monitor state and tab counts", () => {
    listState.data = [
      row({}),
      row({ id: "s2", code: "PDG000099", title: "Phiên nháp", status: "draft", dossier_count: 0, paid_dossier_count: 0 }),
    ];
    render(
      <MemoryRouter initialEntries={["/admin/phien-dau-gia"]}>
        <AdminAuctionSessionsPage />
      </MemoryRouter>,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("PDG000014")).toBeInTheDocument();
    expect(within(table).getByText("PDG000099")).toBeInTheDocument();
    expect(within(table).getByText("Đã kết thúc")).toBeInTheDocument();
    expect(within(table).getByText("Nháp")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tất cả\s*2/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: /Mở sàn đấu giá/ })).toHaveAttribute("href", expect.stringMatching(/\/sessions$/));
  });
});

describe("AdminAuctionSessionDetail", () => {
  const renderDetail = () =>
    render(
      <MemoryRouter initialEntries={[`/admin/phien-dau-gia/${SESSION_ID}`]}>
        <Routes>
          <Route path="/admin/phien-dau-gia/:id" element={<AdminAuctionSessionDetail />} />
        </Routes>
      </MemoryRouter>,
    );

  it("shows live lots, dossier counts, sale contracts and deep links to the sàn", () => {
    detailState.data = detail();
    renderDetail();
    expect(screen.getByRole("heading", { name: "Phiên đã chốt kết quả" })).toBeInTheDocument();
    // Lô 2 đang mở ⇒ phiên "Đang đấu giá" dù đã quá giờ kết thúc dự kiến.
    expect(screen.getByText("Đang đấu giá")).toBeInTheDocument();
    expect(screen.getByText("Đang đấu")).toBeInTheDocument();
    expect(screen.getByText(/Trúng 12,700,000,000 ₫ · chờ thanh toán/)).toBeInTheDocument();
    expect(screen.getByText("1 chờ thanh toán")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /HDMB000002/ })).toBeInTheDocument();

    const room = screen.getByRole("link", { name: /Phòng đấu giá/ });
    expect(room).toHaveAttribute("href", expect.stringMatching(new RegExp(`/sessions/${SESSION_ID}/dau-gia$`)));
    expect(room).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /Trang phiên trên sàn/ })).toHaveAttribute(
      "href",
      expect.stringMatching(new RegExp(`/sessions/${SESSION_ID}$`)),
    );
  });

  it("has no links out for a draft session", () => {
    const d = detail();
    d.session.status = "draft";
    detailState.data = d;
    renderDetail();
    expect(screen.queryByRole("link", { name: /Trang phiên trên sàn/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Phiên nháp chưa công bố/)).toBeInTheDocument();
  });

  it("explains a missing session", () => {
    renderDetail();
    expect(screen.getByText(/Không tìm thấy phiên đấu giá/)).toBeInTheDocument();
  });
});
