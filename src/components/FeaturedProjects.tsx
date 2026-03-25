import logoLacViet from "@/assets/logo-lac-viet.png";
import logoBaoPhong from "@/assets/logo-bao-phong.png";
import logoNalaf from "@/assets/logo-nalaf-new.png";

const companies = [
  { id: 1, logo: logoLacViet, name: "Lạc Việt Auction", sessions: "1.234 phiên", bg: "bg-red-50 dark:bg-red-950/20" },
  { id: 2, logo: logoBaoPhong, name: "Bảo Phong Auction", sessions: "987 phiên", bg: "bg-amber-50 dark:bg-amber-950/20" },
  { id: 3, logo: logoNalaf, name: "Đấu giá Số 5 Quốc gia", sessions: "765 phiên", bg: "bg-orange-50 dark:bg-orange-950/20" },
];

export const FeaturedProjects = () => {
  return (
    <section className="container py-6 md:py-8 px-4">
      <div className="mb-6 md:mb-8">
        <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">
          Công ty đấu giá tiêu biểu
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Tổng hợp từ các đơn vị uy tín nhất
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {companies.map((company) => (
          <div
            key={company.id}
            className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[4/3] flex flex-col"
          >
            {/* Logo as background */}
            <div className={`w-full h-full ${company.bg} flex items-center justify-center p-8 transition-transform duration-500 group-hover:scale-105`}>
              <img
                src={company.logo}
                alt={company.name}
                className="max-w-[70%] max-h-[60%] object-contain opacity-90"
              />
            </div>
            {/* Gradient overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
            {/* Text overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
              <h3 className="text-lg md:text-xl font-bold text-white mb-1">
                {company.name}
              </h3>
              <span className="text-sm font-semibold text-white/80">
                {company.sessions}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
