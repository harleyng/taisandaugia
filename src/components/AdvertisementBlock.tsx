import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatVnd } from "@/lib/advertising/slug";

const DEFAULT_END = new Date("2026-05-24T23:59:59");

function useCountdown(target: Date) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target.getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

interface Props {
  inline?: boolean;
  /** Thời gian kết thúc phiên trả giá (ISO). Không có → dùng mốc mặc định. */
  endsAt?: string | Date | null;
  /** Số người đang trả giá. */
  bidderCount?: number;
  /** Mức giá hiện tại (VND). */
  price?: number | null;
}

export function AdvertisementBlock({ inline = false, endsAt, bidderCount = 0, price }: Props) {
  const target = endsAt ? new Date(endsAt) : DEFAULT_END;
  const { days, hours, minutes, seconds } = useCountdown(target);
  const navigate = useNavigate();
  const pad = (n: number) => String(n).padStart(2, "0");

  const card = (
    <div className="relative rounded-2xl border border-dashed border-primary/40 bg-primary/5 overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-4 px-5 py-5">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-semibold w-fit mx-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Vị trí quảng cáo
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Kết thúc sau
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { value: pad(days), label: "Ngày" },
              { value: pad(hours), label: "Giờ" },
              { value: pad(minutes), label: "Phút" },
              { value: pad(seconds), label: "Giây" },
            ].map(({ value, label }, i, arr) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-lg bg-background border border-border shadow-sm flex items-center justify-center text-sm font-bold tabular-nums">
                    {value}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-0.5">{label}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-muted-foreground font-bold mb-3 text-sm">:</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
            Đã có <strong>{bidderCount} người</strong> trả giá để quảng cáo ở vị trí này
          </p>
          <p className="text-xs text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
            Mức giá hiện tại: <strong className="text-primary">{formatVnd(price ?? 0)}</strong>
          </p>
        </div>

        <Button size="sm" variant="default" className="w-full" onClick={() => navigate("/lien-he")}>
          Liên hệ để trả giá
        </Button>
      </div>
    </div>
  );

  if (inline) return card;

  return (
    <section className="container px-4 py-4 md:py-6">
      {card}
    </section>
  );
}
