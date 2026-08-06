import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Info, Lock, X, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import { useAliasSuggestion } from "@/hooks/useProspects";
import type { AssetOwnerWorkspace } from "@/types/asset-owner";

interface Props {
  workspace: AssetOwnerWorkspace;
  userId: string | null;
}

/** Sửa alias & đơn vị thành viên, rồi khớp lại tài sản.
 *
 *  Trước đây đây là bước BẮT BUỘC trong onboarding (Tier-2). Nay việc khớp chạy
 *  tự động phía server ngay khi hồ sơ được duyệt, nên màn này chỉ còn là công cụ
 *  tinh chỉnh — dùng khi tổ chức có chi nhánh/AMC mà tên gọi quá khác biệt. */
export function WorkspaceAliasPanel({ workspace, userId }: Props) {
  const { updateSeeds, runMatch } = useAssetOwnerWorkspace(userId);
  const primaryName = workspace.primary_name ?? "";

  const [aliases, setAliases] = useState<string[]>(workspace.abbreviations ?? []);
  const [aliasInput, setAliasInput] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const { data: suggestion, isFetching } = useAliasSuggestion(primaryName);

  // Ứng viên chi nhánh/AMC do server gợi ý; loại chính pháp nhân gốc ra.
  const candidates = useMemo(
    () => (suggestion?.candidates ?? []).filter((c) => c.name !== primaryName),
    [suggestion, primaryName],
  );

  // Mặc định tick những đơn vị đã nằm sẵn trong branch_names.
  useEffect(() => {
    if (!candidates.length) return;
    setChecked((prev) => {
      if (Object.keys(prev).length) return prev;
      const saved = new Set(workspace.branch_names ?? []);
      return Object.fromEntries(candidates.map((c) => [c.name, saved.size === 0 || saved.has(c.name)]));
    });
  }, [candidates, workspace.branch_names]);

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v || aliases.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    setAliases((p) => [...p, v]);
    setAliasInput("");
  };

  const applySuggested = (a: string) => {
    if (aliases.some((x) => x.toLowerCase() === a.toLowerCase())) return;
    setAliases((p) => [...p, a]);
  };

  const selectedNames = candidates.filter((c) => checked[c.name]).map((c) => c.name);
  const selectedAssets = candidates
    .filter((c) => checked[c.name])
    .reduce((s, c) => s + c.listing_count, 0);

  const unusedSuggestions = (suggestion?.aliases ?? []).filter(
    (a) => !aliases.some((x) => x.toLowerCase() === a.toLowerCase()),
  );

  const isBusy = updateSeeds.isPending || runMatch.isPending;

  const handleMatch = async () => {
    await updateSeeds.mutateAsync({
      primary_name: primaryName,
      abbreviations: aliases,
      branch_names: selectedNames,
    });
    await runMatch.mutateAsync();
  };

  return (
    <Card className="rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-foreground">Alias &amp; đơn vị thành viên</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tài sản của bạn đã được khớp tự động khi hồ sơ được duyệt. Chỉ cần dùng màn này khi muốn
          bổ sung tên gọi khác hoặc đơn vị thành viên để tìm thêm tài sản.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Tên khớp &gt;90% → tự động nhận · 60–90% → bạn xác nhận từng cái ở mục Tài sản ·
          &lt;60% → bỏ qua.
        </span>
      </div>

      {/* Tên chính thức — khoá */}
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

      {/* Alias */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          Tên viết tắt / Alias
          {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </Label>
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
              <Badge key={`${a}-${i}`} variant="secondary" className="gap-1 pr-1">
                {a}
                <button
                  type="button"
                  onClick={() => setAliases((p) => p.filter((_, j) => j !== i))}
                  className="hover:text-destructive"
                  aria-label={`Xoá alias ${a}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Gợi ý:
            </span>
            {unusedSuggestions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => applySuggested(a)}
                className="text-[11px] rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-primary hover:bg-primary/5"
              >
                + {a}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Đơn vị thành viên */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="m-0">Chi nhánh / Đơn vị thành viên</Label>
          <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
            tự phát hiện: {candidates.length}
          </span>
        </div>

        {candidates.length > 0 ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                className="text-primary font-semibold hover:underline"
                onClick={() => setChecked(Object.fromEntries(candidates.map((c) => [c.name, true])))}
              >
                Chọn tất cả
              </button>
              <span>·</span>
              <button
                className="text-primary font-semibold hover:underline"
                onClick={() => setChecked(Object.fromEntries(candidates.map((c) => [c.name, false])))}
              >
                Bỏ chọn
              </button>
              <span className="ml-auto">
                đã chọn <strong>{selectedNames.length}/{candidates.length}</strong> · ~{selectedAssets} tài sản
              </span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {candidates.map((c, i) => (
                <label
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-muted/30 transition-colors",
                    i < candidates.length - 1 && "border-b border-border",
                  )}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary flex-shrink-0"
                    checked={checked[c.name] ?? false}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [c.name]: e.target.checked }))
                    }
                  />
                  <span className="flex-1 min-w-0 font-medium text-foreground truncate">{c.name}</span>
                  {c.is_amc && (
                    <Badge variant="outline" className="flex-shrink-0 text-[10px]">AMC</Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex-shrink-0">~{c.listing_count} TS</span>
                </label>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground">
              AMC không phải chi nhánh — là công ty con đại diện xử lý nợ. Tài sản qua AMC vẫn thuộc
              tổ chức của bạn.
            </p>
          </>
        ) : isFetching ? (
          <div className="text-xs text-muted-foreground py-2">Đang tìm kiếm đơn vị thành viên...</div>
        ) : (
          <div className="text-xs text-muted-foreground py-2">
            Không tìm thấy đơn vị thành viên nào khác trong dữ liệu sàn. Thêm tên viết tắt ở trên để
            mở rộng phạm vi tìm.
          </div>
        )}
      </div>

      <Button onClick={handleMatch} disabled={!primaryName.trim() || isBusy} className="w-full gap-2">
        {isBusy
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang khớp tài sản...</>
          : <><Search className="h-4 w-4" /> Lưu &amp; khớp lại tài sản</>}
      </Button>
    </Card>
  );
}
