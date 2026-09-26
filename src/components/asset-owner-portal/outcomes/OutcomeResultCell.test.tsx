import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import { OutcomeResultCell } from "./OutcomeResultCell";

const base: ResolvedAssetOutcome = {
  listingId: "l1",
  outcome: "sold",
  price: 28450000000,
  date: "2026-09-13",
  paymentStatus: "pending",
  confidence: "platform",
  hasConflict: false,
  sources: [
    { kind: "platform", label: "platform", outcome: "sold", price: 28450000000, date: "2026-09-13", orgName: null, sessionCode: "PDG000013", roundNo: null, refId: null, paymentStatus: null },
  ],
};

const renderCell = (outcome: ResolvedAssetOutcome | undefined) =>
  render(
    <TooltipProvider>
      <OutcomeResultCell outcome={outcome} />
    </TooltipProvider>,
  );

describe("OutcomeResultCell", () => {
  it("shows the full winning price with the platform label", () => {
    renderCell(base);
    expect(screen.getByText("28,450,000,000 ₫")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nguồn số liệu: Sàn xác nhận" })).toBeInTheDocument();
    expect(screen.queryByText("Lệch số liệu")).not.toBeInTheDocument();
  });

  it("labels an organisation report as 'Tự khai'", () => {
    renderCell({ ...base, price: 8792336264, confidence: "self_reported" });
    expect(screen.getByText("8,792,336,264 ₫")).toBeInTheDocument();
    expect(screen.getByText("Tự khai")).toBeInTheDocument();
  });

  it("shows the outcome word when there is no price", () => {
    renderCell({ ...base, outcome: "unsold", price: null, confidence: "self_reported" });
    expect(screen.getByText("Không thành")).toBeInTheDocument();
  });

  it("adds the conflict chip", () => {
    renderCell({ ...base, hasConflict: true });
    expect(screen.getByRole("button", { name: "Lệch số liệu giữa các nguồn" })).toBeInTheDocument();
  });

  it("renders a dash when no source speaks", () => {
    renderCell(undefined);
    expect(screen.getByText("—")).toBeInTheDocument();
    renderCell({ ...base, outcome: null, confidence: null, price: null, sources: [] });
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
