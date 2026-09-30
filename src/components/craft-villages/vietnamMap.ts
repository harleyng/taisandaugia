import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { VN_BOUNDS } from "@/lib/craftVillages";

/**
 * Bản đồ Việt Nam dùng chung (bản đồ làng nghề công khai + ô chọn vị trí của chủ tài sản).
 * Luôn ghi nhãn chủ quyền cho Hoàng Sa, Trường Sa — bản đồ Việt Nam hiển thị trên sàn
 * BẮT BUỘC có hai quần đảo này.
 */
// Nhãn neo ở mép TRÁI rồi chạy sang phía đông ⇒ không đè ghim các làng ven biển miền Trung.
const ISLANDS: { name: string; at: [number, number] }[] = [
  { name: "Quần đảo Hoàng Sa (Việt Nam)", at: [16.5, 111.2] },
  { name: "Quần đảo Trường Sa (Việt Nam)", at: [10.0, 113.2] },
];

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function createVietnamMap(container: HTMLElement, options: L.MapOptions = {}): L.Map {
  const map = L.map(container, {
    scrollWheelZoom: false, // bật sau cú nhấp đầu tiên — tránh cướp cuộn trang
    minZoom: 4,
    maxBounds: L.latLngBounds([[-2, 90], [30, 130]]),
    ...options,
  });
  map.fitBounds(VN_BOUNDS);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  for (const island of ISLANDS) {
    L.marker(island.at, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "",
        iconSize: [176, 20],
        iconAnchor: [0, 10],
        html: `<span class="block whitespace-nowrap text-[11px] font-semibold italic text-primary [text-shadow:0_0_3px_#fff,0_0_3px_#fff]">${escapeHtml(island.name)}</span>`,
      }),
    }).addTo(map);
  }

  map.once("click", () => map.scrollWheelZoom.enable());
  return map;
}
