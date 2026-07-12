import { NAV_TYPE_LABELS } from "@/lib/advertising/adStatus";
import { BannerPreview } from "../BannerPreview";
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
    : "—";

const basename = (url: string | null) => {
  if (!url) return null;
  try {
    return decodeURIComponent(url.split("/").pop() ?? url);
  } catch {
    return url;
  }
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground min-w-0 break-words">{children}</span>
    </div>
  );
}

function ImageLink({ url }: { url: string | null }) {
  if (!url) return <span className="text-muted-foreground">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
      {basename(url)}
    </a>
  );
}

export function AdContentTab({ ad }: { ad: Advertisement }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Tổng quan</h3>
          <div className="space-y-2.5">
            <Row label="Trang hiển thị">{ad.position?.page?.name ?? "—"}</Row>
            <Row label="Vị trí hiển thị">{ad.position?.name ?? "—"}</Row>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Nội dung và hình thức</h3>
          <p className="text-sm font-medium text-foreground mb-1.5">Ảnh:</p>
          <div className="space-y-2.5">
            <Row label="Ảnh Desktop"><ImageLink url={ad.desktop_image_url} /></Row>
            <Row label="Ảnh Mobile"><ImageLink url={ad.mobile_image_url} /></Row>
          </div>
          <p className="text-sm font-medium text-foreground mt-4 mb-1.5">Điều hướng:</p>
          <Row label="Phương thức điều hướng">
            {NAV_TYPE_LABELS[ad.nav_type]}
            {ad.nav_type === "link" && ad.nav_url && (
              <>
                {" · "}
                <a href={ad.nav_url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
                  {ad.nav_url}
                </a>
              </>
            )}
          </Row>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Thời gian đăng</h3>
          <div className="space-y-2.5">
            <Row label="Thời gian bắt đầu">
              {ad.start_type === "immediate" ? "Ngay lập tức" : fmt(ad.start_at)}
            </Row>
            <Row label="Thời gian kết thúc">
              {ad.end_type === "continuous" ? "Liên tục" : fmt(ad.end_at)}
            </Row>
            {ad.position?.placement_type !== "unique" && (
              <Row label="Thứ tự hiển thị">{ad.sort_order}</Row>
            )}
          </div>
        </section>
      </div>

      <BannerPreview desktopUrl={ad.desktop_image_url} mobileUrl={ad.mobile_image_url} />
    </div>
  );
}
