import { describe, expect, it } from "vitest";
import {
  axisTickIndexes,
  buildDeliverables,
  chartCeiling,
  deltaOf,
  impactMetrics,
  isInWindow,
  parseOrderImpact,
  parsePostMetrics,
  rateText,
  windowDays,
  type OrderResultsPayload,
} from "./orderReport";

const NOW = new Date("2026-10-04T10:00:00+07:00").getTime();

type Order = Parameters<typeof buildDeliverables>[0];
const order = (over: Partial<Order> = {}): Order => ({
  variant_key: "mkt_banner_owner",
  status: "in_progress",
  post_url: null,
  post_metrics: null,
  completed_at: null,
  ...over,
});

const results = (over: Partial<OrderResultsPayload> = {}): OrderResultsPayload => ({
  campaign: null,
  advertisement: null,
  featured: null,
  post_url: null,
  ...over,
});

const RAW_IMPACT = {
  window: { from: "2026-09-27T02:00:00+00:00", to: "2026-10-04T03:00:00+00:00", running: true },
  baseline: { from: "2026-09-20T01:00:00+00:00", to: "2026-09-27T02:00:00+00:00" },
  current: { views: 120, visitors: 80, saves: 6, registrations: 2 },
  previous: { views: 40, visitors: 40, saves: 0, registrations: 0 },
  daily: [
    { day: "2026-09-26", views: 4 },
    { day: "2026-09-27", views: 15 },
  ],
};

describe("tác động lên tài sản", () => {
  it("đọc JSON của owner_mkt_order_impact; null khi chưa nhận việc", () => {
    expect(parseOrderImpact(null)).toBeNull();
    expect(parseOrderImpact({})).toBeNull();
    const i = parseOrderImpact(RAW_IMPACT)!;
    expect(i.window.running).toBe(true);
    expect(i.current.views).toBe(120);
    expect(i.daily[1]).toEqual({ day: "2026-09-27", views: 15 });
  });

  it("mức thay đổi so với khoảng trước", () => {
    expect(deltaOf(120, 40)).toEqual({ text: "+200%", direction: "up" });
    expect(deltaOf(30, 40)).toEqual({ text: "−25%", direction: "down" });
    expect(deltaOf(5, 0)).toEqual({ text: "Mới", direction: "up" });
    expect(deltaOf(0, 0)).toEqual({ text: null, direction: "flat" });
    expect(deltaOf(40, 40).text).toBe("Không đổi");
  });

  it("4 chỉ số theo thứ tự xem → người xem → lưu → đăng ký", () => {
    const m = impactMetrics(parseOrderImpact(RAW_IMPACT)!);
    expect(m.map((x) => x.key)).toEqual(["views", "visitors", "saves", "registrations"]);
    expect(m[2].delta.text).toBe("Mới");
  });

  it("số ngày chạy và ngày trong khoảng chạy theo giờ Việt Nam", () => {
    const i = parseOrderImpact(RAW_IMPACT)!;
    expect(windowDays(i)).toBe(8);
    expect(isInWindow("2026-09-26", i)).toBe(false);
    expect(isInWindow("2026-09-27", i)).toBe(true);
    expect(isInWindow("2026-10-04", i)).toBe(true);
  });

  it("tỷ lệ một chữ số thập phân, mẫu 0 ⇒ gạch", () => {
    expect(rateText(96, 4820)).toBe("2.0%");
    expect(rateText(1, 0)).toBe("—");
  });
});

describe("sàn đã làm gì", () => {
  it("banner đang chạy kèm số hiển thị / bấm (tỷ lệ bấm đi kèm lượt bấm)", () => {
    const d = buildDeliverables(
      order(),
      results({
        advertisement: { name: "B", status: "active", start_at: null, end_at: "2026-10-11T00:00:00Z", views: 2140, clicks: 37 },
      }),
      NOW,
    );
    expect(d).toHaveLength(1);
    expect(d[0].state).toBe("running");
    expect(d[0].figures).toEqual([
      { label: "Hiển thị", value: "2,140" },
      { label: "Lượt bấm", value: "37", hint: "1.7%" },
    ]);
  });

  it("gói hứa banner mà chưa gắn ⇒ dòng đang chuẩn bị; hoàn tất thì không", () => {
    expect(buildDeliverables(order(), results(), NOW)[0]).toMatchObject({ kind: "banner", state: "pending" });
    expect(buildDeliverables(order({ status: "completed" }), results(), NOW)).toEqual([]);
  });

  it("bài đăng: link + số do sàn nhập; chưa nhập thì nhắc", () => {
    const withMetrics = buildDeliverables(
      order({
        variant_key: "mkt_social_owner",
        status: "completed",
        post_url: "https://fb.com/p",
        post_metrics: { reach: 12400, engagements: 318, clicks: 41 },
      }),
      results({ post_url: "https://fb.com/p" }),
      NOW,
    );
    expect(withMetrics[0]).toMatchObject({ kind: "post", url: "https://fb.com/p", emptyText: null });
    expect(withMetrics[0].figures[1]).toEqual({ label: "Tương tác", value: "318", hint: "2.6%" });

    const noMetrics = buildDeliverables(
      order({ variant_key: "mkt_social_owner", post_url: "https://fb.com/p" }),
      results(),
      NOW,
    );
    expect(noMetrics[0].figures).toEqual([]);
    expect(noMetrics[0].emptyText).toMatch(/cập nhật/);
    expect(parsePostMetrics(null)).toBeNull();
  });

  it("tin nổi bật: đang chạy khi còn hạn", () => {
    const d = buildDeliverables(
      order({ variant_key: "mkt_featured_owner" }),
      results({ featured: { from: "2026-10-02T02:00:00Z", until: "2026-10-09T02:00:00Z", active: true } }),
      NOW,
    );
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "featured", state: "running" });

    const ended = buildDeliverables(
      order({ variant_key: "mkt_featured_owner", status: "completed" }),
      results({ featured: { from: "2026-09-21T02:00:00Z", until: "2026-09-28T02:00:00Z", active: false } }),
      NOW,
    );
    expect(ended[0]).toMatchObject({ state: "done", emptyText: "Đã chạy đủ 7 ngày" });
  });
});

describe("trục biểu đồ lượt xem", () => {
  it("đỉnh trục tròn và chia đôi được", () => {
    expect(chartCeiling(162)).toBe(200);
    expect(chartCeiling(55)).toBe(60);
    expect(chartCeiling(3)).toBe(4);
    expect(chartCeiling(0)).toBe(2);
  });

  it("nhãn trục hoành trải đều, có đầu và cuối", () => {
    expect(axisTickIndexes(28)).toEqual([0, 7, 14, 20, 27]);
    expect(axisTickIndexes(3)).toEqual([0, 1, 2]);
  });
});
