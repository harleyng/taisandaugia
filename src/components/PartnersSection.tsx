import { useState, useEffect } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { usePublicPartners } from "@/hooks/usePartners";
import { PartnerCard } from "@/components/PartnerCard";
import { PARTNER_COLORS } from "@/lib/partnerTheme";

/* ── palette ── */
const C = PARTNER_COLORS;

/* ── countdown ── */
const DEADLINE = new Date("2026-06-30T23:59:59");
function getTimeLeft() {
  const d = Math.max(0, DEADLINE.getTime() - Date.now());
  return {
    days:    Math.floor(d / 86_400_000),
    hours:   Math.floor((d % 86_400_000) / 3_600_000),
    minutes: Math.floor((d % 3_600_000)  / 60_000),
    seconds: Math.floor((d % 60_000)     / 1_000),
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

/* ── ad slot card (static, always last) ── */
function AdSlotCard() {
  const [time, setTime] = useState(getTimeLeft);
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }}
    >
      {/* top meta */}
      <div className="px-6 pt-5 pb-4">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-widest uppercase"
          style={{ border: `1px solid ${C.gold}`, color: C.gold }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.gold }} />
          Vị trí quảng cáo
        </span>
      </div>

      {/* countdown box */}
      <div
        className="mx-6 mb-6 flex flex-col items-center justify-center gap-3"
        style={{ background: C.bg, border: `1px solid ${C.border}`, height: 140 }}
      >
        <div className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase" style={{ color: C.muted }}>
          <Clock className="h-3 w-3" /> Kết thúc sau
        </div>
        <div className="flex items-end gap-1 tabular-nums">
          {[
            { v: time.days,    l: "Ngày" },
            { v: time.hours,   l: "Giờ" },
            { v: time.minutes, l: "Phút" },
            { v: time.seconds, l: "Giây" },
          ].map((u, i) => (
            <div key={u.l} className="flex items-end gap-1">
              {i > 0 && (
                <span className="text-xl font-light mb-3" style={{ color: C.gold }}>:</span>
              )}
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black leading-none" style={{ color: C.ink }}>{pad(u.v)}</span>
                <span className="text-[9px] tracking-widest uppercase mt-1" style={{ color: C.muted }}>{u.l}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 px-6 pb-6 gap-3">
        <div>
          <p className="text-xl font-serif" style={{ color: C.ink }}>Trở thành đối tác</p>
          <p className="text-sm italic font-serif mt-0.5" style={{ color: C.muted }}>Vị trí đối tác chiến lược 2026</p>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: "#5a5048" }}>
          Tiếp cận hàng chục nghìn nhà đầu tư bất động sản trên nền tảng đấu giá hàng đầu. Vị trí độc quyền theo quý.
        </p>

        {/* bottom */}
        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>Mức giá hiện tại</p>
            <p className="text-base font-bold tracking-wider" style={{ color: C.ink }}>200.000.000 đ</p>
          </div>
          <Link
            to="/lien-he"
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity shrink-0"
            style={{ color: C.gold }}
          >
            Liên hệ ngay <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── section ── */
export function PartnersSection() {
  const { data: partners, isLoading } = usePublicPartners();

  const navBtn = "static translate-y-0 h-9 w-9";

  return (
    <section style={{ background: C.bg }} className="py-12 md:py-16">
      <div className="container px-4">
        <Carousel opts={{ align: "start" }}>
          {/* ── header ── */}
          <div className="mb-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 text-[10px] tracking-widest uppercase mb-4" style={{ color: C.muted }}>
                  <span style={{ display: "inline-block", width: 32, height: 1, background: C.muted }} />
                  2026 · Đối tác chiến lược
                </div>

                <h2
                  className="text-3xl md:text-4xl lg:text-[2.75rem] font-serif leading-tight max-w-xl"
                  style={{ color: C.ink }}
                >
                  Đồng hành cùng{" "}
                  <em className="italic not-italic" style={{ color: C.red, fontStyle: "italic" }}>những thương hiệu</em>
                  <br />định hình thị trường đấu giá.
                </h2>
              </div>

              {/* slider controls */}
              <div className="hidden md:flex items-center gap-2 shrink-0 pt-1">
                <CarouselPrevious className={navBtn} />
                <CarouselNext className={navBtn} />
              </div>
            </div>

            <div className="mt-8" style={{ borderTop: `1px solid ${C.border}` }} />
          </div>

          {/* ── slider ── */}
          <CarouselContent className="items-stretch">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <CarouselItem key={`sk-${i}`} className="basis-full md:basis-1/2 lg:basis-1/3">
                  <div className="h-[420px] animate-pulse" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }} />
                </CarouselItem>
              ))}

            {!isLoading &&
              (partners ?? []).map((p) => (
                <CarouselItem key={p.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                  <PartnerCard partner={p} />
                </CarouselItem>
              ))}

            {/* Vị trí quảng cáo — luôn ở cuối */}
            <CarouselItem className="basis-full md:basis-1/2 lg:basis-1/3">
              <AdSlotCard />
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
