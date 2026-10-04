import { BRAND } from "@/lib/brand";

/** Chân trang Hồ sơ online: nguồn gốc thông tin + bản quyền. */
export function SharedFooter() {
  return (
    <footer className="mt-8 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border pb-2 pt-[22px] text-[12.5px] text-muted-foreground">
      <span>Thông tin do chủ tài sản cung cấp và đã được sàn duyệt trước khi chia sẻ.</span>
      <span>
        © {new Date().getFullYear()} {BRAND.name}
      </span>
    </footer>
  );
}
