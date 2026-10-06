import type { ExpressionSpecification, FilterSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Bản đồ nền dùng chung cho mọi bản đồ trên sàn (MapLibre + OpenFreeMap, không cần API key).
 *
 * Bản đồ Việt Nam hiển thị trên sàn BẮT BUỘC thể hiện Hoàng Sa, Trường Sa thuộc Việt Nam.
 * Dữ liệu OSM gốc lại gắn nhãn Trung Quốc/Philippines lên hai quần đảo (三沙市, 西沙区,
 * 南沙区, Kalayaan…) và ghi "South China Sea 南海" ⇒ `localizeStyle` (1) ẩn MỌI nhãn nền
 * nằm trong vùng hai quần đảo, (2) ưu tiên tên tiếng Việt (`name:vi` — Biển Đông), rồi
 * component tự vẽ nhãn chủ quyền `ISLAND_LABELS`.
 */
export const VIETNAM_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** [lng, lat] — vùng phủ hai quần đảo. Cạnh đông Trường Sa chừa Balabac/Palawan, Sabah. */
export const ISLAND_AREAS = {
  type: "MultiPolygon" as const,
  coordinates: [
    // Hoàng Sa (dưới mũi nam đảo Hải Nam ~18.1°N)
    [[[110.5, 15.2], [113.4, 15.2], [113.4, 17.5], [110.5, 17.5], [110.5, 15.2]]],
    // Trường Sa
    [[[110.8, 6.0], [114.5, 6.0], [116.4, 7.6], [116.9, 11.0], [115.8, 12.2], [111.0, 12.2], [110.8, 6.0]]],
  ],
};

// Nhãn neo ở mép TRÁI rồi chạy sang phía đông ⇒ không đè ghim các làng ven biển miền Trung.
export const ISLAND_LABELS: { name: string; lng: number; lat: number }[] = [
  { name: "Quần đảo Hoàng Sa (Việt Nam)", lng: 111.2, lat: 16.5 },
  { name: "Quần đảo Trường Sa (Việt Nam)", lng: 113.2, lat: 10.0 },
];

/** Khung nhìn mặc định: đất liền + hai quần đảo — [[tây, nam], [đông, bắc]]. */
export const VN_VIEW_BOUNDS: [[number, number], [number, number]] = [[102.1, 8.2], [117.4, 23.4]];
/** Giới hạn kéo bản đồ — [tây, nam, đông, bắc]. */
export const VN_MAX_BOUNDS: [number, number, number, number] = [90, -2, 130, 30];

const OUTSIDE_ISLANDS = ["!", ["within", ISLAND_AREAS]] as unknown as ExpressionSpecification;

/** Trả về bản sao style đã bản địa hoá; không sửa object đầu vào. */
export function localizeStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== "symbol" || !("source" in layer) || layer.source !== "openmaptiles") return layer;
      const textField = layer.layout?.["text-field"];
      const named = Array.isArray(textField) && JSON.stringify(textField).includes('"name');
      return {
        ...layer,
        filter: (layer.filter ? ["all", layer.filter, OUTSIDE_ISLANDS] : OUTSIDE_ISLANDS) as FilterSpecification,
        layout: named
          ? { ...layer.layout, "text-field": ["coalesce", ["get", "name:vi"], textField] as ExpressionSpecification }
          : layer.layout,
      };
    }),
  };
}

export async function fetchVietnamMapStyle(): Promise<StyleSpecification> {
  const res = await fetch(VIETNAM_MAP_STYLE_URL);
  if (!res.ok) throw new Error(`Không tải được kiểu bản đồ (${res.status})`);
  return localizeStyle((await res.json()) as StyleSpecification);
}
