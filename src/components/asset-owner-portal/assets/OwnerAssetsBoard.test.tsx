import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { OwnerAssetRow, OwnerClaimRow } from "@/lib/ownerAssets";
import { OwnerAssetsBoard } from "./OwnerAssetsBoard";

// Dialog khai kết quả gọi Supabase — thay bằng bản giả hiện tiêu đề target.
vi.mock("@/components/asset-owner-portal/outcomes/ReportOutcomeDialog", () => ({
  ReportOutcomeDialog: ({ open, target }: { open: boolean; target: { title: string } | null }) =>
    open ? <div role="dialog">Khai kết quả: {target?.title}</div> : null,
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigateMock,
}));

const row = (over: Partial<OwnerAssetRow>): OwnerAssetRow => ({
  id: "x",
  kind: "posting",
  title: "Tài sản",
  href: "/chu-tai-san/dang-tai-san/x",
  stage: "niem_yet",
  since: null,
  days: 3,
  overdue: false,
  detail: null,
  price: 1_000_000_000,
  priceKind: "starting",
  phase: "auc",
  stepLabel: "Niêm yết",
  code: null,
  category: "Nhà phố",
  thumbnail: null,
  parentSlug: "bat-dong-san",
  province: "Hà Nội",
  branch: "CN Hà Nội",
  rounds: 1,
  orgName: null,
  startingPrice: 1_000_000_000,
  next: { mine: false, text: "Phiên 08/10", waitingOn: "Tổ chức", cta: null },
  links: [],
  claim: null,
  ...over,
});

const reportable = row({
  id: "l1",
  kind: "listing",
  title: "Nhà phố Lê Văn Sỹ",
  stage: "phien",
  stepLabel: "Phiên đấu giá",
  code: "8F2A1C00",
  province: "TP.HCM",
  branch: "CN Sài Gòn",
  next: { mine: true, text: "Phiên đã diễn ra — khai kết quả", waitingOn: null, cta: { label: "Khai kết quả", action: { kind: "report_outcome" } } },
  claim: {
    id: "c1",
    workspace_id: "w1",
    listing_id: "l1",
    asset_owner_id: null,
    confidence_score: null,
    match_basis: null,
    matched_name: null,
    status: "confirmed",
    confirmed_by: null,
    confirmed_at: null,
    rejection_reason: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    listing: { title: "Nhà phố Lê Văn Sỹ", price: 12e9, property_type_slug: null, image_url: null, status: null, address: null },
  },
});
const late = row({ id: "p2", title: "Máy xúc Komatsu", overdue: true, stage: "hd_dich_vu", phase: "prep", stepLabel: "HĐ dịch vụ" });
const done = row({ id: "p3", title: "Xe tải Hino", stage: "da_thu_tien", phase: "done", stepLabel: "Đã thu đủ" });

const pending: OwnerClaimRow = {
  id: "c9",
  listingId: "l9",
  title: "Căn hộ The Sun Avenue",
  category: "Căn hộ",
  thumbnail: null,
  parentSlug: "bat-dong-san",
  province: "TP.HCM",
  branch: "CN Sài Gòn",
  matchedName: "Ngân hàng An Phát – CN Sài Gòn",
  score: 96,
  price: 2.9e9,
  auctionDay: "2026-10-15",
  canWrite: true,
};

const renderBoard = (props: Partial<Parameters<typeof OwnerAssetsBoard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <OwnerAssetsBoard
        rows={[reportable, late, done]}
        claimRows={[pending]}
        loading={false}
        postingsError={false}
        onRetryPostings={() => {}}
        workspaceId="w1"
        onConfirmClaim={() => {}}
        onRejectClaim={() => {}}
        onConfirmAllClaims={() => {}}
        claimBusy={false}
        canConfirmAll
        canCreatePosting
        {...props}
      />
    </MemoryRouter>,
  );

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("OwnerAssetsBoard", () => {
  it("đếm theo tab và lọc theo nhóm giai đoạn", () => {
    renderBoard();
    expect(tab(/Cần bạn xử lý/)).toHaveTextContent("1");
    expect(tab(/Sàn tìm thấy/)).toHaveTextContent("1");
    expect(tab(/Tất cả/)).toHaveTextContent("3");
    expect(bodyRows()).toHaveLength(3);

    fireEvent.click(tab(/Cần bạn xử lý/));
    expect(bodyRows().map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      expect.stringContaining("Nhà phố Lê Văn Sỹ"),
    ]);

    fireEvent.click(tab(/Đã thu tiền/));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Xe tải Hino")).toBeInTheDocument();
  });

  it("chỉ tài sản chậm tiến độ", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Máy xúc Komatsu")).toBeInTheDocument();
  });

  it("nút Khai kết quả mở dialog với đúng tài sản, không mở ngăn chi tiết", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Khai kết quả" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Khai kết quả: Nhà phố Lê Văn Sỹ");
  });

  it("bấm dòng mở ngăn chi tiết với việc tiếp theo", () => {
    renderBoard();
    fireEvent.click(screen.getByText("Máy xúc Komatsu"));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Đang chờ tổ chức")).toBeInTheDocument();
    expect(within(sheet).getByText(/chậm tiến độ/)).toBeInTheDocument();
  });

  it("tab Sàn tìm thấy: Không phải / Xác nhận / Xác nhận tất cả", () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    const onAll = vi.fn();
    renderBoard({ onConfirmClaim: onConfirm, onRejectClaim: onReject, onConfirmAllClaims: onAll });
    fireEvent.click(tab(/Sàn tìm thấy/));
    expect(screen.getByText("Khớp 96%")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Không phải" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tất cả" }));
    expect(onReject).toHaveBeenCalledWith("c9");
    expect(onConfirm).toHaveBeenCalledWith("c9");
    expect(onAll).toHaveBeenCalledOnce();
  });

  it("ẩn tab Sàn tìm thấy khi không còn tin chờ", () => {
    renderBoard({ claimRows: [] });
    expect(screen.queryByRole("tab", { name: /Sàn tìm thấy/ })).not.toBeInTheDocument();
  });

  it("tìm theo mã tài sản", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "8f2a" } });
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("1 / 3 tài sản")).toBeInTheDocument();
  });
});
