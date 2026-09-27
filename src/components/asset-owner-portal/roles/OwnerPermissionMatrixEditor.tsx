import { useMemo } from "react";
import { PermissionMatrixEditor as BaseEditor } from "@/components/permissions/PermissionMatrixEditor";
import {
  normalizeOwnerMatrix,
  OWNER_ACTION_LABELS,
  OWNER_CATEGORY_LABELS,
  OWNER_CATEGORY_ORDER,
  OWNER_MODULES_BY_CATEGORY,
  type OwnerAction,
  type OwnerPermissionMatrix,
} from "@/lib/ownerWorkspace/permissions";

interface Props {
  value: OwnerPermissionMatrix;
  onChange: (next: OwnerPermissionMatrix) => void;
  disabled?: boolean;
}

/**
 * Adapter: nạp danh mục quyền của Trạm Điều Hành vào trình sửa ma trận dùng chung.
 * "Xem" là ngầm định — bật thao tác nào thì module tự có Xem, tắt Xem thì tắt cả
 * module (normalizeOwnerMatrix; server cũng tự thêm Xem).
 */
export function OwnerPermissionMatrixEditor({ value, onChange, disabled }: Props) {
  const categories = useMemo(
    () =>
      OWNER_CATEGORY_ORDER.map((cat) => ({
        code: cat,
        label: OWNER_CATEGORY_LABELS[cat],
        modules: OWNER_MODULES_BY_CATEGORY[cat].map((m) => ({
          module: m.module,
          label: m.label,
          actions: m.actions,
          actionLabels: m.actionLabels,
          hint: m.hint,
        })),
      })),
    [],
  );

  return (
    <BaseEditor<OwnerAction>
      categories={categories}
      actionLabels={OWNER_ACTION_LABELS}
      value={value}
      onChange={(next) => onChange(normalizeOwnerMatrix(next, value))}
      disabled={disabled}
    />
  );
}
