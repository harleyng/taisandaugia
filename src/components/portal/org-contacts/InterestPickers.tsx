import { MultiSelectField, type MultiSelectOption } from "@/components/admin/marketing/audience/MultiSelectField";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { VIETNAM_PROVINCE_NAMES } from "@/constants/vietnam-provinces";

// Chọn nhóm cha = mọi loại con bên dưới (luật khớp ở SQL: slug con = ANY hoặc
// asset_parent_slug(slug) = ANY).
const CATEGORY_OPTIONS: MultiSelectOption[] = ASSET_CATEGORIES.flatMap((p) => [
  { value: p.slug, label: `${p.name} — mọi loại` },
  ...p.children.map((c) => ({ value: c.slug, label: `${p.name} › ${c.name}` })),
]);

const PROVINCE_OPTIONS: MultiSelectOption[] = VIETNAM_PROVINCE_NAMES.map((p) => ({ value: p, label: p }));

interface Props {
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export function CategoryMultiSelect({ selected, onChange, disabled }: Props) {
  return (
    <MultiSelectField
      options={CATEGORY_OPTIONS}
      selected={selected}
      onChange={onChange}
      searchable
      placeholder="Mọi loại tài sản"
      searchPlaceholder="Tìm loại tài sản…"
      maxBadges={3}
      disabled={disabled}
    />
  );
}

export function ProvinceMultiSelect({ selected, onChange, disabled }: Props) {
  return (
    <MultiSelectField
      options={PROVINCE_OPTIONS}
      selected={selected}
      onChange={onChange}
      searchable
      placeholder="Toàn quốc"
      searchPlaceholder="Tìm tỉnh/thành…"
      maxBadges={3}
      disabled={disabled}
    />
  );
}
