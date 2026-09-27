import { ASSET_PHASES, ASSET_PHASE_META, type AssetPhase } from "@/lib/ownerAssets";

/** Màu của nhóm giai đoạn — dùng chung cho chấm ở tab, thanh bước và đường đi trong popup chi tiết. */
export const PHASE_FILL: Record<AssetPhase, string> = {
  prep: "bg-foreground/60",
  auc: "bg-primary",
  fail: "bg-destructive",
  won: "bg-warning",
  done: "bg-muted-foreground",
};

export type AssetTab = "mine" | "claims" | "all" | AssetPhase;

export interface AssetTabDef {
  id: AssetTab;
  label: string;
  /** Tab việc cần làm — tô vàng. */
  highlight?: boolean;
  phase?: AssetPhase;
  /** Vạch ngăn sau tab này. */
  divider?: boolean;
}

export const ASSET_TABS: AssetTabDef[] = [
  { id: "mine", label: "Cần bạn xử lý", highlight: true },
  { id: "claims", label: "Sàn tìm thấy", highlight: true, divider: true },
  { id: "all", label: "Tất cả" },
  ...ASSET_PHASES.map((p): AssetTabDef => ({ id: p, label: ASSET_PHASE_META[p].label, phase: p })),
];
