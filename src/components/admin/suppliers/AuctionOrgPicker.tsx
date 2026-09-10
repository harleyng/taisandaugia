import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface AuctionOrgRow {
  id: string;
  name: string;
  province: string | null;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
}

function useAuctionOrgs() {
  return useQuery<AuctionOrgRow[]>({
    queryKey: ["auction-orgs", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auction_organizations")
        .select("id,name,province")
        .order("name");
      if (error) throw error;
      return (data ?? []) as AuctionOrgRow[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Tổ chức đã có tài khoản KYC duyệt — dùng lại hàm sẵn có của luồng ký gửi. */
function useAccountedOrgIds() {
  return useQuery<Set<string>>({
    queryKey: ["auction-orgs", "accounted"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("accounted_auction_org_ids");
      if (error) throw error;
      const ids = (data ?? []) as (string | { accounted_auction_org_ids: string })[];
      return new Set(
        ids.map((r) => (typeof r === "string" ? r : r.accounted_auction_org_ids)),
      );
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Chọn tổ chức đấu giá để gắn vào hồ sơ đối tác.
 *
 * Mặc định chỉ hiện tổ chức ĐÃ CÓ TÀI KHOẢN duyệt KYC — đó là tập sẽ thực sự
 * nhận được yêu cầu ký gửi. Nhưng KHÔNG khoá cứng: ký hợp đồng với công ty chưa
 * onboard là chuyện bình thường, nên có công tắc mở rộng ra toàn danh bạ.
 */
export function AuctionOrgPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [onlyAccounted, setOnlyAccounted] = useState(true);
  const { data: orgs, isLoading } = useAuctionOrgs();
  const { data: accounted } = useAccountedOrgIds();

  const selected = useMemo(
    () => (orgs ?? []).find((o) => o.id === value) ?? null,
    [orgs, value],
  );

  const list = useMemo(() => {
    const all = orgs ?? [];
    if (!onlyAccounted || !accounted) return all;
    // Giữ lại tổ chức đang được chọn dù nó không thuộc tập lọc, nếu không thì
    // mở form ra sẽ thấy ô trống như thể liên kết đã mất.
    return all.filter((o) => accounted.has(o.id) || o.id === value);
  }, [orgs, accounted, onlyAccounted, value]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.name : "Chưa gắn tổ chức đấu giá"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Tìm tổ chức đấu giá…" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Đang tải…" : "Không tìm thấy tổ chức nào"}
              </CommandEmpty>
              <CommandGroup>
                {list.map((org) => (
                  <CommandItem
                    key={org.id}
                    value={org.name}
                    onSelect={() => {
                      onChange(org.id === value ? null : org.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        org.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.province && (
                      <span className="ml-2 text-xs text-muted-foreground shrink-0">
                        {org.province}
                      </span>
                    )}
                    {accounted?.has(org.id) && (
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        Có tài khoản
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="only-accounted"
            checked={onlyAccounted}
            onCheckedChange={setOnlyAccounted}
          />
          <Label htmlFor="only-accounted" className="text-xs font-normal text-muted-foreground">
            Chỉ tổ chức đã có tài khoản
          </Label>
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3 mr-1" />
            Bỏ gắn
          </Button>
        )}
      </div>
    </div>
  );
}
