// "Thực hiện kế hoạch đấu giá" — phần của payload v2 (Phase 8 của
// docs/owner-auction-planning-plan.md).
//
// `__fixtures__/v2-plan-execution.json` là plan_execution THẬT, đóng băng trong một báo cáo
// đã chốt của Trạm demo tỉnh Bắc Ninh (năm 2026, toàn đơn vị) — 4 kế hoạch đã duyệt,
// 20 tài sản, 4 trễ · 4 nguy cơ trễ · 2 chờ đấu lại · 4 đã dời tháng.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReportPlanExecutionSection } from "./ReportPlanExecutionSection";
import { ReportSheet } from "./ReportSheet";
import { mapReportPayload, type ReportPayload } from "@/lib/ownerPeriodicReport";
import v1Raw from "./__fixtures__/v1-final-payload.json";
import planExecutionRaw from "./__fixtures__/v2-plan-execution.json";

function payloadWith(planExecution: unknown): ReportPayload {
  return mapReportPayload({ ...(v1Raw as object), version: 2, plan_execution: planExecution })!;
}

const renderSection = (payload: ReportPayload) =>
  render(
    <MemoryRouter>
      <ReportPlanExecutionSection payload={payload} variant="print" />
    </MemoryRouter>,
  );

describe("ReportPlanExecutionSection", () => {
  it("không hiện gì với payload v1 (báo cáo chốt trước Phase 8)", () => {
    const { container } = renderSection(mapReportPayload(v1Raw)!);
    expect(container).toBeEmptyDOMElement();
  });

  it("phạm vi chưa có kế hoạch duyệt ⇒ một dòng EmptyState, không lỗi", () => {
    const payload = payloadWith({
      as_of: "2026-10-26",
      period: { type: "month", start: "2026-09-01", end: "2026-09-30" },
      totals: { plans: 0, planned_count: 0, sold_count: 0, done_pct: null },
      plans: [],
    });
    renderSection(payload);
    expect(screen.getByText("Thực hiện kế hoạch đấu giá")).toBeInTheDocument();
    expect(
      screen.getByText("Phạm vi này chưa có kế hoạch đấu giá nào được duyệt cho năm của kỳ báo cáo."),
    ).toBeInTheDocument();
  });

  it("payload rỗng / sai kiểu cũng không làm vỡ phần này", () => {
    expect(payloadWith(null).planExecution).toBeNull();
    expect(payloadWith("hỏng").planExecution).toBeNull();
    expect(payloadWith([]).planExecution).toBeNull();
    const { container } = renderSection(payloadWith({}));
    expect(container.textContent).toContain("chưa có kế hoạch đấu giá nào được duyệt");
  });

  it("hiện tổng của kỳ, từng kế hoạch và tài sản trễ kèm lý do", () => {
    const payload = payloadWith(planExecutionRaw);
    const pe = payload.planExecution!;
    expect(pe.plans).toHaveLength(4);
    expect(pe.totals.plannedCount).toBe(19);
    expect(pe.totals.soldCount).toBe(4);
    expect(pe.totals.lateCount).toBe(4);
    expect(pe.totals.atRiskCount).toBe(4);

    const { container } = renderSection(payload);
    // L1: câu trả lời của phần
    expect(container.textContent).toContain("Đã đấu thành 4/19 tài sản theo kế hoạch");
    expect(container.textContent).toContain("4 tài sản trễ");
    // L3: ô chỉ số
    expect(screen.getByText("Tài sản theo kế hoạch")).toBeInTheDocument();
    expect(screen.getAllByText("Tỷ lệ hoàn thành").length).toBeGreaterThan(0);
    // L4: bảng từng kế hoạch + bảng tài sản cần chú ý
    expect(screen.getByText("Từng kế hoạch trong kỳ")).toBeInTheDocument();
    for (const plan of pe.plans) {
      expect(screen.getAllByText(plan.unitName!).length).toBeGreaterThan(0);
    }
    const attention = pe.plans.flatMap((p) => p.attention);
    expect(attention).toHaveLength(8);
    for (const item of attention) {
      expect(screen.getAllByText(item.title!).length).toBeGreaterThan(0);
    }
    // Mỗi tài sản trễ phải mang một lý do đọc được, không để trống.
    const overdue = attention.filter((i) => i.overdueStep);
    expect(overdue.length).toBeGreaterThan(0);
    for (const item of overdue) {
      expect(container.textContent).toContain(`Quá hạn mốc "`);
    }
    // Bảng dời tháng dự kiến
    expect(screen.getByText(/Tài sản đã dời tháng dự kiến/)).toBeInTheDocument();
  });

  it("không bao giờ in ra id, người phụ trách hay link tài liệu", () => {
    const { container } = renderSection(payloadWith(planExecutionRaw));
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(text).not.toMatch(/https?:\/\//);
  });

  // Trang in /chu-tai-san/bao-cao-dinh-ky/:id/in và link chia sẻ /r/:token dùng CHUNG ReportSheet.
  it("có mặt trên tờ A4 của trang in khi payload là v2, và vắng khi là v1", () => {
    const v2 = render(
      <MemoryRouter>
        <ReportSheet payload={payloadWith(planExecutionRaw)} status="final" variant="print" footerNote="in ngày 26/10/2026" />
      </MemoryRouter>,
    );
    expect(v2.container.textContent).toContain("Thực hiện kế hoạch đấu giá");
    expect(v2.container.textContent).toContain("Đã đấu thành 4/19 tài sản theo kế hoạch");
    v2.unmount();

    const v1 = render(
      <MemoryRouter>
        <ReportSheet payload={mapReportPayload(v1Raw)!} status="final" variant="print" footerNote="in ngày 26/10/2026" />
      </MemoryRouter>,
    );
    expect(v1.container.textContent).not.toContain("Thực hiện kế hoạch đấu giá");
  });
});
