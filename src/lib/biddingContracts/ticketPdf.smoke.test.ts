// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ticketChecklist, ticketInfoOf } from "./attendanceTicket";
import { ticketPdfBlob } from "./ticketPdf";

describe("ticketPdf", () => {
  it("dựng được PDF phiếu dự phiên có QR và chữ tiếng Việt", async () => {
    const t = ticketInfoOf(
      {
        code: "HS131-007",
        checkin_token: "0f8c2b9e-1111-4000-8000-000000000001",
        full_name: "Nguyễn Văn An",
        org_name: null,
        has_proxy: false,
        proxy_full_name: null,
        checked_in_at: null,
        checkin_attendee: null,
        bidder_no: null,
      },
      { code: "PDG000131", title: "Đấu giá quyền sử dụng đất", venue: "Hội trường tầng 3", starts_at: "2026-10-22T02:00:00Z" },
      [1, 2],
    );
    const blob = await ticketPdfBlob(t, ticketChecklist(new Date("2026-10-22T02:15:00Z")));
    expect(blob.size).toBeGreaterThan(5_000);
  }, 30_000);
});
