import { Flame } from "lucide-react";
import apartmentSample from "@/assets/apartment-sample.jpg";
import houseSample from "@/assets/house-sample.jpg";
import penthouseSample from "@/assets/penthouse-sample.jpg";

const areas = [
  { name: "Hà Nội", value: "1.250 tỷ", sessions: 45, image: penthouseSample },
  { name: "TP. HCM", value: "980 tỷ", sessions: 32, image: houseSample },
  { name: "Bình Dương", value: "450 tỷ", sessions: 18, image: apartmentSample },
  { name: "Đồng Nai", value: "320 tỷ", sessions: 15, image: penthouseSample },
];

export const PopularAreas = () => {
  return (
    <section className="container py-6 md:py-8 px-4">
      <div className="mb-6 md:mb-8">
        <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">
          Khu vực nổi bật
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Top 4 tỉnh thành với tổng giá trị khởi điểm lớn nhất 30 ngày qua
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {areas.map((area) => (
          <div
            key={area.name}
            className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[3/4]"
          >
            <img
              src={area.image}
              alt={area.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-amber-700 text-[10px] md:text-xs font-medium px-2 py-1 rounded-full shadow-sm">
              <Flame className="h-3 w-3 text-amber-600" fill="currentColor" strokeWidth={1.5} />
              <span>{area.value}</span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
              <h3 className="text-sm md:text-base font-bold text-white">
                {area.name}
              </h3>
              <p className="text-xs text-white/70">
                {area.sessions} phiên
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
