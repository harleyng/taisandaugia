import type { UseFormReturn } from "react-hook-form";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { DeltaFieldInput } from "./DeltaFieldInput";
import type { WizardValues } from "./wizardSchema";

interface DeltaFieldsSectionProps {
  form: UseFormReturn<WizardValues>;
}

/** Render các trường riêng theo loại con (delta), wired vào form.deltaFields. */
export function DeltaFieldsSection({ form }: DeltaFieldsSectionProps) {
  const childSlug = form.watch("childSlug");
  const deltaFields = form.watch("deltaFields") ?? {};
  const descriptors = getDeltaFields(childSlug);

  if (descriptors.length === 0) return null;

  const setField = (key: string, value: unknown) => {
    form.setValue("deltaFields", { ...deltaFields, [key]: value }, { shouldDirty: true });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {descriptors.map((d) => (
          <div key={d.key} className={d.type === "textarea" ? "sm:col-span-2" : undefined}>
            <DeltaFieldInput descriptor={d} value={deltaFields[d.key]} onChange={(val) => setField(d.key, val)} />
          </div>
        ))}
      </div>
    </div>
  );
}
