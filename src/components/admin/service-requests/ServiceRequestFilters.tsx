import { Search, Settings2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICE_GROUPS } from "@/lib/serviceRequests/groups";
import type { ServiceKind } from "@/lib/serviceRequests/kinds";

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{n}</span>;
}

/** Bộ lọc loại dịch vụ (lọc theo quyền) · nhóm trạng thái chung · tìm kiếm · lối vào cài đặt giám định. */
export function ServiceRequestFilters({
  kinds,
  kind,
  group,
  q,
  settings,
  showSettings,
  kindCount,
  groupCount,
  onChange,
}: {
  kinds: ServiceKind[];
  kind: string;
  group: string;
  q: string;
  settings: boolean;
  showSettings: boolean;
  kindCount: (key: string) => number;
  groupCount: (key: string) => number;
  onChange: (patch: Partial<Record<"loai" | "nhom" | "q" | "xem", string>>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!settings && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Tìm theo mã, tài sản, chuyên gia, đối tác…"
            className="h-9 w-72 rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15"
          />
        </div>
      )}

      {kinds.length > 1 && (
        <Select value={kind} onValueChange={(v) => onChange({ loai: v, xem: "" })}>
          <SelectTrigger className="h-9 w-56" aria-label="Loại dịch vụ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Tất cả loại dịch vụ
              <Count n={kindCount("all")} />
            </SelectItem>
            {kinds.map((k) => (
              <SelectItem key={k.key} value={k.key}>
                <span className="flex items-center gap-1.5">
                  <k.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {k.label}
                  <Count n={kindCount(k.key)} />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!settings && (
        <Select value={group} onValueChange={(v) => onChange({ nhom: v })}>
          <SelectTrigger className="h-9 w-52" aria-label="Trạng thái">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Tất cả trạng thái
              <Count n={groupCount("all")} />
            </SelectItem>
            {SERVICE_GROUPS.map((g) => (
              <SelectItem key={g.key} value={g.key}>
                {g.label}
                <Count n={groupCount(g.key)} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showSettings && (
        <button
          onClick={() => onChange({ xem: settings ? "" : "cai-dat" })}
          className={[
            "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors",
            settings
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Settings2 className="h-3.5 w-3.5" /> Cài đặt giám định
        </button>
      )}
    </div>
  );
}
