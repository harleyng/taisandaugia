import { Building2, Car, Cog, Package, Sofa, Palette, Amphora, MoreHorizontal } from "lucide-react";

export const ASSET_CATEGORIES = [
  {
    name: "Bất động sản",
    slug: "bat-dong-san",
    icon: Building2,
    children: [
      { name: "Đất ở", slug: "dat-o" },
      { name: "Đất nông nghiệp", slug: "dat-nong-nghiep" },
      { name: "Nhà phố", slug: "nha-pho" },
      { name: "Căn hộ", slug: "can-ho" },
      { name: "Nhà xưởng", slug: "nha-xuong" },
      { name: "Shophouse", slug: "shophouse" },
    ],
  },
  {
    name: "Xe cộ",
    slug: "xe-co",
    icon: Car,
    children: [
      { name: "Ô tô", slug: "o-to" },
      { name: "Xe tải", slug: "xe-tai" },
      { name: "Xe máy", slug: "xe-may" },
    ],
  },
  {
    name: "Máy móc",
    slug: "may-moc",
    icon: Cog,
    children: [
      { name: "Máy công trình", slug: "may-cong-trinh" },
      { name: "Máy nông nghiệp", slug: "may-nong-nghiep" },
      { name: "Dây chuyền", slug: "day-chuyen" },
    ],
  },
  {
    name: "Hàng hóa",
    slug: "hang-hoa",
    icon: Package,
    children: [
      { name: "Gạch/vật liệu", slug: "gach-vat-lieu" },
      { name: "Sắt thép", slug: "sat-thep" },
      { name: "Hàng tồn kho", slug: "hang-ton-kho" },
    ],
  },
  {
    name: "Đồ dùng",
    slug: "do-dung",
    icon: Sofa,
    children: [
      { name: "Nội thất", slug: "noi-that" },
      { name: "Thiết bị", slug: "thiet-bi" },
      { name: "Công cụ", slug: "cong-cu" },
    ],
  },
  {
    name: "Thủ công mỹ nghệ",
    slug: "thu-cong-my-nghe",
    icon: Palette,
    children: [
      { name: "Gốm sứ", slug: "gom-su" },
      { name: "Tranh", slug: "tranh" },
      { name: "Tượng", slug: "tuong" },
      { name: "Chạm khắc", slug: "cham-khac" },
      { name: "Sơn mài", slug: "son-mai" },
      { name: "Đồ gỗ", slug: "do-go" },
      { name: "Lụa", slug: "lua" },
      { name: "Thêu", slug: "theu" },
      { name: "Thổ cẩm", slug: "tho-cam" },
      { name: "Mây tre", slug: "may-tre" },
      { name: "Cói & lục bình", slug: "coi-luc-binh" },
      { name: "Đồ đồng", slug: "do-dong" },
      { name: "Kim hoàn", slug: "kim-hoan" },
      { name: "Đá mỹ nghệ", slug: "da-my-nghe" },
      { name: "Giấy dó", slug: "giay-do" },
    ],
  },
  {
    name: "Cổ vật & sưu tầm",
    slug: "co-vat-suu-tam",
    icon: Amphora,
    children: [
      { name: "Gốm sứ cổ", slug: "gom-su-co" },
      { name: "Đồ đồng cổ", slug: "do-dong-co" },
      { name: "Đồ gỗ xưa", slug: "do-go-xua" },
      { name: "Tượng thờ", slug: "tuong-tho" },
      { name: "Tranh xưa", slug: "tranh-xua" },
      { name: "Tiền cổ", slug: "tien-co" },
      { name: "Tem", slug: "tem" },
      { name: "Sách & tư liệu", slug: "sach-tu-lieu" },
      { name: "Trang sức", slug: "trang-suc" },
      { name: "Đá quý", slug: "da-quy" },
      { name: "Đồng hồ", slug: "dong-ho" },
    ],
  },
  {
    name: "Khác",
    slug: "khac",
    icon: MoreHorizontal,
    children: [] as { name: string; slug: string }[],
  },
] as const;

// ─── Tra nhãn theo slug ──────────────────────────────────────────────────────
// Ba nơi từng tự dựng lại hai map này (StepReview, brief gửi tổ chức, câu giải
// thích độ phù hợp). Cùng một luật ⇒ một chỗ.

export const PARENT_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((c) => [c.slug, c.name]),
);

export const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);
