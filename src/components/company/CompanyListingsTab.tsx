import { useMemo, useState } from "react";
import { Gavel, Percent, Search, Sparkles, Trophy } from "lucide-react";
import { AuctionCard } from "@/components/AuctionCard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSessionStatus } from "@/hooks/useAuctionListings";
import { useAssetActions } from "@/hooks/useAssetActions";
import { useAuctionOrgListings } from "@/hooks/useAuctionOrgListings";
import { useListingSaveCounts } from "@/hooks/useListingSaveCounts";
import { formatAddress } from "@/utils/formatters";
import { caNumber, caString } from "@/types/listing";

interface Props {
  auctionOrgId: string;
  orgName: string;
}

/** Tab "Tài sản" của trang tổ chức — chuyển nguyên khối từ CompanyDetail, không đổi hành vi. */
export function CompanyListingsTab({ auctionOrgId, orgName }: Props) {
  const { savedIds, toggleSave } = useAssetActions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: listings = [], isLoading } = useAuctionOrgListings(auctionOrgId);

  const saveCounts = useListingSaveCounts(listings.map((l) => l.id));

  const enrichedListings = useMemo(() => {
    return listings.map((l) => ({
      ...l,
      _sessionStatus: getSessionStatus(l),
    }));
  }, [listings]);

  const stats = useMemo(() => {
    const total = enrichedListings.length;
    const successful = enrichedListings.filter(
      (l) => l.status === "SOLD_RENTED" || caNumber(l.custom_attributes?.win_price),
    ).length;
    const rate = total > 0 ? Math.round((successful / total) * 100) : 0;
    return { total, successful, rate };
  }, [enrichedListings]);

  const filtered = useMemo(() => {
    let result = enrichedListings;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((l) => l.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l._sessionStatus === statusFilter);
    }
    return result;
  }, [enrichedListings, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[360px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 text-center">
          <Gavel className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="text-2xl font-bold text-foreground md:text-3xl">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tổng tài sản</p>
        </Card>
        <Card className="p-4 text-center">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-[hsl(142,60%,40%)]" />
          <p className="text-2xl font-bold text-foreground md:text-3xl">{stats.successful}</p>
          <p className="mt-1 text-xs text-muted-foreground">Đấu giá thành công</p>
        </Card>
        <Card className="p-4 text-center">
          <Percent className="mx-auto mb-2 h-6 w-6 text-[hsl(25,95%,53%)]" />
          <p className="text-2xl font-bold text-foreground md:text-3xl">{stats.rate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">Tỷ lệ thành công</p>
        </Card>
      </div>

      {/* Analytics placeholder — công khai cho mọi người */}
      <Card className="mb-6 border-dashed p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Phân tích nhóm theo khu vực & giá</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sắp ra mắt — bạn sẽ tự động được truy cập khi tính năng có sẵn.
            </p>
          </div>
        </div>
      </Card>

      {/* Search & Filter */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm tài sản..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="registration_open">Mở đăng ký</SelectItem>
            <SelectItem value="upcoming">Sắp diễn ra</SelectItem>
            <SelectItem value="ongoing">Đang diễn ra</SelectItem>
            <SelectItem value="ended">Đã kết thúc</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Tìm thấy <span className="font-semibold text-foreground">{filtered.length}</span> tài sản
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((listing) => {
            const ca = listing.custom_attributes || {};
            return (
              <AuctionCard
                key={listing.id}
                id={listing.id}
                imageUrl={listing.image_url}
                title={listing.title}
                address={formatAddress(listing.address) || "Chưa cập nhật"}
                startingPrice={listing.price}
                stepPrice={caNumber(ca.bid_step ?? ca.step_price)}
                depositAmount={caNumber(ca.deposit_amount)}
                auctionDate={caString(ca.auction_date ?? ca.auction_time)}
                registrationDeadline={caString(ca.registration_deadline ?? ca.document_sale_end)}
                sessionStatus={listing._sessionStatus}
                categorySlug={listing.property_type_slug}
                winPrice={caNumber(ca.win_price ?? ca.winning_price)}
                orgName={orgName}
                isSaved={savedIds.has(listing.id)}
                onToggleSave={toggleSave}
                saveCount={saveCounts.get(listing.id) || 0}
                viewsCount={listing.views_count || 0}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card py-12 text-center">
          <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">Không tìm thấy tài sản</h3>
          <p className="text-muted-foreground">Thử điều chỉnh bộ lọc để tìm thấy kết quả</p>
        </div>
      )}
    </>
  );
}
