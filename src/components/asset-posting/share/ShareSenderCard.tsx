import { useState } from "react";
import { ArrowLeftRight, Check, Loader2, Phone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ShareSender } from "@/lib/postingShare/types";

interface ShareSenderCardProps {
  senders: ShareSender[];
  value: string | null;
  onChange: (userId: string | null) => void;
  currentUserId: string | null;
  loading: boolean;
  disabled: boolean;
  invalid: boolean;
}

const initials = (s: ShareSender) =>
  (s.name || s.email)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Người gửi + SĐT trong một thẻ; nút biểu tượng mở danh sách thành viên để đổi người gửi. */
export function ShareSenderCard({ senders, value, onChange, currentUserId, loading, disabled, invalid }: ShareSenderCardProps) {
  const [open, setOpen] = useState(false);
  const sender = senders.find((s) => s.userId === value) ?? null;

  const pick = (userId: string | null) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border px-3 py-2.5",
        invalid && "border-destructive",
      )}
    >
      {sender ? (
        <>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(sender)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {sender.name || sender.email}
              {sender.userId === currentUserId && <span className="font-normal text-muted-foreground"> (bạn)</span>}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              <span className="tabular-nums">{sender.phone ?? "Chưa có SĐT"}</span>
              {sender.roleName && <span className="truncate"> · {sender.roleName}</span>}
            </p>
          </div>
        </>
      ) : (
        <p className="flex-1 text-sm text-muted-foreground">
          {loading ? "Đang tải thành viên…" : "Chưa chọn người gửi"}
        </p>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={disabled || loading}
            aria-label={sender ? "Đổi người gửi" : "Chọn người gửi"}
            title={sender ? "Đổi người gửi" : "Chọn người gửi"}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sender ? (
              <ArrowLeftRight className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Tìm thành viên…" />
            <CommandList>
              <CommandEmpty>Không tìm thấy thành viên.</CommandEmpty>
              <CommandGroup>
                {senders.map((s) => (
                  <CommandItem
                    key={s.userId}
                    value={`${s.name ?? ""} ${s.email} ${s.phone ?? ""}`}
                    onSelect={() => pick(s.userId)}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", s.userId === value ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="truncate">
                        {s.name || s.email}
                        {s.userId === currentUserId && " (bạn)"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[s.phone ?? "Chưa có SĐT", s.roleName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </CommandItem>
                ))}
                {value && (
                  <CommandItem value="__none__ khong ghi nguoi gui" onSelect={() => pick(null)}>
                    <span className="ml-6 text-muted-foreground">Không ghi người gửi</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
