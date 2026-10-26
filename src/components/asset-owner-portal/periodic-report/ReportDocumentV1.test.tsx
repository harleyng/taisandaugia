// Báo cáo định kỳ ĐÃ CHỐT ở payload v1 phải hiển thị Y NGUYÊN sau khi thêm phần
// "Thực hiện kế hoạch đấu giá" (payload v2, Phase 8 của docs/owner-auction-planning-plan.md).
//
// `__fixtures__/v1-final-payload.json` là payload THẬT, đóng băng trong
// owner_report_snapshots.payload của một báo cáo đã chốt (Trạm 4ca4be7b…, tháng 9/2026,
// toàn đơn vị) — chụp từ DB sống TRƯỚC khi sửa gì. Ảnh chụp dưới đây được tạo bằng mã
// TRƯỚC Phase 8; nếu bản v1 đổi một ký tự, test này đỏ.
//
// Luật: payload không có khoá `plan_execution` (mọi báo cáo chốt trước Phase 8) ⇒ phần
// mới KHÔNG được hiện, và số thứ tự 1–7 của các phần cũ không được xê dịch.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReportDocument } from "./ReportDocument";
import { mapReportPayload } from "@/lib/ownerPeriodicReport";
import v1Raw from "./__fixtures__/v1-final-payload.json";

describe("ReportDocument · payload v1 đã chốt", () => {
  const payload = mapReportPayload(v1Raw);

  it("đọc được payload v1 và không có phần kế hoạch", () => {
    expect(payload).not.toBeNull();
    expect(payload?.version).toBe(1);
    expect((v1Raw as Record<string, unknown>).plan_execution).toBeUndefined();
  });

  const renderDoc = () =>
    render(
      <MemoryRouter>
        <ReportDocument payload={payload!} status="final" variant="print" />
      </MemoryRouter>,
    );

  it("giữ nguyên 7 phần với đúng số thứ tự", () => {
    const { container } = renderDoc();
    const headings = Array.from(container.querySelectorAll("h2, h3")).map((h) => h.textContent?.trim());
    expect(headings).toContain("1. Tiến độ chỉ tiêu");
    expect(headings).toContain("2. Kết quả phiên trong kỳ");
    expect(headings).toContain("3. Tiền thu");
    expect(headings).toContain("4. Tài sản tồn đọng");
    expect(headings).toContain("5. Kế hoạch kỳ tới");
    expect(headings).toContain("6. Hiệu quả truyền thông");
    expect(headings).toContain("7. Ghi chú của cán bộ");
    expect(container.textContent).not.toContain("Thực hiện kế hoạch đấu giá");
  });

  it("hiển thị y nguyên như trước Phase 8", () => {
    const { container } = renderDoc();
    expect(container.textContent).toMatchSnapshot();
  });
});
