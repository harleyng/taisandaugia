import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AssetOwnerClaim, ClaimStatus } from "@/types/asset-owner";
import { ClaimsTable } from "./ClaimsTable";

const claim = (id: string, status: ClaimStatus, listingId: string | null = `l-${id}`): AssetOwnerClaim =>
  ({
    id,
    workspace_id: "w1",
    listing_id: listingId,
    asset_owner_id: null,
    confidence_score: null,
    match_basis: null,
    matched_name: null,
    status,
    confirmed_by: null,
    confirmed_at: null,
    rejection_reason: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    listing: { title: `Tài sản ${id}`, price: 1, property_type_slug: null, image_url: null, status: null, address: null },
  }) as AssetOwnerClaim;

const claims = [
  claim("a", "confirmed"),
  claim("b", "auto_claimed"),
  claim("c", "pending_confirmation"),
  claim("d", "rejected"),
  claim("e", "confirmed", null),
];

const renderTable = (props: Partial<Parameters<typeof ClaimsTable>[0]> = {}) =>
  render(
    <MemoryRouter>
      <ClaimsTable
        claims={claims}
        onConfirm={() => {}}
        onReject={() => {}}
        onConfirmAll={() => {}}
        isProcessing={false}
        {...props}
      />
    </MemoryRouter>,
  );

const rowOf = (title: string) => screen.getByText(title).closest("tr")!;

describe("ClaimsTable — Khai kết quả", () => {
  it("shows the button only on owned rows with a listing, and reports the clicked claim", () => {
    const onReportOutcome = vi.fn();
    renderTable({ onReportOutcome });
    expect(screen.getAllByRole("button", { name: "Khai kết quả" })).toHaveLength(2);
    expect(within(rowOf("Tài sản c")).queryByRole("button", { name: "Khai kết quả" })).toBeNull();
    expect(within(rowOf("Tài sản d")).queryByRole("button", { name: "Khai kết quả" })).toBeNull();

    fireEvent.click(within(rowOf("Tài sản b")).getByRole("button", { name: "Khai kết quả" }));
    expect(onReportOutcome).toHaveBeenCalledWith(claims[1]);
  });

  it("hides the button without write access or without the handler", () => {
    const { unmount } = renderTable({ onReportOutcome: vi.fn(), canWriteClaim: () => false });
    expect(screen.queryByRole("button", { name: "Khai kết quả" })).toBeNull();
    unmount();
    renderTable();
    expect(screen.queryByRole("button", { name: "Khai kết quả" })).toBeNull();
  });
});
