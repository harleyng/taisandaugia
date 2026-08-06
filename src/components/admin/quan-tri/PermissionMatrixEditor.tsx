import { useMemo } from "react";
import { PermissionMatrixEditor as BaseEditor } from "@/components/permissions/PermissionMatrixEditor";
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MODULES_BY_CATEGORY,
  type AdminAction,
  type PermissionMatrix,
} from "@/lib/adminPermissions";

interface Props {
  value: PermissionMatrix;
  onChange: (next: PermissionMatrix) => void;
  disabled?: boolean;
}

// Adapter: nạp danh mục quyền của khu /admin vào trình sửa ma trận dùng chung.
export function PermissionMatrixEditor({ value, onChange, disabled }: Props) {
  const categories = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        code: cat,
        label: CATEGORY_LABELS[cat],
        modules: MODULES_BY_CATEGORY[cat].map((m) => ({
          module: m.module,
          label: m.label,
          actions: m.actions,
        })),
      })),
    [],
  );

  return (
    <BaseEditor<AdminAction>
      categories={categories}
      actionLabels={ACTION_LABELS}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
