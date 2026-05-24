import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ChevronDown, ChevronUp, MapPin, FileText, StickyNote, Layers, Maximize2, Scale, Wrench, Gavel, ArrowUpDown } from "lucide-react";
import { formatPrice, formatAreaM2 } from "@/utils/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface AuctionAsset {
  title?: string
  description?: string
  category?: string
  quantity?: number
  area?: number
  location?: string
  legal_status?: string
  condition?: string
  notes?: string
  starting_price?: number
  deposit_amount?: number
  document_fee?: number
  bid_step?: number
  winning_price?: number | null
  auction_format?: string
  bidding_method?: string
}

interface PriceCell {
  label: string
  value: string
  highlight?: boolean
  locked?: boolean
  onLockedClick?: () => void
}

function PriceGrid({
  asset,
  isUnlocked,
  isLoggedIn,
  onLockedClick,
  onLoginClick,
  showResult = true,
}: {
  asset: AuctionAsset
  isUnlocked: boolean
  isLoggedIn: boolean
  onLockedClick?: () => void
  onLoginClick?: () => void
  showResult?: boolean
}) {
  const fmt = (v: number | undefined | null) =>
    v != null ? formatPrice(v, "TOTAL") : "–"

  const cells: Array<{
    label: string
    value: string
    loginRequired?: boolean
    gated?: boolean
    highlight?: boolean
  }> = [
    { label: "Khởi điểm", value: fmt(asset.starting_price) },
    { label: "Đặt trước", value: fmt(asset.deposit_amount) },
    { label: "Hồ sơ", value: fmt(asset.document_fee), loginRequired: true },
    { label: "Bước giá", value: fmt(asset.bid_step), loginRequired: true },
    ...(showResult ? [{ label: "Giá trúng", value: fmt(asset.winning_price), gated: true, highlight: true }] : []),
  ]

  return (
    <div className={`grid border border-border rounded-xl overflow-hidden ${showResult ? 'grid-cols-3 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
      {cells.map((cell, i) => {
        const noData = cell.value === "–"
        const hidden =
          !noData &&
          ((cell.gated && !isUnlocked) || (cell.loginRequired && !isLoggedIn))

        return (
          <div
            key={cell.label}
            className={[
              i < cells.length - 1 ? "border-r border-border" : "",
              showResult ? (i >= 3 ? "border-t lg:border-t-0 border-border" : "") : (i >= 2 ? "border-t lg:border-t-0 border-border" : ""),
            ].join(" ")}
          >
            {hidden ? (
              <button
                type="button"
                onClick={isLoggedIn ? onLockedClick : onLoginClick}
                className={`flex flex-col items-center text-center px-2 py-3 w-full h-full hover:bg-primary/10 transition-colors ${cell.highlight ? "bg-primary/5" : ""}`}
              >
                <span className="text-xs text-muted-foreground mb-1">{cell.label}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                  <Lock className="w-3.5 h-3.5" />
                  Đăng nhập
                </span>
              </button>
            ) : (
              <div className={`flex flex-col items-center text-center px-2 py-3 ${cell.highlight ? "bg-primary/5" : ""}`}>
                <span className="text-xs text-muted-foreground mb-1">{cell.label}</span>
                <span className={`text-sm font-bold ${cell.highlight ? "text-primary" : "text-foreground"}`}>
                  {cell.value}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface AuctionAssetCardProps {
  asset: AuctionAsset
  index: number
  defaultOpen?: boolean
  isUnlocked: boolean
  isLoggedIn: boolean
  showResult?: boolean
  onLockedClick?: () => void
  onLoginClick?: () => void
}

export function AuctionAssetCard({
  asset,
  index,
  defaultOpen = true,
  isUnlocked,
  isLoggedIn,
  showResult = true,
  onLockedClick,
  onLoginClick,
}: AuctionAssetCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  const areaText = asset.area ? formatAreaM2(asset.area) : null

  const metaItems = [
    asset.quantity != null && { icon: Layers, label: "Số lượng", value: String(asset.quantity) },
    asset.category && { icon: FileText, label: "Loại tài sản", value: asset.category },
    areaText && { icon: Maximize2, label: "Diện tích", value: areaText },
    asset.location && { icon: MapPin, label: "Nơi có tài sản", value: asset.location },
    asset.legal_status && { icon: Scale, label: "Pháp lý", value: asset.legal_status },
    asset.condition && { icon: Wrench, label: "Tình trạng", value: asset.condition },
    asset.auction_format && { icon: Gavel, label: "Hình thức đấu giá", value: asset.auction_format },
    asset.bidding_method && { icon: ArrowUpDown, label: "Phương thức đấu giá", value: asset.bidding_method },
    asset.notes && { icon: StickyNote, label: "Ghi chú", value: asset.notes },
  ].filter(Boolean) as Array<{ icon: React.ElementType; label: string; value: string }>

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-muted/30 transition-colors">
            <h4 className="text-base font-semibold text-primary">
              {asset.title || `Tài sản ${index + 1}`}
            </h4>
            {open
              ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            }
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-5 pb-5 space-y-4">
            {asset.description && (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {asset.description}
              </p>
            )}

            {metaItems.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {metaItems.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{label}:</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <PriceGrid
              asset={asset}
              isUnlocked={isUnlocked}
              isLoggedIn={isLoggedIn}
              showResult={showResult}
              onLockedClick={onLockedClick}
              onLoginClick={onLoginClick}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
