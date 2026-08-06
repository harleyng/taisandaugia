import { Checkbox } from "@/components/ui/checkbox";

/**
 * Trình sửa ma trận quyền dùng chung cho MỌI hệ RBAC (admin cấp nền tảng và
 * tổ chức đấu giá). Component thuần controlled: danh mục quyền được truyền vào
 * qua props thay vì import cứng, nên hai hệ có tập action khác nhau vẫn dùng
 * chung được.
 */

export interface MatrixModuleDef<A extends string> {
  module: string;
  label: string;
  actions: A[];
}

export interface MatrixCategoryDef<A extends string> {
  code: string;
  label: string;
  modules: MatrixModuleDef<A>[];
}

interface Props<A extends string> {
  categories: MatrixCategoryDef<A>[];
  actionLabels: Record<A, string>;
  value: Record<string, A[]>;
  onChange: (next: Record<string, A[]>) => void;
  disabled?: boolean;
}

type TriState = boolean | "indeterminate";

const moduleTri = <A extends string>(
  m: Record<string, A[]>,
  def: MatrixModuleDef<A>,
): TriState => {
  const on = def.actions.filter((a) => m[def.module]?.includes(a)).length;
  return on === 0 ? false : on === def.actions.length ? true : "indeterminate";
};

const categoryTri = <A extends string>(
  m: Record<string, A[]>,
  mods: MatrixModuleDef<A>[],
): TriState => {
  const total = mods.reduce((n, d) => n + d.actions.length, 0);
  const on = mods.reduce(
    (n, d) => n + d.actions.filter((a) => m[d.module]?.includes(a)).length,
    0,
  );
  return on === 0 ? false : on === total ? true : "indeterminate";
};

export function PermissionMatrixEditor<A extends string>({
  categories,
  actionLabels,
  value,
  onChange,
  disabled,
}: Props<A>) {
  const setModuleActions = (module: string, actions: A[]) => {
    const next = { ...value };
    if (actions.length === 0) delete next[module];
    else next[module] = actions;
    onChange(next);
  };

  const toggleAction = (def: MatrixModuleDef<A>, action: A) => {
    if (disabled) return;
    const cur = value[def.module] ?? [];
    const has = cur.includes(action);
    setModuleActions(def.module, has ? cur.filter((a) => a !== action) : [...cur, action]);
  };

  const toggleModule = (def: MatrixModuleDef<A>, on: boolean) => {
    if (disabled) return;
    setModuleActions(def.module, on ? [...def.actions] : []);
  };

  const toggleCategory = (mods: MatrixModuleDef<A>[], on: boolean) => {
    if (disabled) return;
    const next = { ...value };
    mods.forEach((d) => {
      if (on) next[d.module] = [...d.actions];
      else delete next[d.module];
    });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.code} className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">{cat.label}</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              Tất cả
              <Checkbox
                checked={categoryTri(value, cat.modules)}
                disabled={disabled}
                onCheckedChange={(c) => toggleCategory(cat.modules, c === true)}
              />
            </label>
          </div>
          <div className="divide-y divide-border">
            {cat.modules.map((def) => (
              <div
                key={def.module}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <label className="flex items-center gap-2 min-w-[170px] cursor-pointer">
                  <Checkbox
                    checked={moduleTri(value, def)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggleModule(def, c === true)}
                  />
                  <span className="text-sm font-medium text-foreground">{def.label}</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {def.actions.map((action) => {
                    const active = value[def.module]?.includes(action) ?? false;
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleAction(def, action)}
                        className={[
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50",
                          disabled ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {actionLabels[action]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
