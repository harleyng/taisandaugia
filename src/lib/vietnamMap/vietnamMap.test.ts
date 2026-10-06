import { describe, expect, it } from "vitest";
import type { StyleSpecification } from "maplibre-gl";
import { ISLAND_AREAS, localizeStyle } from ".";

const NAME = ["coalesce", ["get", "name_en"], ["get", "name"]];

const style = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "x" } },
  layers: [
    { id: "bg", type: "background" },
    { id: "label_city", type: "symbol", source: "openmaptiles", "source-layer": "place",
      filter: ["==", ["get", "class"], "city"], layout: { "text-field": NAME } },
    { id: "label_other", type: "symbol", source: "openmaptiles", "source-layer": "place",
      layout: { "text-field": NAME } },
    { id: "shield", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
      layout: { "text-field": ["to-string", ["get", "ref"]] } },
    { id: "boundary_2", type: "line", source: "openmaptiles", "source-layer": "boundary" },
  ],
} as unknown as StyleSpecification;

type AnyLayer = { filter?: unknown; layout: Record<string, unknown> };
const layer = (s: StyleSpecification, id: string) => s.layers.find((l) => l.id === id) as unknown as AnyLayer;
const outside = ["!", ["within", ISLAND_AREAS]];

describe("localizeStyle", () => {
  const out = localizeStyle(style);

  it("ẩn nhãn nền trong vùng Hoàng Sa, Trường Sa — giữ filter gốc", () => {
    expect(layer(out, "label_city").filter).toEqual(["all", ["==", ["get", "class"], "city"], outside]);
    expect(layer(out, "label_other").filter).toEqual(outside);
    expect(layer(out, "shield").filter).toEqual(outside);
  });

  it("ưu tiên tên tiếng Việt cho nhãn tên, không đụng biển số đường", () => {
    expect(layer(out, "label_city").layout["text-field"]).toEqual(["coalesce", ["get", "name:vi"], NAME]);
    expect(layer(out, "shield").layout["text-field"]).toEqual(["to-string", ["get", "ref"]]);
  });

  it("bỏ qua lớp không phải nhãn và không sửa style gốc", () => {
    expect(layer(out, "boundary_2")).toBe(layer(style, "boundary_2"));
    expect(layer(out, "bg")).toBe(layer(style, "bg"));
    expect(layer(style, "label_other").filter).toBeUndefined();
  });

  it("vùng phủ chứa cả hai quần đảo nhưng chừa Palawan (Balabac)", () => {
    const inside = (lng: number, lat: number) =>
      ISLAND_AREAS.coordinates.some(([ring]) => {
        let hit = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
        }
        return hit;
      });
    expect(inside(112.33, 16.83)).toBe(true); // Phú Lâm / "三沙市"
    expect(inside(112.89, 9.55)).toBe(true); // "南沙区"
    expect(inside(114.28, 11.05)).toBe(true); // "Kalayaan"
    expect(inside(111.92, 8.64)).toBe(true); // Trường Sa
    expect(inside(117.06, 7.99)).toBe(false); // Balabac (PH)
    expect(inside(109.19, 12.25)).toBe(false); // Nha Trang
    expect(inside(115, 15)).toBe(false); // nhãn Biển Đông
  });
});
