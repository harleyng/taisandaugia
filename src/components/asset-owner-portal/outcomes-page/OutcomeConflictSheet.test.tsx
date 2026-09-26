import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { OutcomeOverviewRow, OverviewSource } from "@/lib/ownerOutcomesOverview";
import { OutcomeConflictSheet } from "./OutcomeConflictSheet";

const resolve = vi.fn();

vi.mock("@/hooks/useOwnerOutcomesOverview", () => ({
  useOwnerOutcomeHistory: () => ({ data: [] as unknown[], isLoading: false }),
}));
vi.mock("@/hooks/useOwnerOutcomeConflict", () => ({
  useResolveOutcomeConflict: () => ({ mutate: resolve, isPending: false }),
}));
vi.mock("@/hooks/useOwnerOutcomeEdit", () => ({
  useDeleteOwnerOutcome: () => ({ mutate: vi.fn(), isPending: false }),
  outcomeEvidenceUrl: vi.fn(),
}));

const src = (over: Partial<OverviewSource>): OverviewSource => ({
  kind: "org_report",
  label: "self_reported",
  outcome: "sold",
  price: 8_792_336_264,
  date: "2026-03-21",
  orgName: "Công ty X",
  sessionCode: null,
  roundNo: null,
  refId: "r1",
  paymentStatus: null,
  fp: "org_report|r1|sold|8792336264",
  dismissed: false,
  inRound: true,
  disagrees: false,
  ...over,
});

const own = src({ kind: "owner_report", price: 9_300_000_000, refId: "o1", roundNo: 1, fp: "owner_report|o1|sold|9300000000", date: "2026-03-18" });

const row = (sources: OverviewSource[], over: Partial<OutcomeOverviewRow> = {}): OutcomeOverviewRow => ({
  rowKey: "l:l1",
  listingId: "4bae607e-0000-4000-8000-000000000001",
  titleKey: null,
  ownOutcomeId: "o1",
  ownRoundNo: 1,
  roundsReported: 1,
  title: "Đất dự án Ba Đình",
  category: null,
  branchId: "b1",
  orgName: "Công ty X",
  startingPrice: null,
  outcome: "sold",
  price: sources[0].price,
  date: sources[0].date,
  paymentStatus: null,
  paidAmount: null,
  bestKind: sources[0].kind,
  confidence: sources[0].label,
  hasConflict: true,
  sources,
  ...over,
});

const renderSheet = (r: OutcomeOverviewRow, canWrite = true) =>
  render(
    <TooltipProvider>
      <OutcomeConflictSheet
        workspaceId="w1"
        row={r}
        onClose={() => {}}
        branchLabel="Chi nhánh A"
        canWrite={canWrite}
        onEdit={() => {}}
        onReportNext={() => {}}
      />
    </TooltipProvider>,
  );

describe("OutcomeConflictSheet", () => {
  beforeEach(() => resolve.mockReset());

  it("offers both choices when the organisation's number is in use and ours disagrees", () => {
    renderSheet(row([src({}), { ...own, disagrees: true }]));
    fireEvent.click(screen.getByRole("button", { name: "Dùng số của tổ chức" }));
    expect(resolve).toHaveBeenCalledWith({
      listingId: "4bae607e-0000-4000-8000-000000000001",
      choice: "use_source",
      sourceFp: "org_report|r1|sold|8792336264",
    });
    fireEvent.click(screen.getByRole("button", { name: "Giữ số của tôi" }));
    expect(resolve).toHaveBeenLastCalledWith({ listingId: "4bae607e-0000-4000-8000-000000000001", choice: "keep_mine" });
  });

  it("only lets the platform's number be adopted when the platform result is in use", () => {
    renderSheet(
      row([
        src({ kind: "platform", label: "platform", price: 28_450_000_000, refId: "i1", fp: "platform|i1|sold|28450000000" }),
        { ...own, disagrees: true },
        src({ disagrees: true }),
      ]),
    );
    expect(screen.queryByRole("button", { name: "Giữ số của tôi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dùng số của tổ chức" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dùng số của sàn" })).toBeInTheDocument();
  });

  it("lets the unit adopt a number when it has not reported this round", () => {
    renderSheet(row([src({}), src({ kind: "crawled", label: "estimated", price: 9_900_000_000, refId: "l1", fp: "crawled|l1|sold|9900000000", disagrees: true })], { ownOutcomeId: null, ownRoundNo: null }));
    expect(screen.queryByRole("button", { name: "Giữ số của tôi" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dùng số của tổ chức" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dùng số ước tính" })).toBeInTheDocument();
  });

  it("shows no actions to members without write access, and none once sources agree", () => {
    const { unmount } = renderSheet(row([src({}), { ...own, disagrees: true }]), false);
    expect(screen.queryByRole("button", { name: /Giữ số|Dùng số|Khai lượt tiếp theo/ })).not.toBeInTheDocument();
    unmount();
    renderSheet(row([{ ...own }, src({ dismissed: true, disagrees: true })], { hasConflict: false, bestKind: "owner_report" }));
    expect(screen.getByText("Các nguồn đang khớp nhau.")).toBeInTheDocument();
    expect(screen.getByText("Đơn vị đã bỏ qua")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Giữ số|Dùng số/ })).not.toBeInTheDocument();
  });
});
