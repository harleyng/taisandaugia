import { Building2, Car, Cog, Package, Sofa, MoreHorizontal } from "lucide-react";

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
    name: "Khác",
    slug: "khac",
    icon: MoreHorizontal,
    children: [] as { name: string; slug: string }[],
  },
] as const;
