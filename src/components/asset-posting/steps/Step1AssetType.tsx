import { AlertCircle, Check, LayoutGrid } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { Group } from "../fields";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
}

const PARENTS = ASSET_CATEGORIES.filter((c) => c.children.length > 0);

/** Bước 1: chọn nhóm cha (card) → loại con (chip). */
export function Step1AssetType({ f, up, errs }: StepProps) {
  const parent = ASSET_CATEGORIES.find((c) => c.slug === f.parentSlug);

  return (
    <Group icon={<LayoutGrid className="h-4 w-4" />} title="Phân loại tài sản">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <label className="text-[13.5px] font-semibold text-foreground">
            Nhóm tài sản<span className="ml-0.5 text-destructive">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {PARENTS.map((c) => {
              const Icon = c.icon;
              const on = f.parentSlug === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => up({ parentSlug: c.slug, childSlug: "", deltaFields: {} })}
                  className={`relative bg-card border-[1.5px] rounded-xl p-3.5 flex flex-col items-center gap-2 transition ${
                    on ? "border-primary bg-primary/5 ring-[3px] ring-primary/10" : "border-border hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {on && <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-primary" />}
                  <Icon className={`h-6 w-6 ${on ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-[13px] font-semibold text-center ${on ? "text-primary" : "text-foreground"}`}>{c.name}</span>
                </button>
              );
            })}
          </div>
          {errs.parentSlug && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {errs.parentSlug}
            </div>
          )}
        </div>

        {parent && (
          <div className="flex flex-col gap-2.5">
            <label className="text-[13.5px] font-semibold text-foreground">
              Loại tài sản trong nhóm {parent.name}
              <span className="ml-0.5 text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {parent.children.map((c) => {
                const on = f.childSlug === c.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => up({ childSlug: c.slug, deltaFields: {} })}
                    className={`inline-flex items-center gap-1.5 border-[1.5px] rounded-[9px] px-3.5 py-2 text-[13.5px] transition ${
                      on ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border font-medium hover:border-primary"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" />} {c.name}
                  </button>
                );
              })}
            </div>
            {errs.childSlug && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> {errs.childSlug}
              </div>
            )}
          </div>
        )}
      </div>
    </Group>
  );
}
