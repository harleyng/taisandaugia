import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationMapProps {
  latitude: number;
  longitude: number;
}

export const LocationMap = React.memo(({ latitude, longitude }: LocationMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!latitude || !longitude || !containerRef.current) return;

    // Clean up existing map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      try {
        const map = L.map(containerRef.current, {
          center: [latitude, longitude],
          zoom: 15,
          scrollWheelZoom: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        L.marker([latitude, longitude]).addTo(map);

        mapRef.current = map;

        // Force map to invalidate size after a short delay
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      } catch (error) {
        console.error("Error creating map:", error);
      }
    }, 50);

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  if (!latitude || !longitude) {
    return (
      <div className="w-full h-[300px] rounded-lg border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn địa chỉ để hiển thị bản đồ</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] rounded-lg border overflow-hidden isolate">
      <div ref={containerRef} className="w-full h-full relative z-0" />
    </div>
  );
});
