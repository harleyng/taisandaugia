import { AdStatusBadge } from "./AdStatusBadge";
import { AdActions } from "./AdActions";
import type { Advertisement } from "@/types/advertising";

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--/--/----";

const devices = (ad: Advertisement) =>
  [ad.show_desktop ? "Desktop" : null, ad.show_mobile ? "Mobile" : null].filter(Boolean).join(", ") || "—";

interface Props {
  ad: Advertisement;
  onView: () => void;
}

export function AdRow({ ad, onView }: Props) {
  return (
    <tr
      onClick={onView}
      className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-xs text-primary group-hover:underline">
          {ad.code ?? `#${ad.id.slice(0, 8).toUpperCase()}`}
        </span>
      </td>
      <td className="px-4 py-3 min-w-0 max-w-xs">
        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:underline">{ad.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{devices(ad)}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
        {ad.position?.name ?? "—"}
        {ad.position?.page?.name && (
          <span className="block text-xs text-muted-foreground">{ad.position.page.name}</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{fmt(ad.created_at)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <AdStatusBadge status={ad.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <AdActions ad={ad} layout="menu" />
      </td>
    </tr>
  );
}
