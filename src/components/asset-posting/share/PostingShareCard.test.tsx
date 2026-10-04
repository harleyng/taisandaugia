import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { AssetPosting } from "@/types/asset-posting";
import type { PostingShareLink, PostingShareLinks } from "@/lib/postingShare/types";
import { PostingAccessProvider } from "../postingAccess";
import { PostingShareCard } from "./PostingShareCard";

const state: { data: PostingShareLinks | undefined } = { data: undefined };

vi.mock("@/hooks/usePostingShareLinks", () => ({
  usePostingShareLinks: () => ({ data: state.data, isLoading: false, isError: false }),
  useCreateShareLink: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateShareLink: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeShareLink: () => ({ mutate: vi.fn(), isPending: false }),
  useShareSenders: () => ({ data: [] as unknown[], isLoading: false }),
  copyText: vi.fn(),
}));

const posting = {
  id: "p1",
  code: "HS-0001",
  title: "Nhà phố Quận 7",
  child_slug: "nha-pho",
  delta_fields: { land_area: 120 },
  province: "TP. Hồ Chí Minh",
  starting_price: 12_400_000_000,
  status: "active",
  review_status: "approved",
} as unknown as AssetPosting;

const link = (over: Partial<PostingShareLink>): PostingShareLink => ({
  id: "l1",
  code: "Ab3_-xYz0123",
  label: "Anh Minh – KHDN",
  senderUserId: null,
  senderName: null,
  senderPhone: null,
  showPrice: false,
  showExactAddress: false,
  showSenderContact: false,
  expiresAt: null,
  revokedAt: null,
  viewCount: 12,
  uniqueViewCount: 7,
  ctaDossierCount: 3,
  ctaPdfCount: 0,
  ctaFollowCount: 2,
  ctaCallCount: 0,
  lastViewedAt: "2026-10-01T02:00:00Z",
  createdByName: "Chị Lan",
  createdAt: "2026-09-30T02:00:00Z",
  postingId: "p1",
  listingId: null,
  workspaceId: null,
  branchId: null,
  branchName: null,
  channel: "zalo",
  campaignId: null,
  campaignName: null,
  targetKind: "posting",
  targetTitle: "Nhà phố Quận 7",
  targetCode: "HS-0001",
  targetImage: null,
  isLegacy: false,
  canManage: null,
  ...over,
});

function renderCard(p: AssetPosting, share: boolean) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PostingAccessProvider value={{ edit: share, consign: false, consignCreate: false, share }}>
          <PostingShareCard posting={p} />
        </PostingAccessProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PostingShareCard — Hồ sơ online", () => {
  beforeEach(() => {
    state.data = undefined;
  });

  it("chưa có link: người có quyền thấy nút tạo; hồ sơ chưa duyệt ⇒ nút khoá + lý do", () => {
    state.data = { canShare: true, links: [] };
    const { unmount } = renderCard(posting, true);
    expect(screen.getByRole("button", { name: /Tạo link chia sẻ/ })).toBeEnabled();
    unmount();

    renderCard({ ...posting, review_status: "pending" } as AssetPosting, true);
    expect(screen.getByRole("button", { name: /Tạo link chia sẻ/ })).toBeDisabled();
    expect(screen.getByText(/cần được sàn duyệt/)).toBeInTheDocument();
  });

  it("người chỉ có quyền xem: thấy số liệu, không có nút tạo / menu thao tác", () => {
    state.data = { canShare: false, links: [link({ code: null })] };
    renderCard(posting, false);
    expect(screen.queryByRole("button", { name: /Tạo link chia sẻ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thao tác với link/ })).not.toBeInTheDocument();
    const row = screen.getAllByText("Anh Minh – KHDN")[0].closest("tr")!;
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).getByText("7 người")).toBeInTheDocument();
  });

  it("đếm link đang mở; link thu hồi hiện trạng thái riêng", () => {
    state.data = {
      canShare: true,
      links: [link({}), link({ id: "l2", label: "Nhóm Zalo KH", revokedAt: "2026-09-30T05:00:00Z" })],
    };
    renderCard(posting, true);
    expect(screen.getAllByText("Đã thu hồi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang mở").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Thao tác với link/ }).length).toBeGreaterThanOrEqual(2);
  });
});
