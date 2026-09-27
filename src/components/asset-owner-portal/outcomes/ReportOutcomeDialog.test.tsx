import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { OffPlatformOutcomeTarget, ReportOutcomeTarget } from "@/lib/ownerOutcomeReport";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";
import { ReportOutcomeDialog } from "./ReportOutcomeDialog";

const mutate = vi.fn();
const saveMutate = vi.fn();
let reportedRounds: number[] = [];
let offRounds: number[] = [];

vi.mock("@/hooks/useOwnerOutcomeReports", () => ({
  useOwnerOutcomeRounds: () => ({
    data: reportedRounds,
    isSuccess: true,
    isError: false,
    fetchStatus: "idle",
  }),
  useReportOwnerOutcome: () => ({ mutate, isPending: false }),
}));

vi.mock("@/hooks/useOwnerOutcomesOverview", () => ({
  // Query tắt (tài sản ngoài sàn mới) không bao giờ "success" — dialog không được chờ nó.
  useOwnerOutcomeHistory: (_ws: string, asset: unknown) =>
    asset
      ? { data: offRounds.map((round_no) => ({ round_no })), isSuccess: true, isError: false, fetchStatus: "idle" }
      : { data: undefined, isSuccess: false, isError: false, fetchStatus: "idle" },
}));

vi.mock("@/hooks/useOwnerOutcomeEdit", () => ({
  useSaveOwnerOutcome: () => ({ mutate: saveMutate, isPending: false }),
}));

vi.mock("@/components/shared/AuctionOrgPicker", () => ({
  AuctionOrgPicker: () => <div data-testid="org-picker" />,
}));

const target: ReportOutcomeTarget = {
  listingId: "l1",
  title: "Nhà đất Q.7",
  startingPrice: 5_000_000_000,
  auctionTime: "2026-09-24",
};

const renderDialog = (defaultKind?: "sold" | "unsold" | "void") =>
  render(
    <ReportOutcomeDialog open onOpenChange={() => {}} workspaceId="w1" target={target} defaultKind={defaultKind} />,
  );

const save = () => fireEvent.click(screen.getByRole("button", { name: "Lưu kết quả" }));

describe("ReportOutcomeDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    saveMutate.mockReset();
    reportedRounds = [];
    offRounds = [];
  });

  it("prefills the next round and the starting price, and submits a sold report", async () => {
    reportedRounds = [1];
    renderDialog();
    expect(await screen.findByLabelText(/^Lượt đấu/)).toHaveValue("2");
    expect(screen.getByText("Đã khai 1 lượt")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Giá trúng \(₫\)/)).toHaveValue("5,000,000,000");
    expect(screen.getByText("Giá khởi điểm 5,000,000,000 ₫")).toBeInTheDocument();

    save();
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const [{ form, target: sent, evidence }] = mutate.mock.calls[0];
    expect(form).toMatchObject({ kind: "sold", roundNo: "2", auctionDate: "2026-09-24", winningPrice: "5000000000" });
    expect(sent).toBe(target);
    expect(evidence).toBeNull();
  });

  it("asks for a reason before saving 'Không thành'", async () => {
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /Không thành/ }));
    save();
    expect(await screen.findByText("Chọn lý do")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Chỉ 1 người" }));
    save();
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0].form).toMatchObject({ kind: "unsold", unsoldReason: "single_bidder" });
  });

  it("opens on a preselected 'Hoãn-Huỷ' with the postponed sub-choice", async () => {
    renderDialog("void");
    expect(await screen.findByRole("radio", { name: "Hoãn" })).toHaveAttribute("data-state", "on");
    expect(screen.queryByLabelText(/^Giá trúng \(₫\)/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Huỷ" }));
    save();
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0].form).toMatchObject({ kind: "void", voidOutcome: "cancelled" });
  });

  it("reports a new off-platform asset without waiting on a rounds query", async () => {
    const off: OffPlatformOutcomeTarget = { kind: "offplatform" };
    render(<ReportOutcomeDialog open onOpenChange={() => {}} workspaceId="w1" target={off} branches={[{ id: "b1", label: "Chi nhánh A" }]} />);
    expect(await screen.findByRole("heading", { name: "Khai tài sản ngoài sàn" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Lượt đấu/)).toHaveValue("1");

    save();
    expect(await screen.findByText("Nhập tên tài sản (ít nhất 3 ký tự)")).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Tên tài sản/), { target: { value: "Xe tải Hino 2019" } });
    fireEvent.change(screen.getByLabelText(/^Giá trúng \(₫\)/), { target: { value: "900000000" } });
    save();
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    const [input] = saveMutate.mock.calls[0];
    expect(input).toMatchObject({ mode: "create", target: off, form: { assetTitle: "Xe tải Hino 2019", winningPrice: "900000000" } });
    expect(mutate).not.toHaveBeenCalled();
  });

  it("requires a branch from branch-scoped staff and prefills the next off-platform round", async () => {
    offRounds = [1, 2];
    const off: OffPlatformOutcomeTarget = { kind: "offplatform", title: "Xe tải Hino", titleKey: "xe tải hino" };
    render(
      <ReportOutcomeDialog
        open
        onOpenChange={() => {}}
        workspaceId="w1"
        target={off}
        defaultKind="unsold"
        branches={[{ id: "b1", label: "Chi nhánh A" }, { id: "b2", label: "Chi nhánh B" }]}
        branchScope={["b1", "b2"]}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Khai lượt tiếp theo" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Lượt đấu/)).toHaveValue("3");
    fireEvent.click(screen.getByRole("radio", { name: "Không ai đăng ký" }));
    save();
    expect(await screen.findByText("Chọn chi nhánh trong phạm vi của bạn")).toBeInTheDocument();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("edits an existing round with its saved values", async () => {
    const record = {
      id: "o1",
      workspace_id: "w1",
      listing_id: "l1",
      round_no: 2,
      auction_date: "2026-09-01",
      outcome: "sold",
      winning_price: 6_000_000_000,
      participants: 3,
      failure_reason: null,
      evidence_urls: ["w1/o1/bien-ban.pdf"],
      asset_title: null,
    } as unknown as OwnerOutcomeRecord;
    render(<ReportOutcomeDialog open onOpenChange={() => {}} workspaceId="w1" target={target} record={record} />);
    expect(await screen.findByRole("heading", { name: "Sửa lượt 2" })).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Lượt đấu/)).toHaveValue("2");
    expect(screen.getByLabelText(/^Giá trúng \(₫\)/)).toHaveValue("6,000,000,000");
    expect(screen.getByText("Đã có biên bản — chọn tệp mới nếu muốn thay.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(saveMutate.mock.calls[0][0]).toMatchObject({ mode: "update", record, form: { roundNo: "2", winningPrice: "6000000000" } });
  });
});
