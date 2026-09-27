import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuctionOrgPicker } from "@/components/shared/AuctionOrgPicker";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { ReportOutcomeForm } from "@/lib/ownerOutcomeReport";
import { OutcomeFieldError } from "./OutcomeFieldError";

const NONE = "__none__";

export interface BranchOption {
  id: string;
  label: string;
}

interface OffPlatformAssetFieldsProps {
  branches: BranchOption[];
  /** null = không bị giới hạn chi nhánh. */
  branchScope: string[] | null;
  disabled?: boolean;
}

/** Tài sản NGOÀI sàn: tên (định danh giữa các lượt), loại, chi nhánh, tổ chức, giá khởi điểm. */
export function OffPlatformAssetFields({ branches, branchScope, disabled }: OffPlatformAssetFieldsProps) {
  const { control, register, formState } = useFormContext<ReportOutcomeForm>();
  const errors = formState.errors;
  const options = branchScope ? branches.filter((b) => branchScope.includes(b.id)) : branches;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="oc-title">
          Tên tài sản <span className="text-destructive">*</span>
        </Label>
        <Input
          id="oc-title"
          placeholder="VD: QSDĐ thửa 123, tờ bản đồ 45, xã An Phú"
          disabled={disabled}
          {...register("assetTitle")}
        />
        {errors.assetTitle ? (
          <OutcomeFieldError msg={errors.assetTitle.message} />
        ) : (
          <p className="text-xs text-muted-foreground">Ghi giống nhau ở các lượt sau để gộp đúng một tài sản.</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="oc-category">Loại tài sản</Label>
          <Controller
            control={control}
            name="assetCategory"
            render={({ field }) => (
              <Select
                value={field.value || NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                disabled={disabled}
              >
                <SelectTrigger id="oc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Chưa chọn</SelectItem>
                  {ASSET_CATEGORIES.map((p) => (
                    <SelectGroup key={p.slug}>
                      <SelectLabel>{p.name}</SelectLabel>
                      {p.children.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={p.slug}>{p.name} khác</SelectItem>
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {options.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="oc-branch">
              Chi nhánh
              {/* Bị giới hạn chi nhánh thì không có "Toàn đơn vị" — bắt buộc chọn một. */}
              {branchScope && <span className="text-destructive"> *</span>}
            </Label>
            <Controller
              control={control}
              name="branchId"
              render={({ field }) => (
                <Select
                  value={field.value || NONE}
                  onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  disabled={disabled}
                >
                  <SelectTrigger id="oc-branch">
                    <SelectValue placeholder="Chọn chi nhánh" />
                  </SelectTrigger>
                  <SelectContent>
                    {!branchScope && <SelectItem value={NONE}>Toàn đơn vị</SelectItem>}
                    {options.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <OutcomeFieldError msg={errors.branchId?.message} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="oc-org">Tổ chức đấu giá</Label>
        <Controller
          control={control}
          name="auctionOrgId"
          render={({ field }) => (
            <AuctionOrgPicker
              id="oc-org"
              value={field.value ?? null}
              onChange={field.onChange}
              accountedToggle={false}
              placeholder="Chọn trong danh bạ, hoặc để trống"
              disabled={disabled}
            />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="oc-starting">Giá khởi điểm (₫)</Label>
        <Controller
          control={control}
          name="startingPrice"
          render={({ field }) => (
            <NumberInput
              id="oc-starting"
              allowDecimal={false}
              className="tabular-nums"
              disabled={disabled}
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
