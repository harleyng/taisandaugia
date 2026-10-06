import { useEffect, useRef } from "react";
import { Marker, type MapRef } from "@vis.gl/react-maplibre";
import { VietnamMap } from "@/components/map/VietnamMap";
import { cn } from "@/lib/utils";

export interface LatLng {
  lat: number;
  lng: number;
}

interface CraftLocationPickerProps {
  value: LatLng | null;
  onChange: (value: LatLng) => void;
  disabled?: boolean;
  className?: string;
}

/** Bấm lên bản đồ (hoặc kéo ghim) để đặt vị trí làng nghề. */
export default function CraftLocationPicker({ value, onChange, disabled, className }: CraftLocationPickerProps) {
  const mapRef = useRef<MapRef>(null);
  const hadValueRef = useRef(false);

  // Lần đầu có vị trí (đặt mới hoặc tải từ hồ sơ): phóng tới ghim.
  useEffect(() => {
    if (!value) {
      hadValueRef.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || hadValueRef.current) return;
    hadValueRef.current = true;
    map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 12) });
  }, [value]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl border border-border bg-muted", className)}>
      <VietnamMap
        ref={mapRef}
        cursor={disabled ? undefined : "crosshair"}
        initialViewState={value ? { longitude: value.lng, latitude: value.lat, zoom: 12 } : undefined}
        onLoad={() => {
          hadValueRef.current = !!value;
        }}
        onClick={(e) => {
          if (!disabled) onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }}
      >
        {value && (
          <Marker
            longitude={value.lng}
            latitude={value.lat}
            draggable={!disabled}
            onDragEnd={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
          >
            <span className="block h-[22px] w-[22px] rounded-full border-[3px] border-white bg-primary shadow-lg ring-2 ring-primary/40" />
          </Marker>
        )}
      </VietnamMap>
    </div>
  );
}
