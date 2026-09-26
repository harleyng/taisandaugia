import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Sparkles, Loader2 } from "lucide-react";
import { useAliasSuggestion } from "@/hooks/useProspects";

interface Props {
  orgName: string;
  aliases: string[];
  onChange: (aliases: string[]) => void;
}

/**
 * Tên viết tắt / thường gọi của hồ sơ tổ chức — gợi ý tự động từ tên, user sửa
 * được. Khi duyệt, danh sách chảy vào asset_owner_workspaces.abbreviations để khớp
 * tài sản theo tên. Hồ sơ CHI NHÁNH không dùng ô này: Trạm của chi nhánh khớp theo
 * đúng thực thể, và gợi ý cho tên chi nhánh luôn chứa tên công ty mẹ.
 */
export const OrgAliasesField = ({ orgName, aliases, onChange }: Props) => {
  const [aliasInput, setAliasInput] = useState("");

  // Debounce tên tổ chức trước khi hỏi gợi ý — tránh gọi RPC mỗi lần gõ phím.
  const [debouncedName, setDebouncedName] = useState(orgName);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(orgName), 500);
    return () => clearTimeout(t);
  }, [orgName]);

  const { data: suggestion, isFetching } = useAliasSuggestion(debouncedName);

  // Tự điền alias gợi ý MỘT lần cho mỗi tên tổ chức. Sau đó user toàn quyền
  // thêm/xoá — không ghi đè lựa chọn của họ khi component re-render.
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!suggestion?.aliases?.length) return;
    if (appliedFor.current === debouncedName) return;
    appliedFor.current = debouncedName;
    const merged = [...aliases];
    for (const a of suggestion.aliases) {
      if (!merged.some((x) => x.toLowerCase() === a.toLowerCase())) merged.push(a);
    }
    if (merged.length !== aliases.length) onChange(merged);
  }, [suggestion, debouncedName]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedSet = useMemo(
    () => new Set((suggestion?.aliases ?? []).map((a) => a.toLowerCase())),
    [suggestion],
  );

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v || aliases.some((a) => a.toLowerCase() === v.toLowerCase())) return;
    onChange([...aliases, v]);
    setAliasInput("");
  };

  const removeAlias = (i: number) => {
    onChange(aliases.filter((_, j) => j !== i));
  };

  const foundCount = suggestion?.total_listings ?? 0;

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        Tên viết tắt / Tên thường gọi
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
        <Button type="button" variant="outline" size="icon" onClick={addAlias} aria-label="Thêm alias">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {aliases.map((a, i) => {
            const isSuggested = suggestedSet.has(a.toLowerCase());
            return (
              <Badge
                key={`${a}-${i}`}
                variant={isSuggested ? "outline" : "secondary"}
                className="gap-1 pr-1"
              >
                {isSuggested && <Sparkles className="h-3 w-3 text-primary" />}
                {a}
                <button
                  type="button"
                  onClick={() => removeAlias(i)}
                  className="hover:text-destructive"
                  aria-label={`Xoá alias ${a}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary inline mr-0.5 align-[-2px]" />
        Hệ thống tự gợi ý từ tên tổ chức — bạn có thể xoá hoặc thêm. Danh sách này giúp chúng tôi
        tự tìm và gán tài sản của bạn ngay khi hồ sơ được duyệt.
      </p>

      {foundCount > 0 && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground">
          Hệ thống đã tìm thấy <strong>{foundCount} tài sản</strong> trên sàn có thể thuộc về tổ
          chức của bạn. Chúng sẽ tự động xuất hiện trong danh mục sau khi hồ sơ được duyệt.
        </div>
      )}
    </div>
  );
};
