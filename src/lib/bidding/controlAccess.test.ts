import { describe, expect, it } from "vitest";
import {
  controlGateOf,
  DEFAULT_DURATION_MINUTES,
  isDurationClamped,
  isValidDurationMinutes,
  lotActionsFor,
  operateWindowOf,
  previewLotEndsAt,
  type ControlGateSession,
  type OperateWindow,
  type OperateWindowSession,
} from "./controlAccess";
import type { LotState } from "@/types/auction-bidding";

const NOW = new Date("2026-10-01T10:00:00Z");

const session = (patch: Partial<ControlGateSession> = {}): ControlGateSession => ({
  status: "published",
  auction_format: "ca_hai",
  ...patch,
});

const windowSession = (patch: Partial<OperateWindowSession> = {}): OperateWindowSession => ({
  starts_at: "2026-09-01T00:00:00Z",
  ends_at: "2026-12-31T00:00:00Z",
  finalized_at: null,
  ...patch,
});

const lotState = (patch: Partial<LotState> = {}): LotState =>
  ({
    lot_id: "lot-1",
    session_id: "sess-1",
    status: "open",
    ends_at: "2026-10-01T11:00:00Z",
    extension_count: 0,
    bid_count: 0,
    ...patch,
  }) as LotState;

const LIVE: OperateWindow = { reason: null };

describe("controlGateOf", () => {
  it("phiên trực tuyến đã công bố thì vào được", () => {
    expect(controlGateOf({ loading: false, session: session() })).toEqual({ kind: "ready" });
  });

  it("hình thức trực tuyến thuần cũng vào được", () => {
    expect(controlGateOf({ loading: false, session: session({ auction_format: "truc_tuyen" }) })).toEqual({
      kind: "ready",
    });
  });

  it("đang tải thì chưa kết luận", () => {
    expect(controlGateOf({ loading: true, session: null })).toEqual({ kind: "loading" });
  });

  it("không có phiên thì không tìm thấy", () => {
    expect(controlGateOf({ loading: false, session: null })).toEqual({ kind: "not_found" });
  });

  it("phiên nháp thì chưa có gì để điều hành", () => {
    expect(controlGateOf({ loading: false, session: session({ status: "draft" }) })).toEqual({ kind: "draft" });
  });

  it("phiên đã huỷ", () => {
    expect(controlGateOf({ loading: false, session: session({ status: "cancelled" }) })).toEqual({
      kind: "cancelled",
    });
  });

  it("phiên trực tiếp thì không có phòng điều hành", () => {
    expect(controlGateOf({ loading: false, session: session({ auction_format: "truc_tiep" }) })).toEqual({
      kind: "not_online",
    });
  });

  it("phiên trực tiếp ĐÃ HUỶ nói 'đã huỷ', không nói 'không trực tuyến'", () => {
    expect(
      controlGateOf({ loading: false, session: session({ status: "cancelled", auction_format: "truc_tiep" }) }),
    ).toEqual({ kind: "cancelled" });
  });
});

describe("operateWindowOf", () => {
  it("trong giờ phiên thì không chặn", () => {
    expect(operateWindowOf(windowSession(), NOW)).toEqual({ reason: null });
  });

  it("trước giờ bắt đầu", () => {
    expect(operateWindowOf(windowSession({ starts_at: "2026-11-01T00:00:00Z" }), NOW)).toEqual({
      reason: "not_started",
    });
  });

  it("sau giờ kết thúc", () => {
    expect(operateWindowOf(windowSession({ ends_at: "2026-09-30T00:00:00Z" }), NOW)).toEqual({ reason: "ended" });
  });

  it("đã chốt kết quả thắng cả 'đã kết thúc'", () => {
    expect(
      operateWindowOf(
        windowSession({ ends_at: "2026-09-30T00:00:00Z", finalized_at: "2026-09-30T01:00:00Z" }),
        NOW,
      ),
    ).toEqual({ reason: "finalized" });
  });
});

describe("lotActionsFor", () => {
  it("không có quyền điều hành thì tắt hết", () => {
    const a = lotActionsFor(null, NOW, { canOperate: false, window: LIVE });
    expect([a.open.enabled, a.pause.enabled, a.resume.enabled, a.withdraw.enabled]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(a.open.disabledReason).toMatch(/không có quyền/i);
  });

  it("lô chưa mở: mở được và rút được, không dừng/tiếp được", () => {
    const a = lotActionsFor(null, NOW, { canOperate: true, window: LIVE });
    expect(a.open.enabled).toBe(true);
    expect(a.withdraw.enabled).toBe(true);
    expect(a.pause.enabled).toBe(false);
    expect(a.resume.enabled).toBe(false);
  });

  it("lô đang mở: dừng được và rút được, không mở lại được", () => {
    const a = lotActionsFor(lotState(), NOW, { canOperate: true, window: LIVE });
    expect(a.pause.enabled).toBe(true);
    expect(a.withdraw.enabled).toBe(true);
    expect(a.open.enabled).toBe(false);
    expect(a.resume.enabled).toBe(false);
  });

  it("lô đã gia hạn vẫn là đang mở", () => {
    const a = lotActionsFor(lotState({ extension_count: 2 }), NOW, { canOperate: true, window: LIVE });
    expect(a.pause.enabled).toBe(true);
  });

  it("dòng vẫn ghi 'open' nhưng đã quá ends_at ⇒ coi như đã đóng, tắt hết", () => {
    const expired = lotState({ ends_at: "2026-10-01T09:00:00Z" });
    const a = lotActionsFor(expired, NOW, { canOperate: true, window: LIVE });
    expect(a.pause.enabled).toBe(false);
    expect(a.pause.disabledReason).toMatch(/đã đóng/i);
    expect(a.withdraw.enabled).toBe(false);
  });

  it("lô tạm dừng: tiếp tục được và rút được, KHÔNG dừng tiếp được", () => {
    const a = lotActionsFor(lotState({ status: "paused", paused_at: NOW.toISOString() } as Partial<LotState>), NOW, {
      canOperate: true,
      window: LIVE,
    });
    expect(a.resume.enabled).toBe(true);
    expect(a.withdraw.enabled).toBe(true);
    expect(a.pause.enabled).toBe(false);
  });

  it("lô đã đóng / đã rút thì không còn thao tác nào", () => {
    for (const status of ["closed", "withdrawn"] as const) {
      const a = lotActionsFor(lotState({ status }), NOW, { canOperate: true, window: LIVE });
      expect([a.open.enabled, a.pause.enabled, a.resume.enabled, a.withdraw.enabled]).toEqual([
        false,
        false,
        false,
        false,
      ]);
    }
  });

  it("phiên chưa bắt đầu: không mở, không tiếp, không rút", () => {
    const a = lotActionsFor(null, NOW, { canOperate: true, window: { reason: "not_started" } });
    expect(a.open.enabled).toBe(false);
    expect(a.open.disabledReason).toMatch(/chưa bắt đầu/i);
    expect(a.withdraw.enabled).toBe(false);
  });

  it("phiên đã hết giờ vẫn TẠM DỪNG được lô còn đang mở", () => {
    const stillOpen = lotState({ ends_at: "2026-10-01T11:00:00Z" });
    const a = lotActionsFor(stillOpen, NOW, { canOperate: true, window: { reason: "ended" } });
    expect(a.pause.enabled).toBe(true);
    expect(a.open.enabled).toBe(false);
  });

  it("phiên đã chốt kết quả thì không mở lô mới", () => {
    const a = lotActionsFor(null, NOW, { canOperate: true, window: { reason: "finalized" } });
    expect(a.open.enabled).toBe(false);
    expect(a.open.disabledReason).toMatch(/chốt kết quả/i);
  });
});

describe("thời lượng mở lô", () => {
  it("mặc định nằm trong khoảng hợp lệ", () => {
    expect(isValidDurationMinutes(DEFAULT_DURATION_MINUTES)).toBe(true);
  });

  it("chặn dưới 1 phút và trên 24 giờ", () => {
    expect(isValidDurationMinutes(0)).toBe(false);
    expect(isValidDurationMinutes(1)).toBe(true);
    expect(isValidDurationMinutes(1440)).toBe(true);
    expect(isValidDurationMinutes(1441)).toBe(false);
  });

  it("chặn số lẻ và giá trị không phải số", () => {
    expect(isValidDurationMinutes(1.5)).toBe(false);
    expect(isValidDurationMinutes(Number.NaN)).toBe(false);
  });

  it("không chọn thời lượng ⇒ đóng theo giờ kết thúc phiên", () => {
    expect(previewLotEndsAt(NOW, null, "2026-12-31T00:00:00Z")).toBe("2026-12-31T00:00:00Z");
  });

  it("thời lượng ngắn hơn phần còn lại ⇒ now + thời lượng", () => {
    expect(previewLotEndsAt(NOW, 900, "2026-12-31T00:00:00Z")).toBe("2026-10-01T10:15:00.000Z");
  });

  it("thời lượng dài hơn phần còn lại ⇒ cắt về giờ kết thúc phiên", () => {
    expect(previewLotEndsAt(NOW, 86_400, "2026-10-01T10:30:00Z")).toBe("2026-10-01T10:30:00.000Z");
  });

  it("báo bị cắt ngắn đúng lúc, và không báo khi chọn 'đến hết phiên'", () => {
    expect(isDurationClamped(NOW, 86_400, "2026-10-01T10:30:00Z")).toBe(true);
    expect(isDurationClamped(NOW, 900, "2026-12-31T00:00:00Z")).toBe(false);
    expect(isDurationClamped(NOW, null, "2026-10-01T10:30:00Z")).toBe(false);
  });
});
