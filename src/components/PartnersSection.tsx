import { useState, useEffect, type ReactNode } from "react";
import { ArrowRight, Star, Clock, Users, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import logoAnti from "@/assets/logo-anti.png";
import logoMarathon from "@/assets/logo-marathon.png";

/* ── palette ── */
const C = {
  bg: "#f4faf4",
  card: "#ffffff",
  border: "#d0e8d1",
  ink: "#0f1f10",
  muted: "#5a7a5b",
  gold: "#367639",   // primary green — ad slot badge / countdown accent
  red: "#DA2128",    // secondary red — italic headline / Antiquorum accent
  navy: "#367639",   // primary green — ZAHA badge
};

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

/* ── shared card shell ── */
function PartnerCard({
  badge, badgeEn, logoNode, name, tagline, description, stats,
  dateLabel, date, ctaText, ctaHref, accentColor,
}: {
  badge: string; logoNode: ReactNode;
  name: string; tagline: string; description: string;
  stats: { label: string; value: string }[];
  dateLabel: string; date: string;
  ctaText: string; ctaHref: string; accentColor: string;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 2 }}
    >
      {/* top meta */}
      <div className="px-6 pt-5 pb-4">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold tracking-widest uppercase"
          style={{ border: `1px solid ${accentColor}`, color: accentColor }}
        >
          <Star className="h-2.5 w-2.5 fill-current" />
          {badge}
        </span>
      </div>

      {/* logo box */}
      <div
        className="mx-6 mb-6 flex items-center justify-center"
        style={{ background: C.bg, border: `1px solid ${C.border}`, height: 140 }}
      >
        {logoNode}
      </div>

      {/* body */}
      <div className="flex flex-col flex-1 px-6 pb-6 gap-3">
        <div>
          <p className="text-xl font-serif" style={{ color: C.ink }}>{name}</p>
          <p className="text-sm italic font-serif mt-0.5" style={{ color: C.muted }}>{tagline}</p>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: "#5a5048" }}>{description}</p>

        {/* stats */}
        <div
          className="grid gap-x-4 gap-y-3 py-4 mt-1"
          style={{
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            borderTop: `1px solid ${C.border}`,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-[9px] tracking-widest uppercase" style={{ color: C.muted }}>{s.label}</span>
              <span className="text-base font-bold" style={{ color: C.ink }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* bottom row */}
        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>{dateLabel}</p>
            <p className="text-base font-bold tracking-wider" style={{ color: C.ink }}>{date}</p>
          </div>
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-60 transition-opacity"
            style={{ color: C.ink }}
          >
            {ctaText} <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── ad slot card ── */
function AdSlotCard() {
  const [time, setTime] = useState(getTimeLeft);
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex flex-col"
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

        {/* stats */}
        <div
          className="grid grid-cols-3 gap-x-4 gap-y-3 py-4 mt-1"
          style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
        >
          {[
            { label: "Lượt xem/tháng", value: "80K+" },
            { label: "Nhà đầu tư",     value: "12K+" },
            { label: "Quan tâm",       value: "6" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-[9px] tracking-widest uppercase" style={{ color: C.muted }}>{s.label}</span>
              <span className="text-base font-bold" style={{ color: C.ink }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* bottom */}
        <div className="flex items-end justify-between mt-auto pt-2">
          <div>
            <p className="text-[9px] tracking-widest uppercase mb-1" style={{ color: C.muted }}>Mức giá hiện tại</p>
            <p className="text-base font-bold tracking-wider" style={{ color: C.ink }}>200.000.000 đ</p>
          </div>
          <Link
            to="/lien-he"
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-60 transition-opacity"
            style={{ color: C.ink }}
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
  return (
    <section style={{ background: C.bg }} className="py-12 md:py-16">
      <div className="container px-4">

        {/* ── header ── */}
        <div className="mb-10">
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

          <div className="mt-8" style={{ borderTop: `1px solid ${C.border}` }} />
        </div>

        {/* ── cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">

          <PartnerCard
            badge="Đối tác toàn cầu"
            accentColor={C.red}
            logoNode={
              <img src={logoAnti} alt="Antiquorum" className="max-h-14 max-w-[200px] object-contain" />
            }
            name="Antiquorum"
            tagline="Important Modern & Vintage Timepieces"
            description="Nhà đấu giá đồng hồ độc lập lâu đời bậc nhất thế giới. Mỗi phiên Antiquorum quy tụ hàng trăm lô hiện vật được giám định bởi các chuyên gia hàng đầu — từ Patek Philippe complications đến những độc bản Rolex hiếm thấy."
            stats={[
              { label: "Năm thành lập", value: "1974" },
              { label: "Phiên/năm",     value: "12+" },
              { label: "Văn phòng",     value: "3 châu lục" },
            ]}
            dateLabel="Phiên Hong Kong"
            date="31 · 05 · 2026"
            ctaText="Khám phá phiên đấu giá"
            ctaHref="https://antiquorum.swiss"
          />

          <PartnerCard
            badge="Đối tác cộng đồng"
            accentColor={C.navy}
            logoNode={
              <div className="flex flex-col items-center gap-1">
                <img src={logoMarathon} alt="ZAHA Legacy Marathon" className="max-h-12 max-w-[180px] object-contain" style={{ filter: "brightness(0) saturate(100%) invert(16%) sepia(64%) saturate(726%) hue-rotate(196deg) brightness(94%) contrast(94%)" }} />
              </div>
            }
            name="ZAHA Legacy Marathon"
            tagline="Giải chạy Việt Nam Tôi đó"
            description="Giải chạy thường niên quy mô toàn quốc với các cự ly 2.9km, 9.2km, 21km và bán-marathon đầy đủ 42km. Mỗi bước chạy là một câu chuyện — về di sản, sức bền, và lòng tự hào dân tộc."
            stats={[
              { label: "Cự ly",          value: "4 chặng" },
              { label: "Vận động viên",  value: "12.000+" },
              { label: "Mùa giải",       value: "Lần thứ 5" },
            ]}
            dateLabel="Ngày khởi tranh"
            date="23 · 08 · 2026"
            ctaText="Đăng ký giải chạy"
            ctaHref="https://facebook.com/vntoido"
          />

          <AdSlotCard />
        </div>


      </div>
    </section>
  );
}
