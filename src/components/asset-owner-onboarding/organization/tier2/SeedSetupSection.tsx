import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Info, Lock, X, Plus } from "lucide-react";
import { detectCandidates } from "@/hooks/useAssetOwnerWorkspace";
import type { Candidate } from "@/hooks/useAssetOwnerWorkspace";
import type { AssetOwnerWorkspace } from "@/types/asset-owner";
import { cn } from "@/lib/utils";

interface Props {
  workspace: AssetOwnerWorkspace;
  onRunMatch: (selectedNames: string[], primaryName: string) => Promise<void>;
  isMatching: boolean;
}

export const SeedSetupSection = ({ workspace, onRunMatch, isMatching }: Props) => {
  const primaryName = workspace.primary_name ?? "";
  const [aliases, setAliases] = useState<string[]>(workspace.abbreviations ?? []);
  const [aliasInput, setAliasInput] = useState("");
  const [branches, setBranches] = useState<Candidate[]>([]);
  const [amcs, setAmcs] = useState<Candidate[]>([]);
  const [checkedBranches, setCheckedBranches] = useState<boolean[]>([]);
  const [amcChecked, setAmcChecked] = useState<boolean[]>([]);
  const [detecting, setDetecting] = useState(false);

  // Auto-detect candidates when component mounts or primaryName changes
  useEffect(() => {
    if (!primaryName.trim()) return;
    let cancelled = false;
    const detect = async () => {
      setDetecting(true);
      const result = await detectCandidates(primaryName);
      if (cancelled) return;
      setBranches(result.branches);
      setAmcs(result.amcs);
      setCheckedBranches(result.branches.map(() => true));
      setAmcChecked(result.amcs.map(() => true));
      setDetecting(false);
    };
    detect();
    return () => { cancelled = true; };
  }, [primaryName]);

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v || aliases.includes(v)) return;
    setAliases((p) => [...p, v]);
    setAliasInput("");
  };

  const checkedCount = checkedBranches.filter(Boolean).length;
  const totalBranchAssets = branches
    .filter((_, i) => checkedBranches[i])
    .reduce((s, b) => s + b.listingCount, 0);

  const handleMatch = async () => {
    const selected = [
      ...branches.filter((_, i) => checkedBranches[i]).map((b) => b.name),
      ...amcs.filter((_, i) => amcChecked[i]).map((a) => a.name),
    ];
    await onRunMatch(selected, primaryName);
  };

  return (
    <Card className="rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-foreground">Xác nhận đơn vị thành viên</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hệ thống đã tự phát hiện chi nhánh từ dữ liệu crawl. Bỏ tick đơn vị không thuộc bạn, rồi chạy khớp.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Tên khớp &gt;90% → tự động claim · 60–90% → bạn xác nhận từng cái · &lt;60% → tìm bổ sung.
        </span>
      </div>

      {/* Primary name — read-only */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          Tên chính thức
          <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <Lock className="h-3 w-3" /> Đã xác thực — không thể thay đổi
          </span>
        </Label>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm font-medium text-foreground">
          {primaryName || "—"}
        </div>
      </div>

      {/* Aliases — editable */}
      <div className="space-y-1.5">
        <Label>Tên viết tắt / Alias <span className="text-muted-foreground font-normal text-xs">(để tìm thêm chi nhánh)</span></Label>
        <div className="flex gap-2">
          <Input
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
            placeholder="VietinBank, NH Công thương, CTG, ..."
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={addAlias}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {aliases.map((a, i) => (
              <Badge key={i} variant="secondary" className="gap-1 pr-1">
                {a}
                <button onClick={() => setAliases((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Branch list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="m-0">Chi nhánh / Đơn vị thành viên</Label>
          <div className="flex items-center gap-1">
            {detecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              tự phát hiện: {branches.length}
            </span>
          </div>
        </div>

        {branches.length > 0 ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button className="text-primary font-semibold hover:underline" onClick={() => setCheckedBranches(branches.map(() => true))}>
                Chọn tất cả
              </button>
              <span>·</span>
              <button className="text-primary font-semibold hover:underline" onClick={() => setCheckedBranches(branches.map(() => false))}>
                Bỏ chọn
              </button>
              <span className="ml-auto">
                đã chọn <strong>{checkedCount}/{branches.length}</strong> · ~{totalBranchAssets} tài sản
              </span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {branches.map((b, i) => (
                <label
                  key={b.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-muted/30 transition-colors",
                    i < branches.length - 1 && "border-b border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary flex-shrink-0"
                    checked={checkedBranches[i] ?? true}
                    onChange={(e) =>
                      setCheckedBranches((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                    }
                  />
                  <span className="flex-1 min-w-0 font-medium text-foreground truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">~{b.listingCount} TS</span>
                  <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">crawl</span>
                </label>
              ))}
            </div>
          </>
        ) : detecting ? (
          <div className="text-xs text-muted-foreground py-2">Đang tìm kiếm chi nhánh...</div>
        ) : primaryName.trim() ? (
          <div className="text-xs text-muted-foreground py-2">
            Không tìm thấy chi nhánh trong dữ liệu crawl. Thêm tên viết tắt ở trên để tìm thêm.
          </div>
        ) : null}
      </div>

      {/* AMC section */}
      {amcs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="m-0">Công ty con / AMC (đại diện xử lý nợ)</Label>
            <span className="text-[11px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
              phát hiện AMC
            </span>
          </div>
          <div className="border border-border rounded-xl overflow-hidden">
            {amcs.map((a, i) => (
              <label
                key={a.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-muted/30 transition-colors",
                  i < amcs.length - 1 && "border-b border-border"
                )}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary flex-shrink-0"
                  checked={amcChecked[i] ?? true}
                  onChange={(e) =>
                    setAmcChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                />
                <span className="flex-1 min-w-0 font-medium text-foreground truncate">{a.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">~{a.listingCount} TS</span>
                <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">đại diện ủy quyền</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            AMC không phải chi nhánh — là công ty con đại diện xử lý nợ. Tài sản qua AMC vẫn thuộc tổ chức của bạn.
          </p>
        </div>
      )}

      <Button
        onClick={handleMatch}
        disabled={!primaryName.trim() || isMatching || detecting}
        className="w-full gap-2"
      >
        {isMatching
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang khớp tài sản...</>
          : <><Search className="h-4 w-4" /> Khớp tài sản</>
        }
      </Button>
    </Card>
  );
};
