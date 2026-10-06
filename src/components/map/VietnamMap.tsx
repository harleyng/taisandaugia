import { forwardRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map, Marker, NavigationControl, type MapProps, type MapRef } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ISLAND_LABELS,
  VN_MAX_BOUNDS,
  VN_VIEW_BOUNDS,
  fetchVietnamMapStyle,
} from "@/lib/vietnamMap";

const LOCALE = {
  "Map.Title": "Bản đồ",
  "Marker.Title": "Ghim bản đồ",
  "NavigationControl.ZoomIn": "Phóng to",
  "NavigationControl.ZoomOut": "Thu nhỏ",
  "NavigationControl.ResetBearing": "Về hướng bắc",
  "AttributionControl.ToggleAttribution": "Nguồn bản đồ",
};

export type VietnamMapProps = Omit<MapProps, "mapStyle" | "style"> & { className?: string };

/**
 * Bản đồ dùng chung của sàn (MapLibre). Luôn kèm nhãn chủ quyền Hoàng Sa, Trường Sa và ẩn
 * nhãn nền nước ngoài trên hai quần đảo — xem `@/lib/vietnamMap`. Không tự đặt kích thước:
 * lớp bọc ngoài quyết định chiều cao.
 */
export const VietnamMap = forwardRef<MapRef, VietnamMapProps>(function VietnamMap(
  { className, children, onClick, initialViewState, minZoom = 4, maxBounds = VN_MAX_BOUNDS, ...props },
  ref,
) {
  const { data: mapStyle, isError } = useQuery({
    queryKey: ["vietnam-map-style"],
    queryFn: fetchVietnamMapStyle,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  // Cuộn chuột chỉ phóng to sau cú nhấp đầu tiên — tránh cướp cuộn trang.
  const [scrollZoom, setScrollZoom] = useState(false);

  if (isError) {
    return (
      <div className={cn("grid h-full w-full place-items-center p-4 text-center text-sm text-muted-foreground", className)}>
        Không tải được bản đồ. Vui lòng thử lại sau.
      </div>
    );
  }
  if (!mapStyle) return <Skeleton className={cn("h-full w-full rounded-none", className)} />;

  return (
    <div className={cn("relative h-full w-full", className)}>
      <Map
        ref={ref}
        mapStyle={mapStyle}
        initialViewState={initialViewState ?? { bounds: VN_VIEW_BOUNDS }}
        minZoom={minZoom}
        maxBounds={maxBounds}
        scrollZoom={scrollZoom}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        locale={LOCALE}
        attributionControl={{ compact: true }}
        style={{ width: "100%", height: "100%" }}
        onClick={(e) => {
          setScrollZoom(true);
          onClick?.(e);
        }}
        {...props}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {ISLAND_LABELS.map((island) => (
          <Marker
            key={island.name}
            longitude={island.lng}
            latitude={island.lat}
            anchor="left"
            style={{ pointerEvents: "none" }}
          >
            <span className="block whitespace-nowrap text-[11px] font-semibold italic text-primary [text-shadow:0_0_3px_#fff,0_0_3px_#fff]">
              {island.name}
            </span>
          </Marker>
        ))}
        {children}
      </Map>
    </div>
  );
});
