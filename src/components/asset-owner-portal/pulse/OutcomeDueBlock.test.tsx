import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { OutcomeDueCard } from "@/hooks/useOwnerPulse";
import { OutcomeDueBlock } from "./OutcomeDueBlock";

const dialogProps = vi.fn();

vi.mock("@/components/asset-owner-portal/outcomes/ReportOutcomeDialog", () => ({
  ReportOutcomeDialog: (props: { open: boolean; defaultKind?: string; target: { listingId: string } | null }): null => {
    dialogProps(props);
    return null;
  },
}));

const card = (id: string, over: Partial<OutcomeDueCard> = {}): OutcomeDueCard => ({
  listingId: id,
  title: `Tài sản ${id}`,
  startingPrice: 5_000_000_000,
  auctionTime: "2026-09-20",
  auctionDay: "2026-09-20",
  daysOverdue: 3,
  previous: null,
  assetOwnerId: null,
  canWrite: true,
  ...over,
});

const renderBlock = (items: OutcomeDueCard[], loading = false) =>
  render(
    <MemoryRouter>
      <OutcomeDueBlock workspaceId="w1" items={items} loading={loading} />
    </MemoryRouter>,
  );

describe("OutcomeDueBlock", () => {
  beforeEach(() => dialogProps.mockClear());

  it("asks about the session and opens the dialog with the clicked outcome preselected", () => {
    renderBlock([card("a")]);
    expect(screen.getByText("Phiên 20/09 · Tài sản a — kết quả thế nào?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Không thành" }));
    expect(dialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, defaultKind: "unsold", target: expect.objectContaining({ listingId: "a" }) }),
    );
  });

  it("shows no write buttons to someone who cannot report", () => {
    renderBlock([card("a", { canWrite: false })]);
    expect(screen.queryByRole("button", { name: "Thành" })).not.toBeInTheDocument();
    expect(screen.getByText("Chỉ xem")).toBeInTheDocument();
  });

  it("shows a positive empty state", () => {
    renderBlock([]);
    expect(screen.getByText("Đã khai đủ kết quả các phiên — tốt lắm.")).toBeInTheDocument();
  });

  it("shows five cards and expands the rest in place", () => {
    renderBlock(["a", "b", "c", "d", "e", "f", "g"].map((id) => card(id)));
    expect(screen.getAllByText(/kết quả thế nào\?$/)).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả" }));
    expect(screen.getAllByText(/kết quả thế nào\?$/)).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Thu gọn" })).toBeInTheDocument();
  });

  it("mentions the earlier round of a re-auctioned asset", () => {
    renderBlock([
      card("a", {
        daysOverdue: 76,
        previous: {
          listingId: "a",
          outcome: "unsold",
          price: null,
          date: "2026-02-02",
          paymentStatus: null,
          confidence: "self_reported",
          hasConflict: false,
          sources: [],
        },
      }),
    ]);
    expect(screen.getByText("Giá KĐ 5 tỷ · Lượt trước: Không thành 02/02/2026 · quá 76 ngày")).toBeInTheDocument();
  });
});
