import type { UseFormReturn } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  form: UseFormReturn<WizardValues>;
}

const PARENTS = ASSET_CATEGORIES.filter((c) => c.children.length > 0);

/** Bước 1: chọn nhóm cha → nhóm con. */
export function Step1AssetType({ form }: StepProps) {
  const parentSlug = form.watch("parentSlug");
  const childSlug = form.watch("childSlug");
  const selectedParent = PARENTS.find((p) => p.slug === parentSlug);

  const pickParent = (slug: string) => {
    if (slug === parentSlug) return;
    form.setValue("parentSlug", slug, { shouldValidate: true });
    form.setValue("childSlug", "", { shouldValidate: true });
    form.setValue("deltaFields", {});
  };

  const pickChild = (slug: string) => {
    form.setValue("childSlug", slug, { shouldValidate: true });
    form.setValue("deltaFields", {});
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Nhóm tài sản *</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PARENTS.map((p) => {
            const Icon = p.icon;
            const active = p.slug === parentSlug;
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => pickParent(p.slug)}
                className={`rounded-2xl border p-4 flex flex-col items-center gap-2 transition-colors ${
                  active ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-medium text-center ${active ? "text-primary" : "text-foreground"}`}>
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedParent && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Loại tài sản *</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {selectedParent.children.map((child) => {
              const active = child.slug === childSlug;
              return (
                <button
                  key={child.slug}
                  type="button"
                  onClick={() => pickChild(child.slug)}
                  className={`relative rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40 text-foreground"
                  }`}
                >
                  {active && <CheckCircle2 className="absolute top-1.5 right-1.5 h-4 w-4 text-primary" />}
                  {child.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
