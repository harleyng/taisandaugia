import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  name: string;
  address: string | null;
}

interface Props {
  workspaceId: string;
  onClaimed: () => void;
}

export const ManualClaimSearch = ({ workspaceId, onClaimed }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) { toast.error("Nhập ít nhất 2 ký tự"); return; }
    setIsSearching(true);
    const { data } = await supabase
      .from("asset_owners")
      .select("id, name, address")
      .ilike("name", `%${query.trim()}%`)
      .limit(10);
    setResults((data ?? []) as SearchResult[]);
    setIsSearching(false);
    if (!data?.length) toast.info("Không tìm thấy chủ tài sản phù hợp");
  };

  const handleClaim = async (owner: SearchResult) => {
    setClaiming(owner.id);
    // Get listings linked to this asset_owner
    const { data: listings } = await supabase
      .from("listings")
      .select("id")
      .eq("asset_owner_id", owner.id);

    const toInsert = (listings ?? []).map((l) => ({
      workspace_id: workspaceId,
      listing_id: l.id,
      asset_owner_id: owner.id,
      confidence_score: 1.0,
      match_basis: "manual_search" as const,
      matched_name: owner.name,
      status: "pending_confirmation" as const,
    }));

    if (toInsert.length === 0) {
      // Claim the owner entity directly even if no linked listings yet
      toInsert.push({
        workspace_id: workspaceId,
        listing_id: null,
        asset_owner_id: owner.id,
        confidence_score: 1.0,
        match_basis: "manual_search" as const,
        matched_name: owner.name,
        status: "pending_confirmation" as const,
      });
    }

    const { error } = await supabase
      .from("asset_owner_claims")
      .upsert(toInsert, { onConflict: "workspace_id,listing_id", ignoreDuplicates: true });

    if (error) {
      toast.error("Thêm thất bại");
    } else {
      toast.success(`Đã thêm ${toInsert.length} tài sản vào hàng đợi xác nhận`);
      onClaimed();
    }
    setClaiming(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          placeholder="Tên tổ chức, ngân hàng..."
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={handleSearch} disabled={isSearching} className="gap-1.5">
          <Search className="h-4 w-4" />
          {isSearching ? "..." : "Tìm"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                {r.address && <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 flex-shrink-0"
                onClick={() => handleClaim(r)}
                disabled={claiming === r.id}
              >
                <Plus className="h-3 w-3" />
                Thêm
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
