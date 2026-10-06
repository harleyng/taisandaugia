import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, type MapRef } from "@vis.gl/react-maplibre";
import Supercluster from "supercluster";
import { VietnamMap } from "@/components/map/VietnamMap";
import { villageLabel, type PublicCraftVillage } from "@/lib/craftVillages";
import { cn } from "@/lib/utils";

interface CraftVillageMapProps {
  villages: PublicCraftVillage[];
  selectedId: string | null;
  onSelect: (village: PublicCraftVillage) => void;
  className?: string;
}

type PointProps = { villageId: string };
type Index = Supercluster<PointProps>;
type View = { bbox: [number, number, number, number]; zoom: number };

/** Bán kính gom (px) ≈ cỡ một thẻ ảnh — hai ghim đè nhau thì gộp thành một cụm. */
const CLUSTER_RADIUS = 72;
const MAX_CLUSTER_ZOOM = 16;

function buildIndex(villages: PublicCraftVillage[]): Index {
  const index = new Supercluster<PointProps>({ radius: CLUSTER_RADIUS, maxZoom: MAX_CLUSTER_ZOOM });
  index.load(
    villages.map((v) => ({
      type: "Feature" as const,
      properties: { villageId: v.posting_id },
      geometry: { type: "Point" as const, coordinates: [Number(v.longitude), Number(v.latitude)] },
    })),
  );
  return index;
}

/** Mức zoom thấp nhất (≥ `from`) mà làng đứng riêng, không còn nằm trong cụm. */
function unclusteredZoom(index: Index, v: PublicCraftVillage, from: number): number {
  const lng = Number(v.longitude);
  const lat = Number(v.latitude);
  for (let z = Math.floor(from); z <= MAX_CLUSTER_ZOOM; z++) {
    const near = index.getClusters([lng - 1e-4, lat - 1e-4, lng + 1e-4, lat + 1e-4], z);
    if (near.some((f) => !("cluster" in f.properties) && f.properties.villageId === v.posting_id)) return z;
  }
  return MAX_CLUSTER_ZOOM + 1;
}

function readView(map: Pick<MapRef, "getBounds" | "getZoom">): View {
  const b = map.getBounds();
  return { bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() };
}

interface PhotoPinProps {
  image: string | undefined;
  fallback: string;
  count: number;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}

/** Ghim kiểu Ảnh trên iOS: thẻ ảnh bo góc + mũi nhọn chỉ vị trí; cụm thì ghi số làng ở góc ảnh. */
function PhotoPin({ image, fallback, count, label, sub, selected, onClick }: PhotoPinProps) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="group relative block pb-2">
      <span
        aria-hidden
        className="absolute bottom-0.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-white shadow-md"
      />
      <span
        className={cn(
          "relative block h-16 w-16 overflow-hidden rounded-xl border-[3px] border-white bg-muted shadow-lg transition-transform duration-150 group-hover:scale-105",
          selected && "ring-4 ring-accent",
        )}
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-primary text-base font-bold text-primary-foreground">
            {fallback}
          </span>
        )}
        {count > 1 && (
          <>
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-0.5 left-1.5 text-sm font-bold leading-tight text-white">{count}</span>
          </>
        )}
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-left text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
        <strong className="block">{label}</strong>
        {sub}
      </span>
    </button>
  );
}

/**
 * Bản đồ Việt Nam; mỗi hồ sơ làng nghề là một thẻ ảnh sản phẩm. Thu nhỏ thì các làng gần nhau
 * gộp thành một thẻ có số đếm (bấm để phóng tới), phóng to thì tách về đúng từng làng.
 */
export function CraftVillageMap({ villages, selectedId, onSelect, className }: CraftVillageMapProps) {
  const mapRef = useRef<MapRef>(null);
  // null = bản đồ chưa sẵn sàng; cập nhật mỗi lần kéo/zoom xong để gom cụm theo khung nhìn.
  const [view, setView] = useState<View | null>(null);
  const ready = view !== null;

  const byId = useMemo(() => new Map(villages.map((v) => [v.posting_id, v])), [villages]);
  const index = useMemo(() => buildIndex(villages), [villages]);
  const features = useMemo(() => (view ? index.getClusters(view.bbox, view.zoom) : []), [index, view]);

  // Đưa làng đang chọn vào giữa khung, phóng đủ gần để nó tách khỏi cụm.
  useEffect(() => {
    const map = mapRef.current;
    const v = selectedId ? byId.get(selectedId) : undefined;
    if (!v || !ready || !map) return;
    const zoom = Math.max(map.getZoom(), unclusteredZoom(index, v, map.getZoom()));
    map.easeTo({ center: [Number(v.longitude), Number(v.latitude)], zoom });
  }, [selectedId, byId, index, ready]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border border-border bg-muted", className)}>
      <VietnamMap
        ref={mapRef}
        onLoad={(e) => setView(readView(e.target))}
        onMoveEnd={() => mapRef.current && setView(readView(mapRef.current))}
      >
        {features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          if ("cluster" in f.properties && f.properties.cluster) {
            const clusterId = f.properties.cluster_id;
            const members = index
              .getLeaves(clusterId, Infinity)
              .map((leaf) => byId.get(leaf.properties.villageId))
              .filter((v): v is PublicCraftVillage => !!v);
            const cover = members.find((v) => v.image_urls[0]) ?? members[0];
            const provinces = [...new Set(members.map((v) => v.province).filter(Boolean))];
            return (
              <Marker key={`c${clusterId}`} longitude={lng} latitude={lat} anchor="bottom" className="hover:!z-20">
                <PhotoPin
                  image={cover?.image_urls[0]}
                  fallback={String(members.length)}
                  count={members.length}
                  label={`${members.length} làng nghề`}
                  sub={provinces.length > 3 ? `${provinces.slice(0, 3).join(", ")}…` : provinces.join(", ")}
                  selected={members.some((v) => v.posting_id === selectedId)}
                  onClick={() =>
                    mapRef.current?.easeTo({
                      center: [lng, lat],
                      zoom: Math.min(index.getClusterExpansionZoom(clusterId), MAX_CLUSTER_ZOOM + 1),
                    })
                  }
                />
              </Marker>
            );
          }
          const v = byId.get((f.properties as PointProps).villageId);
          if (!v) return null;
          const label = villageLabel(v);
          const selected = v.posting_id === selectedId;
          return (
            <Marker
              key={v.posting_id}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              className="hover:!z-20"
              style={{ zIndex: selected ? 10 : 1 }}
            >
              <PhotoPin
                image={v.image_urls[0]}
                fallback={(v.product || label).charAt(0).toUpperCase()}
                count={1}
                label={label}
                sub={[v.product, v.province].filter(Boolean).join(" · ")}
                selected={selected}
                onClick={() => onSelect(v)}
              />
            </Marker>
          );
        })}
      </VietnamMap>
    </div>
  );
}
