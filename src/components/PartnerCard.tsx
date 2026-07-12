import { ArrowRight, Star } from "lucide-react";
import type { Partner } from "@/types/partner";
import { PARTNER_COLORS } from "@/lib/partnerTheme";

const C = PARTNER_COLORS;

/** Thẻ đối tác data-driven — dùng ở trang chủ và làm preview trong form admin. */
export function PartnerCard({ partner }: { partner: Partner }) {
  const accent = partner.accent_color || C.navy;
  const stats = partner.stats ?? [];
  const hasBottom = partner.date_label || partner.date_value || (partner.cta_text && partner.cta_href);

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }}
    >
      {/* top meta */}
      {partner.badge && (
        <div className="px-6 pt-5 pb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-widest uppercase"
            style={{ border: `1px solid ${accent}`, color: accent }}
          >
            <Star className="h-2.5 w-2.5 fill-current" />
            {partner.badge}
          </span>
        </div>
      )}

      {/* logo box */}
      <div
        className={`mx-6 mb-6 flex items-center justify-center ${partner.badge ? "" : "mt-6"}`}
        style={{ background: C.bg, border: `1px solid ${C.border}`, height: 140 }}
      >
        {partner.logo_url ? (
          <img
            src={partner.logo_url}
            alt={partner.name}
            className="max-h-14 max-w-[200px] object-contain"
            style={partner.logo_filter ? { filter: partner.logo_filter } : undefined}
          />
        ) : (
          <span className="text-lg font-serif" style={{ color: C.ink }}>{partner.name || "Tên đối tác"}</span>
        )}
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 px-6 pb-6 gap-3">
        <div>
          <p className="text-xl font-serif" style={{ color: C.ink }}>{partner.name || "Tên đối tác"}</p>
          {partner.tagline && (
            <p className="text-sm italic font-serif mt-0.5" style={{ color: C.muted }}>{partner.tagline}</p>
          )}
        </div>

        {partner.description && (
          <p className="text-sm leading-relaxed" style={{ color: "#5a5048" }}>{partner.description}</p>
        )}

        {/* stats */}
        {stats.length > 0 && (
          <div
            className="grid gap-x-4 gap-y-3 py-4 mt-1"
            style={{
              gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
              borderTop: `1px solid ${C.border}`,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {stats.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex flex-col gap-1">
                <span className="text-[9px] tracking-widest uppercase" style={{ color: C.muted }}>{s.label}</span>
                <span className="text-base font-bold" style={{ color: C.ink }}>{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* bottom row */}
        {hasBottom && (
          <div className="flex items-end justify-between mt-auto pt-2">
            <div>
              {partner.date_label && (
                <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>{partner.date_label}</p>
              )}
              {partner.date_value && (
                <p className="text-base font-bold tracking-wider" style={{ color: C.ink }}>{partner.date_value}</p>
              )}
            </div>
            {partner.cta_text && partner.cta_href && (
              <a
                href={partner.cta_href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity shrink-0"
                style={{ color: accent }}
              >
                {partner.cta_text} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
