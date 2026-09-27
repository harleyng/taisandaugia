import { describe, expect, it } from "vitest";
import {
  digitizeNextLine,
  digitizeStatusOf,
  matchesDigitizeFilter,
  type DigitizeFacts,
} from "./digitizeStatus";

const facts = (over: Partial<DigitizeFacts> = {}): DigitizeFacts => ({
  postingStatus: "active",
  reviewStatus: "approved",
  requestStatuses: [],
  brokerStatus: null,
  contractStatuses: [],
  ownerAction: null,
  ...over,
});

const ctx = { pct: 60, sentCount: 3, quotedCount: 2, orgName: "Công ty ĐGHD Lạc Việt" };

describe("digitizeStatusOf", () => {
  it("nháp và đã huỷ đứng trước mọi thứ", () => {
    expect(digitizeStatusOf(facts({ postingStatus: "draft" }))).toMatchObject({
      stage: "draft",
      label: "Nháp",
      step: 0,
      who: "owner",
      tone: "draft",
    });
    expect(digitizeStatusOf(facts({ postingStatus: "cancelled", requestStatuses: ["quoted"] }))).toMatchObject({
      stage: "cancelled",
      who: null,
    });
  });

  it("chờ duyệt là việc của sàn, bị trả lại là việc của chủ tài sản", () => {
    expect(digitizeStatusOf(facts({ reviewStatus: "pending" }))).toMatchObject({
      stage: "review",
      step: 1,
      who: "platform",
      tone: "wait",
    });
    // Bị trả lại chặn cả khi đã có yêu cầu gửi đi trước lần sửa.
    expect(digitizeStatusOf(facts({ reviewStatus: "rejected", requestStatuses: ["quoted"] }))).toMatchObject({
      stage: "rejected",
      step: 1,
      who: "owner",
      tone: "err",
    });
  });

  it("đã duyệt chưa gửi ⇒ Sẵn sàng gửi; mọi tổ chức từ chối ⇒ Cần gửi thêm", () => {
    expect(digitizeStatusOf(facts())).toMatchObject({ stage: "ready", step: 2, who: "owner", tone: "me" });
    expect(digitizeStatusOf(facts({ requestStatuses: ["declined", "withdrawn"] }))).toMatchObject({
      stage: "resend",
      who: "owner",
    });
  });

  it("chờ báo giá: còn tổ chức chưa trả lời ⇒ chờ tổ chức; chỉ nhờ sàn ⇒ chờ sàn", () => {
    expect(digitizeStatusOf(facts({ requestStatuses: ["sent", "declined"] }))).toMatchObject({
      stage: "quoting",
      who: "org",
      tone: "wait",
    });
    expect(digitizeStatusOf(facts({ brokerStatus: "sourcing" }))).toMatchObject({ stage: "quoting", who: "platform" });
  });

  it("có báo giá ⇒ việc của bạn", () => {
    expect(digitizeStatusOf(facts({ requestStatuses: ["quoted", "sent"], ownerAction: "choose_quote" }))).toMatchObject({
      stage: "choose",
      who: "owner",
      tone: "me",
    });
  });

  it("hợp đồng: người phải làm theo owner_action của RPC", () => {
    const drafting = facts({ requestStatuses: ["selected"], contractStatuses: ["drafting"] });
    expect(digitizeStatusOf(drafting)).toMatchObject({ stage: "contract", step: 3, who: "org", tone: "wait" });
    expect(digitizeStatusOf({ ...drafting, ownerAction: "confirm_contract" })).toMatchObject({
      stage: "contract",
      who: "owner",
      tone: "me",
    });
    expect(digitizeStatusOf({ ...drafting, ownerAction: "add_address" })).toMatchObject({ who: "owner" });
    // Dữ liệu cũ: chốt mà chưa có hợp đồng trên sàn.
    expect(digitizeStatusOf(facts({ postingStatus: "matched" }))).toMatchObject({ stage: "contract" });
  });

  it("hợp đồng đã ký ⇒ xong cả 4 bước", () => {
    expect(
      digitizeStatusOf(facts({ requestStatuses: ["selected"], contractStatuses: ["cancelled", "signed"] })),
    ).toMatchObject({ stage: "signed", step: 4, who: null, tone: "ok" });
  });
});

describe("digitizeNextLine", () => {
  it("điền số liệu vào câu bước tiếp theo", () => {
    expect(digitizeNextLine(digitizeStatusOf(facts({ postingStatus: "draft" })), ctx)).toBe(
      "Hoàn thiện 60% · tiếp tục số hoá",
    );
    expect(digitizeNextLine(digitizeStatusOf(facts({ requestStatuses: ["sent"] })), ctx)).toBe(
      "Đã gửi 3 tổ chức, đang chờ báo giá",
    );
    expect(digitizeNextLine(digitizeStatusOf(facts({ requestStatuses: ["quoted"] })), ctx)).toBe(
      "Chọn 1 trong 2 báo giá",
    );
    const confirm = digitizeStatusOf(
      facts({ requestStatuses: ["selected"], contractStatuses: ["awaiting_confirmation"], ownerAction: "confirm_contract" }),
    );
    expect(digitizeNextLine(confirm, ctx)).toBe("Xác nhận hợp đồng với Công ty ĐGHD Lạc Việt");
    expect(digitizeNextLine(digitizeStatusOf(facts({ postingStatus: "contracted" })), { ...ctx, orgName: null })).toBe(
      "Đã ký gửi cho tổ chức đấu giá",
    );
  });
});

describe("matchesDigitizeFilter", () => {
  const of = (over: Partial<DigitizeFacts>) => digitizeStatusOf(facts(over));

  it("Cần bạn xử lý = mọi hồ sơ mà việc tiếp theo là của chủ tài sản", () => {
    expect(matchesDigitizeFilter("can-xu-ly", of({ postingStatus: "draft" }))).toBe(true);
    expect(matchesDigitizeFilter("can-xu-ly", of({ reviewStatus: "rejected" }))).toBe(true);
    expect(matchesDigitizeFilter("can-xu-ly", of({ reviewStatus: "pending" }))).toBe(false);
    expect(matchesDigitizeFilter("can-xu-ly", of({ requestStatuses: ["sent"] }))).toBe(false);
  });

  it("nhóm theo giai đoạn; hồ sơ đã huỷ chỉ nằm ở Tất cả", () => {
    expect(matchesDigitizeFilter("dang-so-hoa", of({ reviewStatus: "pending" }))).toBe(true);
    expect(matchesDigitizeFilter("dang-ky-gui", of({ requestStatuses: ["quoted"] }))).toBe(true);
    expect(matchesDigitizeFilter("da-ky", of({ contractStatuses: ["signed"] }))).toBe(true);
    const cancelled = of({ postingStatus: "cancelled" });
    expect(["dang-so-hoa", "dang-ky-gui", "da-ky", "can-xu-ly"].some((k) =>
      matchesDigitizeFilter(k as never, cancelled),
    )).toBe(false);
    expect(matchesDigitizeFilter("tat-ca", cancelled)).toBe(true);
  });
});
