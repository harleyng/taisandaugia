import { useEffect, useRef } from "react";
import L from "leaflet";
import { cn } from "@/lib/utils";
import { createVietnamMap } from "./vietnamMap";

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

const PIN = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<span class="block h-[22px] w-[22px] rounded-full border-[3px] border-white bg-primary shadow-lg ring-2 ring-primary/40"></span>',
});

/** Bấm lên bản đồ (hoặc kéo ghim) để đặt vị trí làng nghề. */
export default function CraftLocationPicker({ value, onChange, disabled, className }: CraftLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createVietnamMap(containerRef.current);
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (disabledRef.current) return;
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const at = L.latLng(value.lat, value.lng);
    if (!markerRef.current) {
      markerRef.current = L.marker(at, { icon: PIN, draggable: !disabled, keyboard: false })
        .on("dragend", (e) => {
          const p = (e.target as L.Marker).getLatLng();
          onChangeRef.current({ lat: p.lat, lng: p.lng });
        })
        .addTo(map);
      map.setView(at, Math.max(map.getZoom(), 12));
    } else {
      markerRef.current.setLatLng(at);
    }
  }, [value, disabled]);

  useEffect(() => {
    const drag = markerRef.current?.dragging;
    if (!drag) return;
    if (disabled) drag.disable();
    else drag.enable();
  }, [disabled]);

  return (
    <div className={cn("relative isolate overflow-hidden rounded-xl border border-border bg-muted", className)}>
      <div ref={containerRef} className={cn("relative z-0 h-full w-full", !disabled && "cursor-crosshair")} />
    </div>
  );
}
