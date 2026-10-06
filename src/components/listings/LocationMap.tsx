import React from "react";
import { Marker } from "@vis.gl/react-maplibre";
import { VietnamMap } from "@/components/map/VietnamMap";

interface LocationMapProps {
  latitude: number;
  longitude: number;
}

export const LocationMap = React.memo(({ latitude, longitude }: LocationMapProps) => {
  if (!latitude || !longitude) {
    return (
      <div className="w-full h-[300px] rounded-lg border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Vui lòng chọn địa chỉ để hiển thị bản đồ</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] rounded-lg border overflow-hidden isolate">
      {/* key: đổi địa chỉ thì dựng lại khung nhìn quanh toạ độ mới */}
      <VietnamMap key={`${latitude},${longitude}`} initialViewState={{ latitude, longitude, zoom: 15 }}>
        <Marker latitude={latitude} longitude={longitude} anchor="bottom">
          <svg width="28" height="38" viewBox="0 0 28 38" aria-hidden className="drop-shadow-md">
            <path
              d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 38 14 38s14-13.7 14-24.1C28 6.2 21.7 0 14 0z"
              className="fill-primary"
            />
            <circle cx="14" cy="14" r="5" className="fill-white" />
          </svg>
        </Marker>
      </VietnamMap>
    </div>
  );
});
