import { SelectField } from "./fields";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";

interface BranchFieldProps {
  value: string;
  onChange: (branchId: string) => void;
  err?: string;
}

/**
 * "Chi nhánh" của hồ sơ trong không gian đang chọn (Phase 4). Ẩn ở tenant Cá nhân
 * và khi không gian chưa có chi nhánh. Người bị giới hạn: bắt buộc, chỉ hiện chi
 * nhánh trong phạm vi — hồ sơ không chi nhánh thì RLS không cho họ ghi.
 */
export function BranchField({ value, onChange, err }: BranchFieldProps) {
  const { workspaceId, isScoped: scoped, branchScope } = useOwnerWorkspace();
  const { data: branches = [] } = useWorkspaceBranchOptions(workspaceId);

  if (!workspaceId || (branches.length === 0 && !value)) return null;

  const options = branches
    .filter((b) => b.isActive || b.id === value)
    .filter((b) => !scoped || branchScope.includes(b.id))
    .map((b) => ({ value: b.id, label: b.label }));

  return (
    <SelectField
      label="Chi nhánh"
      req={scoped}
      help={
        scoped
          ? "Bạn chỉ số hoá được tài sản của chi nhánh được giao."
          : "Để trống nếu tài sản thuộc hội sở hoặc toàn đơn vị."
      }
      options={options}
      value={value}
      onChange={onChange}
      err={err}
      placeholder={scoped ? "Chọn chi nhánh" : "Toàn đơn vị"}
    />
  );
}
