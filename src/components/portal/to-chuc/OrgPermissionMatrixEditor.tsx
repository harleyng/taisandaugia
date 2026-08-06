import { useMemo } from "react";
import { PermissionMatrixEditor as BaseEditor } from "@/components/permissions/PermissionMatrixEditor";
import {
  ORG_ACTION_LABELS,
  ORG_CATEGORY_LABELS,
  ORG_CATEGORY_ORDER,
  ORG_MODULES_BY_CATEGORY,
  type OrgAction,
  type OrgPermissionMatrix,
} from "@/lib/orgPermissions";

interface Props {
  value: OrgPermissionMatrix;
  onChange: (next: OrgPermissionMatrix) => void;
  disabled?: boolean;
}

// Adapter: nạp danh mục quyền cấp tổ chức vào trình sửa ma trận dùng chung.
export function OrgPermissionMatrixEditor({ value, onChange, disabled }: Props) {
  const categories = useMemo(
    () =>
      ORG_CATEGORY_ORDER.map((cat) => ({
        code: cat,
        label: ORG_CATEGORY_LABELS[cat],
        modules: ORG_MODULES_BY_CATEGORY[cat].map((m) => ({
          module: m.module,
          label: m.label,
          actions: m.actions,
        })),
      })),
    [],
  );

  return (
    <BaseEditor<OrgAction>
      categories={categories}
      actionLabels={ORG_ACTION_LABELS}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
