import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAdminUnit, useAdminUnits } from "@/hooks/useAdminUnits";
import {
  ADMIN_UNIT_TYPE_LABELS,
  adminUnitShortName,
  matchesAdminUnit,
  type AdminUnit,
} from "@/lib/adminUnits";

interface Props {
  /** Mã ĐVHC đang chọn (mã xã 5 chữ số, hoặc mã tỉnh 2 chữ số khi `level="province"`). */
  value: string | null;
  onChange: (code: string | null) => void;
  /** Cấp mà trường này LƯU. Mặc định cấp xã (tỉnh chỉ là bước chọn trung gian). */
  level?: "commune" | "province";
  disabled?: boolean;
  id?: string;
}

/**
 * Chọn đơn vị hành chính sau sáp nhập 2025: tỉnh/thành phố → xã/phường/đặc khu.
 * Tìm không phân biệt dấu, và gõ tên TRƯỚC sáp nhập ("Bắc Giang") vẫn ra đơn vị
 * hiện hành ("Tỉnh Bắc Ninh") nhờ `legacy_names`.
 *
 * Danh mục đến từ `public.admin_units` (xem `src/lib/adminUnits.ts`), KHÔNG từ
 * `vietnam-locations.ts` (địa chỉ 3 cấp cũ).
 */
export function AdminUnitPicker({ value, onChange, level = "commune", disabled, id }: Props) {
  // Mã đã lưu có thể là mã xã trong khi ta chưa biết tỉnh của nó ⇒ đọc một dòng
  // để suy ra tỉnh cha (và để hiện nhãn ngay khi chưa mở danh sách).
  const { data: saved } = useAdminUnit(value);
  const [provinceCode, setProvinceCode] = useState<string | null>(
    level === "province" ? value : null,
  );

  useEffect(() => {
    if (level === "province") {
      setProvinceCode(value);
      return;
    }
    if (saved?.parent_code) setProvinceCode(saved.parent_code);
  }, [level, value, saved?.parent_code]);

  const { data: provinces, isLoading: provincesLoading } = useAdminUnits(null);
  const { data: communes, isLoading: communesLoading } = useAdminUnits(
    level === "commune" ? provinceCode : null,
  );

  const province = useMemo(
    () => (provinces ?? []).find((p) => p.code === provinceCode) ?? null,
    [provinces, provinceCode],
  );
  const commune = useMemo(
    () => (communes ?? []).find((c) => c.code === value) ?? (value ? saved : null) ?? null,
    [communes, value, saved],
  );

  const handleProvince = (code: string) => {
    setProvinceCode(code);
    // Đổi tỉnh ⇒ mã xã cũ không còn thuộc tỉnh mới, phải bỏ.
    if (level === "province") onChange(code);
    else if (value) onChange(null);
  };

  return (
    <div className="space-y-2">
      <UnitCombobox
        id={id}
        units={provinces ?? []}
        loading={provincesLoading}
        selected={province}
        placeholder="Chọn tỉnh / thành phố"
        searchPlaceholder="Tìm tỉnh / thành phố…"
        disabled={disabled}
        onSelect={handleProvince}
      />

      {level === "commune" && (
        <UnitCombobox
          units={communes ?? []}
          loading={communesLoading}
          selected={commune}
          placeholder={provinceCode ? "Chọn xã / phường / đặc khu" : "Chọn tỉnh trước"}
          searchPlaceholder="Tìm xã / phường / đặc khu…"
          disabled={disabled || !provinceCode}
          onSelect={(code) => onChange(code === value ? null : code)}
        />
      )}

      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onChange(null);
            if (level === "province") setProvinceCode(null);
          }}
        >
          <X className="mr-1 h-3 w-3" />
          Bỏ gắn đơn vị hành chính
        </Button>
      )}
    </div>
  );
}

interface ComboboxProps {
  id?: string;
  units: AdminUnit[];
  loading: boolean;
  selected: AdminUnit | null;
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
  onSelect: (code: string) => void;
}

function UnitCombobox({
  id,
  units,
  loading,
  selected,
  placeholder,
  searchPlaceholder,
  disabled,
  onSelect,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  // Tự lọc (bỏ dấu + khớp cả tên cũ) nên tắt bộ lọc mặc định của cmdk.
  const list = useMemo(
    () => units.filter((u) => matchesAdminUnit(u, term)).slice(0, 400),
    [units, term],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{loading ? "Đang tải…" : "Không tìm thấy đơn vị nào"}</CommandEmpty>
            <CommandGroup>
              {list.map((u) => (
                <CommandItem
                  key={u.code}
                  value={u.code}
                  onSelect={() => {
                    onSelect(u.code);
                    setTerm("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected?.code === u.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{adminUnitShortName(u.name)}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {ADMIN_UNIT_TYPE_LABELS[u.unit_type]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
