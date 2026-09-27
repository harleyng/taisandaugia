import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TemplateVersionsTable } from "@/components/admin/contract-templates/TemplateVersionsTable";
import { useContractTemplates } from "@/hooks/useContractTemplates";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { TEMPLATE_GROUP_LABELS, TEMPLATE_TYPES, type ContractTemplateType } from "@/lib/contracts/templates/schema";
import { adminContractTemplateCreatePath, adminContractTemplatePath } from "@/lib/contracts/paths";
import { cn } from "@/lib/utils";

const DEFAULTS: { loai: ContractTemplateType } = { loai: "consignment" };
const ALLOWED = { loai: TEMPLATE_TYPES.map((d) => d.type) } as const;

/**
 * Mẫu hợp đồng — phiên bản hoá câu chữ các hợp đồng trên sàn. Bất biến: sửa = tạo
 * bản mới (nhân bản) với ngày hiệu lực không trước hôm nay; hợp đồng đã lập giữ
 * đúng bản đã dùng (ký gửi / mua bán in mã mẫu ở chân trang, dịch vụ lưu template_id).
 */
export default function AdminContractTemplatesPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useContractTemplates();
  const canCreate = useHasAdminPermission("mau-hop-dong", "create");
  const [f, setFilter] = useUrlFilterState(DEFAULTS, ALLOWED);
  const def = TEMPLATE_TYPES.find((d) => d.type === f.loai) ?? TEMPLATE_TYPES[0];
  const versions = useMemo(() => data.filter((t) => t.template_type === def.type), [data, def.type]);
  const groups = (["dau-gia", "dich-vu"] as const).map((g) => ({
    key: g,
    label: TEMPLATE_GROUP_LABELS[g],
    types: TEMPLATE_TYPES.filter((d) => d.group === g),
  }));

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mẫu hợp đồng</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Câu chữ điều khoản của hợp đồng ký gửi, mua bán và hợp đồng dịch vụ — mỗi lần sửa là một phiên bản mới
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {groups.map((g) => (
          <div key={g.key} className="flex flex-wrap items-center gap-2" role="tablist" aria-label={g.label}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</span>
            {g.types.map((d) => {
              const active = d.type === def.type;
              return (
                <button
                  key={d.type}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter("loai", d.type)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  {d.shortLabel}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <TemplateVersionsTable
        def={def}
        versions={versions}
        isLoading={isLoading}
        canCreate={canCreate}
        onCreate={(from) => navigate(adminContractTemplateCreatePath(def.type, from?.id))}
        onView={(v) => navigate(adminContractTemplatePath(v.id))}
      />
    </div>
  );
}
