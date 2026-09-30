import { useEffect, useRef } from "react";
import L from "leaflet";
import { villageLabel, type PublicCraftVillage } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";
import { createVietnamMap, escapeHtml } from "./vietnamMap";

interface CraftVillageMapProps {
  villages: PublicCraftVillage[];
  selectedId: string | null;
  onSelect: (village: PublicCraftVillage) => void;
  className?: string;
}

function pinHtml(v: PublicCraftVillage, selected: boolean): string {
  const img = v.image_urls[0];
  const ring = selected ? "ring-4 ring-accent" : "ring-2 ring-primary/40";
  const inner = img
    ? `<img src="${escapeHtml(img)}" alt="" class="h-full w-full object-cover" loading="lazy" />`
    : `<span class="grid h-full w-full place-items-center bg-primary text-base font-bold text-primary-foreground">${escapeHtml(
        (v.product || villageLabel(v)).charAt(0).toUpperCase(),
      )}</span>`;
  return `<span aria-label="${escapeHtml(villageLabel(v))}" class="block h-12 w-12 overflow-hidden rounded-full border-[3px] border-white bg-muted shadow-lg transition-transform duration-150 hover:scale-110 ${ring}">${inner}</span>`;
}

const PIN = 48;
const pinIcon = (v: PublicCraftVillage, selected: boolean) =>
  L.divIcon({ className: "", html: pinHtml(v, selected), iconSize: [PIN, PIN], iconAnchor: [PIN / 2, PIN / 2] });

interface PinEntry {
  marker: L.Marker;
  village: PublicCraftVillage;
  /** Toạ độ thật — vị trí vẽ có thể lệch khi nhiều làng chồng nhau ở mức zoom hiện tại. */
  home: L.LatLng;
}

/**
 * Các làng gần nhau (Hà Nội, Hội An…) chồng lên nhau ở mức zoom cả nước ⇒ chỉ bấm được ảnh
 * trên cùng. Gom ghim cách nhau < 1 ảnh thành nhóm và xếp vòng quanh tâm nhóm; zoom gần thì
 * nhóm tách ra và ghim về đúng toạ độ.
 */
function spreadOverlapping(map: L.Map, entries: PinEntry[]) {
  const pts = entries.map((e) => ({ e, p: map.latLngToLayerPoint(e.home) }));
  const groups: (typeof pts)[] = [];
  for (const it of pts) {
    const g = groups.find((grp) => grp.some((o) => o.p.distanceTo(it.p) < PIN * 0.85));
    if (g) g.push(it);
    else groups.push([it]);
  }
  for (const g of groups) {
    if (g.length === 1) {
      g[0].e.marker.setLatLng(g[0].e.home);
      continue;
    }
    const cx = g.reduce((s, it) => s + it.p.x, 0) / g.length;
    const cy = g.reduce((s, it) => s + it.p.y, 0) / g.length;
    const r = Math.max(PIN * 0.7, ((PIN + 6) * g.length) / (2 * Math.PI));
    g.forEach((it, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / g.length;
      it.e.marker.setLatLng(map.layerPointToLatLng(L.point(cx + r * Math.cos(a), cy + r * Math.sin(a))));
    });
  }
}

/** Bản đồ Việt Nam; mỗi hồ sơ làng nghề là một ảnh sản phẩm tròn — bấm để mở VR tour. */
export function CraftVillageMap({ villages, selectedId, onSelect, className }: CraftVillageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, PinEntry>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createVietnamMap(containerRef.current);
    mapRef.current = map;
    const markers = markersRef.current;
    map.on("zoomend", () => spreadOverlapping(map, [...markers.values()]));
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      fittedRef.current = false;
    };
  }, []);

  // Đồng bộ ghim theo danh sách (lọc tìm kiếm cũng đi qua đây).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = markersRef.current;
    const keep = new Set(villages.map((v) => v.posting_id));
    for (const [id, { marker }] of markers) {
      if (!keep.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
    for (const v of villages) {
      if (markers.has(v.posting_id)) continue;
      const home = L.latLng(Number(v.latitude), Number(v.longitude));
      const marker = L.marker(home, {
        icon: pinIcon(v, false),
        title: villageLabel(v),
        riseOnHover: true,
      })
        .bindTooltip(
          `<strong>${escapeHtml(villageLabel(v))}</strong><br/>${escapeHtml(
            [v.product, v.province].filter(Boolean).join(" · "),
          )}`,
          { direction: "top", offset: [0, -26] },
        )
        .on("click", () => onSelectRef.current(v))
        .addTo(map);
      markers.set(v.posting_id, { marker, village: v, home });
    }
    if (!fittedRef.current && villages.length > 0) {
      fittedRef.current = true;
      map.fitBounds(
        L.latLngBounds(villages.map((v) => [Number(v.latitude), Number(v.longitude)] as [number, number])),
        { padding: [48, 48], maxZoom: 7, animate: false },
      );
    }
    spreadOverlapping(map, [...markers.values()]);
  }, [villages]);

  // Làm nổi ghim đang chọn + đưa vào giữa khung.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, { marker, village }] of markersRef.current) {
      const selected = id === selectedId;
      marker.setIcon(pinIcon(village, selected));
      marker.setZIndexOffset(selected ? 1000 : 0);
      if (selected) map.panTo(marker.getLatLng());
    }
  }, [selectedId, villages]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border border-border bg-muted", className)}>
      <div ref={containerRef} className="relative z-0 h-full w-full" />
    </div>
  );
}
