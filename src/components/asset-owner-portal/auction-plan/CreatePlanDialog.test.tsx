import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlanUnitOption } from "@/hooks/useAuctionPlans";
import type { AuctionPlan } from "@/lib/auctionPlan/types";
import { CreatePlanDialog } from "./CreatePlanDialog";

const mutate = vi.fn();
vi.mock("@/hooks/useAuctionPlans", () => ({
  useCreateAuctionPlan: () => ({ mutate, isPending: false }),
}));

const YEAR = new Date().getFullYear();

const plan = (over: Partial<AuctionPlan>): AuctionPlan =>
  ({
    id: "p1",
    workspace_id: "w1",
    branch_id: "b1",
    admin_unit_code: "24127",
    cycle_id: null,
    plan_year: YEAR,
    kind: "annual",
    title: null,
    level: "commune",
    status: "draft",
    baseline_version: 0,
    approval_doc_no: null,
    approval_doc_date: null,
    approval_doc_urls: [],
    legal_basis: null,
    notes: null,
    submitted_at: null,
    submitted_by: null,
    reviewed_at: null,
    reviewed_by: null,
    review_comment: null,
    created_by: null,
    created_at: "2026-10-26T00:00:00Z",
    updated_at: "2026-10-26T00:00:00Z",
    ...over,
  }) as AuctionPlan;

const TAGGED: PlanUnitOption = { branchId: "b1", label: "Xã Tân Dĩnh", adminUnitCode: "24127", level: "commune" };
const UNTAGGED: PlanUnitOption = { branchId: "b2", label: "Xã Chưa Gắn", adminUnitCode: null, level: "commune" };

const renderDialog = (plans: AuctionPlan[], unitOptions: PlanUnitOption[]) =>
  render(
    <MemoryRouter>
      <CreatePlanDialog
        open
        onOpenChange={() => {}}
        workspaceId="w1"
        plans={plans}
        unitOptions={unitOptions}
        cycle={null}
        planYear={YEAR}
      />
    </MemoryRouter>,
  );

const saveButton = () => screen.getByRole("button", { name: "Tạo kế hoạch" });

describe("CreatePlanDialog", () => {
  it("lets a unit with an admin-unit code create its first annual plan", () => {
    renderDialog([], [TAGGED]);
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText(new RegExp(`Kế hoạch đấu giá QSDĐ năm ${YEAR} · Xã Tân Dĩnh`))).toBeInTheDocument();
  });

  // Bản sao ở client của partial unique index (annual + status <> 'closed').
  it("warns and disables save when the unit already has a live annual plan for the year", () => {
    renderDialog([plan({ status: "approved" })], [TAGGED]);
    expect(screen.getByRole("alert")).toHaveTextContent(`đã có kế hoạch năm ${YEAR} chưa đóng`);
    expect(saveButton()).toBeDisabled();
  });

  it("a closed plan is not a conflict", () => {
    renderDialog([plan({ status: "closed" })], [TAGGED]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  // Trigger của DB raise "Chưa gán đơn vị hành chính…" ⇒ chặn trước ở UI.
  it("blocks a unit that has no administrative unit tagged, and points at Chi nhánh", () => {
    renderDialog([], [UNTAGGED]);
    expect(screen.getByRole("alert")).toHaveTextContent("chưa được gắn đơn vị hành chính");
    expect(screen.getByRole("button", { name: /Gắn ở trang Chi nhánh \/ AMC/ })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
