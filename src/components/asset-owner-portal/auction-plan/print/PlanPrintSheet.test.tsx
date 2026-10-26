import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PLAN_PRINT_COLUMNS, planPrintSource } from "@/lib/auctionPlan/print";
import type { AuctionPlan, AuctionPlanBaseline, AuctionPlanItem } from "@/lib/auctionPlan/types";
import { PlanPrintSheet } from "./PlanPrintSheet";

const plan = (over: Partial<AuctionPlan> = {}): AuctionPlan =>
  ({
    id: "p1",
    workspace_id: "w1",
    branch_id: "b1",
    admin_unit_code: "24127",
    cycle_id: null,
    plan_year: 2027,
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

const items: AuctionPlanItem[] = [1, 2, 3].map(
  (n) =>
    ({
      id: `i${n}`,
      plan_id: "p1",
      workspace_id: "w1",
      branch_id: "b1",
      admin_unit_code: "24127",
      seq: n,
      item_code: `KH27-00${n}`,
      asset_type: "land_use_right",
      title: `Lô LK${n}, khu dân cư Đồng Chùa`,
      lot_labels: `LK${n}-10`,
      lot_count: 1,
      map_sheet: "45",
      parcel_no: "123",
      location: "Giáp đường bê tông 5 m",
      area_m2: 120.5,
      land_use_code: "ONT",
      allocation_form: "giao_co_thu_tien",
      unit_start_price: 12_000_000,
      expected_start_value: 1_446_000_000,
      planned_month: "2027-06-01",
      planned_method: "truc_tiep_loi_noi",
      executing_unit: "Phòng Kinh tế",
      forecast_month: null,
      forecast_reason: null,
      responsible_user_id: null,
      asset_posting_id: null,
      listing_id: null,
      exec_status: "active",
      exec_note: null,
      created_by: null,
      created_at: "2026-10-26T00:00:00Z",
      updated_at: "2026-10-26T00:00:00Z",
    }) as AuctionPlanItem,
);

const baseline: AuctionPlanBaseline = {
  id: "b1",
  plan_id: "p1",
  workspace_id: "w1",
  branch_id: "b1",
  version: 1,
  approved_at: "2026-12-01T03:00:00Z",
  approved_by: null,
  approval_doc_no: "1234/QĐ-UBND",
  approval_doc_date: "2026-12-01",
  approval_doc_urls: [],
  payload: {
    plan: {
      id: "p1",
      plan_year: 2027,
      kind: "annual",
      level: "commune",
      title: null,
      admin_unit_code: "24127",
      branch_id: "b1",
      cycle_id: null,
      legal_basis: null,
    },
    items: items.map((i) => ({
      id: i.id,
      seq: i.seq,
      item_code: i.item_code,
      asset_type: i.asset_type,
      title: i.title,
      lot_labels: i.lot_labels,
      lot_count: i.lot_count,
      map_sheet: i.map_sheet,
      parcel_no: i.parcel_no,
      location: i.location,
      area_m2: i.area_m2,
      land_use_code: i.land_use_code,
      allocation_form: i.allocation_form,
      unit_start_price: i.unit_start_price,
      expected_start_value: i.expected_start_value,
      planned_month: i.planned_month,
      planned_method: i.planned_method,
      executing_unit: i.executing_unit,
    })),
    totals: {
      item_count: 3,
      area_total: 361.5,
      expected_total: 4_338_000_000,
      by_month: {},
      by_quarter: {},
    },
    frozen_at: "2026-12-01T03:00:00Z",
  },
  created_at: "2026-12-01T03:00:00Z",
};

const renderSheet = (p: AuctionPlan, baselines: AuctionPlanBaseline[] = []) => {
  const source = planPrintSource(p, items, baselines);
  return render(
    <PlanPrintSheet
      plan={p}
      source={source}
      unitLabel="Xã Tân Dĩnh"
      adminUnitLabel="Xã Tân Dĩnh, Tỉnh Bắc Ninh"
      today="2026-12-05"
    />,
  );
};

describe("PlanPrintSheet", () => {
  it("in theo mẫu: Quốc hiệu, tên đơn vị, năm và bảy cột đúng thứ tự", () => {
    renderSheet(plan());
    expect(screen.getByText("Cộng hoà xã hội chủ nghĩa Việt Nam")).toBeInTheDocument();
    expect(screen.getByText("Độc lập – Tự do – Hạnh phúc")).toBeInTheDocument();
    expect(screen.getByText("Xã Tân Dĩnh, Tỉnh Bắc Ninh")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "DANH MỤC TÀI SẢN ĐẤU GIÁ QUYỀN SỬ DỤNG ĐẤT NĂM 2027" }),
    ).toBeInTheDocument();
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual([...PLAN_PRINT_COLUMNS]);
  });

  it("khối chữ ký ĐỂ TRỐNG — ứng dụng không ký (quyết định D5)", () => {
    const { container } = renderSheet(plan());
    expect(screen.getByText("Người lập biểu")).toBeInTheDocument();
    expect(screen.getByText("Thủ trưởng đơn vị")).toBeInTheDocument();
    expect(screen.getByText("(Ký, ghi rõ họ tên, đóng dấu)")).toBeInTheDocument();
    // Không có tên người nào được in sẵn vào chỗ ký.
    expect(container.querySelectorAll("div.h-20")).toHaveLength(2);
  });

  it("chưa duyệt ⇒ đóng dấu BẢN DỰ THẢO", () => {
    renderSheet(plan());
    expect(screen.getByText("Bản dự thảo — chưa được phê duyệt")).toBeInTheDocument();
    expect(screen.getByText(/nguồn: danh mục đang soạn/)).toBeInTheDocument();
  });

  it("đã duyệt ⇒ căn cứ quyết định + in theo bản mốc", () => {
    renderSheet(plan({ status: "approved", baseline_version: 1 }), [baseline]);
    expect(screen.getByText(/Kèm theo Quyết định số 1234\/QĐ-UBND/)).toBeInTheDocument();
    expect(screen.getAllByText(/ngày 1 tháng 12 năm 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/nguồn: bản mốc v1/)).toBeInTheDocument();
    expect(screen.queryByText("Bản dự thảo — chưa được phê duyệt")).not.toBeInTheDocument();
  });

  it("dòng tổng cộng: diện tích và giá trị khởi điểm nhóm nghìn bằng dấu phẩy", () => {
    renderSheet(plan());
    expect(screen.getByText("361.5")).toBeInTheDocument();
    expect(screen.getByText(/3 tài sản · giá trị khởi điểm dự kiến 4,338,000,000/)).toBeInTheDocument();
    expect(screen.getAllByText("12,000,000 ₫")).toHaveLength(3);
  });

  it("luật ngắt trang: A4 NGANG, mỗi dòng không bị cắt, tiêu đề bảng lặp mỗi trang", () => {
    const { container } = renderSheet(plan());
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("size: A4 landscape");
    expect(css).toContain("tr, td, th { page-break-inside: avoid; break-inside: avoid; }");
    expect(css).toContain("thead { display: table-header-group; }");
    // Mỗi dòng dữ liệu + dòng tổng cũng mang class Tailwind break-inside-avoid.
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.className).toContain("break-inside-avoid");
  });
});
