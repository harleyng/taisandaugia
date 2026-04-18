import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Lock, TrendingUp, Users, History, Target, ThumbsUp } from "lucide-react";
import { formatPrice } from "@/utils/formatters";

interface AuctionPricePredictionProps {
  listing: any;
  isUnlocked: boolean;
  onUnlock: () => void;
}

// Deterministic hash from id → 0..1
const hashFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h % 1000) / 1000;
};

const competitionLabel = (views: number): { label: string; tone: string } => {
  if (views >= 200) return { label: "Cao", tone: "text-rose-600" };
  if (views >= 50) return { label: "Trung bình", tone: "text-amber-600" };
  return { label: "Thấp", tone: "text-emerald-600" };
};

const recommendationLabel = (confidence: number, competition: string): { label: string; tone: string } => {
  if (confidence >= 80 && competition !== "Cao") return { label: "Nên tham gia", tone: "text-emerald-600" };
  if (confidence < 70) return { label: "Cân nhắc", tone: "text-amber-600" };
  return { label: "Cân nhắc kỹ", tone: "text-amber-600" };
};

export const AuctionPricePrediction = ({ listing, isUnlocked, onUnlock }: AuctionPricePredictionProps) => {
  const ca = listing.custom_attributes || {};
  const seed = hashFromId(listing.id);

  // Mock data — deterministic per listing
  const minMultiplier = 1.1 + seed * 0.05; // 1.10 - 1.15
  const maxMultiplier = 1.22 + seed * 0.08; // 1.22 - 1.30
  const predMin = ca.predicted_price_min ?? Math.round(listing.price * minMultiplier);
  const predMax = ca.predicted_price_max ?? Math.round(listing.price * maxMultiplier);
  const minPct = Math.round((minMultiplier - 1) * 100);
  const maxPct = Math.round((maxMultiplier - 1) * 100);

  const confidence = ca.confidence_score ?? Math.round(65 + seed * 25); // 65-90
  const confidenceLabel = confidence >= 80 ? "Cao" : confidence >= 70 ? "Trung bình" : "Thấp";

  const views = listing.views_count || 0;
  const competition = competitionLabel(views);

  const similarSessions = Math.round(3 + seed * 12); // 3-15
  const successRate = Math.round(50 + seed * 30); // 50-80
  const recommendation = recommendationLabel(confidence, competition.label);

  return (
    <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">Dự đoán giá trúng</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Phân tích dựa trên dữ liệu phiên đấu giá tương tự</p>
        </div>
      </div>

      {/* Predicted price range — large display */}
      <div className="mb-4">
        <div className="text-xs text-muted-foreground mb-1.5">Khoảng giá trúng dự đoán</div>
        {isUnlocked ? (
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary">
              {formatPrice(predMin, "TOTAL")} – {formatPrice(predMax, "TOTAL")}
            </div>
            <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              So với khởi điểm:{" "}
              <span className="font-semibold text-foreground">
                +{minPct}% đến +{maxPct}%
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-2xl md:text-3xl font-bold text-primary blur-md select-none">X.XX tỷ – X.XX tỷ</div>
            <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1 blur-sm select-none">
              <TrendingUp className="h-3.5 w-3.5" />
              So với khởi điểm: +XX% đến +XX%
            </div>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Confidence */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Target className="h-3.5 w-3.5" />
            Độ tin cậy
          </div>
          {isUnlocked ? (
            <>
              <div className="text-sm font-bold text-foreground">
                {confidence}% · {confidenceLabel}
              </div>
              <Progress value={confidence} className="h-1.5 mt-1.5" />
            </>
          ) : (
            <div className="text-sm font-bold blur-sm select-none">XX% · ---</div>
          )}
        </div>

        {/* Competition */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Users className="h-3.5 w-3.5" />
            Mức cạnh tranh
          </div>
          {isUnlocked ? (
            <div className={`text-sm font-bold ${competition.tone}`}>{competition.label}</div>
          ) : (
            <div className="text-sm font-bold blur-sm select-none">-----</div>
          )}
        </div>

        {/* Similar sessions */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <History className="h-3.5 w-3.5" />
            Phiên tương tự
          </div>
          {isUnlocked ? (
            <div className="text-sm font-bold text-foreground">{similarSessions} phiên / 90 ngày</div>
          ) : (
            <div className="text-sm font-bold blur-sm select-none">XX phiên</div>
          )}
        </div>

        {/* Success rate */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <ThumbsUp className="h-3.5 w-3.5" />
            Tỷ lệ thành công
          </div>
          {isUnlocked ? (
            <div className="text-sm font-bold text-foreground">{successRate}% khu vực</div>
          ) : (
            <div className="text-sm font-bold blur-sm select-none">XX%</div>
          )}
        </div>
      </div>

      {/* Recommendation */}
      {isUnlocked && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-4">
          <div className="text-xs text-muted-foreground mb-0.5">Khuyến nghị</div>
          <div className={`text-sm font-bold ${recommendation.tone}`}>{recommendation.label}</div>
        </div>
      )}

      {/* CTA */}
      {!isUnlocked && (
        <Button onClick={onUnlock} className="w-full gap-2">
          <Lock className="h-4 w-4" />
          Mở khóa dự đoán – 59 credit
        </Button>
      )}
    </Card>
  );
};
