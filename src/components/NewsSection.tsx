import { ArrowRight, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import apartmentSample from "@/assets/apartment-sample.jpg";
import houseSample from "@/assets/house-sample.jpg";
import penthouseSample from "@/assets/penthouse-sample.jpg";

const sourceLogos: Record<string, string> = {
  "Dân trí": "https://www.google.com/s2/favicons?domain=dantri.com.vn&sz=32",
  "VnExpress": "https://www.google.com/s2/favicons?domain=vnexpress.net&sz=32",
  "Tuổi Trẻ": "https://www.google.com/s2/favicons?domain=tuoitre.vn&sz=32",
  "CafeF": "https://www.google.com/s2/favicons?domain=cafef.vn&sz=32",
};

const news = [
  {
    id: 1,
    image: apartmentSample,
    title: "Phiên đấu giá đất Thanh Oai lập kỷ lục chênh lệch giá 2.400%",
    excerpt: "Lô đất khởi điểm 1,8 triệu/m² được trả lên tới 45 triệu/m², tạo nên kỷ lục chênh lệch giá chưa từng có...",
    source: "Dân trí",
    date: "28/02/2026",
    category: "Kết quả đấu giá",
    readTime: "2 phút đọc",
    views: 21900,
  },
  {
    id: 2,
    image: houseSample,
    title: "Quy định mới về đấu giá tài sản có hiệu lực từ tháng 1/2026",
    source: "VnExpress",
    date: "25/02/2026",
    category: "Pháp luật",
    readTime: "3 phút đọc",
    views: 19400,
  },
  {
    id: 3,
    image: penthouseSample,
    title: "TP.HCM đấu giá thành công 4 lô đất Thủ Thiêm đợt 2",
    source: "Tuổi Trẻ",
    date: "22/02/2026",
    category: "Kết quả đấu giá",
    readTime: "3 phút đọc",
    views: 19400,
  },
  {
    id: 4,
    image: apartmentSample,
    title: "Cẩn trọng với chiêu trò thổi giá tại các phiên đấu giá đất",
    source: "CafeF",
    date: "20/02/2026",
    category: "Kiến thức",
    readTime: "4 phút đọc",
    views: 20700,
  },
  {
    id: 5,
    image: houseSample,
    title: "Hướng dẫn tham gia đấu giá bất động sản trực tuyến năm 2026",
    source: "Dân trí",
    date: "18/02/2026",
    category: "Kiến thức",
    readTime: "5 phút đọc",
    views: 15200,
  },
];
const formatViews = (views: number) => {
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

export const NewsSection = () => {
  const mainArticle = news[0];
  const sideArticles = news.slice(1);

  return (
    <section className="container py-6 md:py-8 px-4">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h2 className="text-lg md:text-2xl font-medium text-foreground mb-1">
            Tin tức đấu giá
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Cập nhật tin tức đấu giá mới nhất
          </p>
        </div>
        <Button variant="ghost" size="sm" className="hidden sm:flex text-muted-foreground hover:text-foreground text-sm">
          Xem tất cả
          <ArrowRight className="ml-1 h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Main article */}
        <div className="group cursor-pointer flex flex-col">
          <div className="relative rounded-xl overflow-hidden aspect-[2/1] mb-3">
            <img
              src={mainArticle.image}
              alt={mainArticle.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
              <Eye className="h-3 w-3" />
              <span>{formatViews(mainArticle.views)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-primary">
              {mainArticle.category}
            </span>
            <span className="text-xs text-muted-foreground">• {mainArticle.readTime}</span>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {mainArticle.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {mainArticle.excerpt}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <img src={sourceLogos[mainArticle.source]} alt={mainArticle.source} className="h-4 w-4 rounded-sm" />
            <span className="font-medium text-foreground/70">{mainArticle.source}</span>
            <span>•</span>
            <Clock className="h-3.5 w-3.5" />
            {mainArticle.date}
          </div>
        </div>

        {/* Side articles */}
        <div className="flex flex-col gap-4 justify-between">
          {sideArticles.map((article) => (
            <div key={article.id} className="group flex gap-3 cursor-pointer">
              <div className="relative rounded-lg overflow-hidden w-28 h-20 md:w-36 md:h-24 flex-shrink-0">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded">
                  <Eye className="h-2.5 w-2.5" />
                  <span>{formatViews(article.views)}</span>
                </div>
              </div>
              <div className="flex flex-col justify-start min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-primary">
                    {article.category}
                  </span>
                  <span className="text-xs text-muted-foreground">• {article.readTime}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                  <img src={sourceLogos[article.source]} alt={article.source} className="h-3.5 w-3.5 rounded-sm" />
                  <span className="font-medium text-foreground/70">{article.source}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  {article.date}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
