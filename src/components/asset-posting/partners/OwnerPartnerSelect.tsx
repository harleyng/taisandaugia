import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuctionOrgDirectory } from "@/hooks/useAuctionOrgDirectory";
import { useEnsureOwnerPartner, useOwnerPartners } from "@/hooks/useOwnerPartners";
import { partnerOptions, type OwnerPartner } from "@/lib/dossier/partners";
import type { DossierKind } from "@/lib/dossier/types";
import { INPUT_BASE, borderClass } from "../fieldStyles";
import { usePartnerScope } from "./partnerScopeContext";

const NOUN: Record<DossierKind, string> = {
  appraisal: "đơn vị thẩm định giá",
  authentication: "đơn vị giám định",
  legal: "đơn vị tư vấn pháp lý",
  auction: "tổ chức đấu giá",
};

interface OwnerPartnerSelectProps {
  kind: DossierKind;
  /** owner_partners.id đang chọn ("" = chưa chọn). */
  partnerId: string;
  /** Tên đang lưu — hiện khi hồ sơ cũ chưa có partnerId. */
  partnerName: string;
  onChange: (partner: OwnerPartner) => void;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Ô chọn "Đối tác riêng": danh bạ đối tác của Trạm / chủ cá nhân theo loại; phần Đấu giá
 * thêm danh bạ tổ chức đấu giá công khai (chọn ⇒ tự thêm vào đối tác của tôi).
 * "+ Thêm đối tác mới" nằm CỐ ĐỊNH dưới đáy (ngoài vùng cuộn): đã gõ tên ⇒ tạo luôn tên đó,
 * chưa gõ ⇒ mở ô nhập tên ngay tại đáy.
 */
export function OwnerPartnerSelect({ kind, partnerId, partnerName, onChange, invalid, disabled, id }: OwnerPartnerSelectProps) {
  const workspaceId = usePartnerScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const { data: partners = [], isLoading } = useOwnerPartners(workspaceId);
  const { data: directory = [] } = useAuctionOrgDirectory();
  const ensure = useEnsureOwnerPartner(workspaceId);

  const opts = useMemo(
    () => partnerOptions(partners, kind, query, kind === "auction" ? directory : []),
    [partners, kind, query, directory],
  );
  const selected = partners.find((p) => p.id === partnerId) ?? null;
  const label = selected?.name ?? partnerName.trim();

  const close = () => {
    setOpen(false);
    setQuery("");
    setAdding(false);
    setNewName("");
  };
  const pick = (p: OwnerPartner) => {
    onChange(p);
    close();
  };
  const create = (args: { name?: string; auctionOrgId?: string }) =>
    ensure.mutate({ kind, ...args }, { onSuccess: pick });

  const typed = query.trim();
  const footer = adding ? (
    <form
      className="flex items-center gap-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (newName.trim()) create({ name: newName.trim() });
      }}
    >
      <input
        autoFocus
        className={`${INPUT_BASE} border-input py-1.5`}
        placeholder={`Tên ${NOUN[kind]} mới`}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        // cmdk bắt phím ở gốc Command (Enter chọn mục đang sáng) ⇒ giữ phím trong ô này.
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") setAdding(false);
        }}
        aria-label={`Tên ${NOUN[kind]} mới`}
      />
      <button
        type="submit"
        disabled={!newName.trim() || ensure.isPending}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {ensure.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Thêm"}
      </button>
    </form>
  ) : (
    <button
      type="button"
      disabled={ensure.isPending || (!!typed && !opts.canAddTyped)}
      onClick={() => (typed ? create({ name: typed }) : setAdding(true))}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:text-muted-foreground"
    >
      {ensure.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      <span className="truncate">
        {typed && opts.canAddTyped ? `Thêm đối tác mới “${typed}”` : typed ? "Đã có trong danh sách" : "Thêm đối tác mới"}
      </span>
    </button>
  );

  const empty = !isLoading && opts.mine.length === 0 && opts.directory.length === 0;

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(INPUT_BASE, borderClass(invalid ? "invalid" : undefined, !!label && !invalid), "flex items-center justify-between text-left")}
        >
          <span className={cn("truncate", !label && "text-muted-foreground/70")}>{label || `Chọn ${NOUN[kind]}`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={`Tìm hoặc nhập tên ${NOUN[kind]}…`} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64">
            {isLoading && <p className="px-3 py-5 text-center text-sm text-muted-foreground">Đang tải…</p>}
            {empty && (
              <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                {typed ? "Không có đối tác nào khớp." : "Chưa có đối tác nào. Thêm đối tác đầu tiên ở dưới."}
              </p>
            )}
            {opts.mine.length > 0 && (
              <CommandGroup heading="Đối tác của tôi">
                {opts.mine.map((p) => (
                  <CommandItem key={p.id} value={p.id} onSelect={() => pick(p)}>
                    <Check className={cn("mr-2 h-4 w-4", p.id === partnerId ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {opts.directory.length > 0 && (
              <CommandGroup heading="Danh bạ tổ chức đấu giá">
                {opts.directory.map((o) => (
                  <CommandItem key={o.id} value={`org:${o.id}`} onSelect={() => create({ auctionOrgId: o.id })}>
                    <span className="ml-6 flex-1 truncate">{o.name}</span>
                    {o.province && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{o.province}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="border-t border-border bg-popover">{footer}</div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
