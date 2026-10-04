import type { ReactNode } from "react";
import { format } from "date-fns";
import { CHILD_NAME, PARENT_NAME } from "@/constants/category.constants";
import {
  areaOf,
  galleryLayout,
  specRows,
} from "@/lib/asset-posting/postingPrint";
import { BRAND } from "@/lib/brand";
import { formatShareDayTime } from "@/lib/postingShare/status";
import type { SharedPosting } from "@/lib/postingShare/types";
import { sharedLocation } from "@/lib/postingShare/view";
import { formatMoneyFull, formatMoneyShort } from "@/utils/money";
import { POSTING_PRINT_CSS } from "../print/postingPrintCss";
import { PrintQr } from "../print/PrintQr";
import { CoverPhotos, SectionHead, Slot } from "../print/printParts";

const One = ({ children }: { children: ReactNode }) => (
  <b className="one">{children}</b>
);

const MARK = { ok: "✓", err: "✕", mu: "—" } as const;

function legalRows(
  p: SharedPosting,
): { k: string; v: string; tone: keyof typeof MARK }[] {
  const flag = (b: boolean | null) =>
    b === null
      ? { v: "Chưa khai", tone: "mu" as const }
      : b
        ? { v: "Có", tone: "err" as const }
        : { v: "Không", tone: "ok" as const };
  return [
    {
      k: "Quyền được bán",
      ...(p.legal.rightToSell
        ? { v: "Có", tone: "ok" as const }
        : { v: "Chưa xác nhận", tone: "mu" as const }),
    },
    { k: "Đang tranh chấp", ...flag(p.legal.hasDispute) },
    { k: "Đang thế chấp", ...flag(p.legal.hasMortgage) },
    { k: "Bị kê biên", ...flag(p.legal.isSeized) },
  ];
}

/**
 * Bản in A4 của Hồ sơ online — CHỈ dựng từ payload công khai (không dùng PostingPrintData của
 * cổng chủ tài sản, vốn có giấy tờ / cam kết / thù lao). Cùng khung + CSS với bản in nội bộ;
 * QR trỏ về chính link /hs/:code.
 */
export function SharedPostingPrintSheet({
  posting: p,
  url,
  printedAt,
}: {
  posting: SharedPosting;
  url: string;
  printedAt: Date;
}) {
  const photos = p.imageUrls;
  const { shown, big } = galleryLayout(photos.length);
  const specs = specRows({
    child_slug: p.category.child,
    delta_fields: p.specs,
  });
  const area = areaOf({ child_slug: p.category.child, delta_fields: p.specs });
  const s = p.session;

  return (
    <div className="hsp desk">
      <style>{POSTING_PRINT_CSS}</style>
      <div className="sheet">
        <table className="frame" role="presentation">
          <thead>
            <tr>
              <th>
                <div className="hdr-space">
                  <div className="hd">
                    <span className="br">
                      <i />
                      {BRAND.name}
                    </span>
                    <span>Hồ sơ số hoá tài sản</span>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="doc">
                  <div className="cov">
                    <div>
                      <span className="eb">
                        {[
                          PARENT_NAME[p.category.parent],
                          CHILD_NAME[p.category.child],
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <h1>{p.title}</h1>
                      <div className="facts">
                        <div style={{ gridColumn: "span 2" }}>
                          <small>Vị trí</small>
                          <One>{sharedLocation(p) || "—"}</One>
                        </div>
                        <div style={{ gridColumn: "span 2" }}>
                          <small>Diện tích</small>
                          <One>{area ?? "—"}</One>
                        </div>
                        {p.ownerName && (
                          <div style={{ gridColumn: "span 2" }}>
                            <small>Chủ tài sản</small>
                            <One>{p.ownerName}</One>
                          </div>
                        )}
                      </div>
                    </div>
                    <CoverPhotos photos={photos} />
                  </div>

                  <div className="kn">
                    <div>
                      <small className="one">Giá khởi điểm</small>
                      <One>
                        {p.startingPrice
                          ? formatMoneyShort(p.startingPrice)
                          : "Liên hệ"}
                      </One>
                    </div>
                    <div>
                      <small className="one">Phiên đấu giá</small>
                      <One>
                        {s ? formatShareDayTime(s.startsAt) : "Chưa có lịch"}
                      </One>
                    </div>
                    <div>
                      <small className="one">Hạn đăng ký</small>
                      <One>
                        {s ? formatShareDayTime(s.registrationEndAt) : "—"}
                      </One>
                    </div>
                    <div>
                      <small className="one">Tiền đặt trước</small>
                      <One>
                        {s?.depositAmount != null
                          ? formatMoneyFull(s.depositAmount)
                          : "—"}
                      </One>
                    </div>
                  </div>

                  {(p.description?.trim() || specs.length > 0) && (
                    <section className="sec">
                      <SectionHead n="01" title="Mô tả & thông số" />
                      {p.description?.trim() && (
                        <p className="desc">{p.description.trim()}</p>
                      )}
                      {specs.length > 0 && (
                        <div className="specs">
                          {specs.map((r) => (
                            <div key={r.k}>
                              <small className="one">{r.k}</small>
                              <b className="one">{r.v}</b>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Tin trên sàn không có pháp lý tự khai — bỏ cả mục. */}
                  {p.kind !== "listing" && (
                    <section className="sec">
                      <SectionHead
                        n="02"
                        title="Pháp lý"
                        aux="Chủ tài sản tự khai"
                      />
                      <div className="decl">
                        {legalRows(p).map((r) => (
                          <div key={r.k}>
                            <i className={r.tone === "ok" ? undefined : r.tone}>
                              {MARK[r.tone]}
                            </i>
                            <span>
                              <small className="one">{r.k}</small>
                              <b className="one">{r.v}</b>
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {photos.length > 1 && (
                    <section className="sec">
                      <SectionHead
                        n="03"
                        title="Hình ảnh"
                        aux={`${photos.length} ảnh`}
                      />
                      <div className="gal">
                        {photos.slice(0, Math.max(shown, 1)).map((src, i) => (
                          <Slot
                            key={src}
                            src={src}
                            placeholder={`Ảnh ${i + 1}`}
                            className={i === 0 && big ? "big" : undefined}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="ver">
                    <div>
                      <p>
                        Hồ sơ được số hoá và lưu trữ trên {BRAND.name}; thông
                        tin do chủ tài sản cung cấp và đã được sàn duyệt.{" "}
                        {s?.organizationName
                          ? `Phiên do ${s.organizationName} tổ chức. `
                          : ""}
                        Quét mã để xem bản mới nhất, ảnh, model 3D / VR và mua
                        hồ sơ tham gia.
                      </p>
                      {p.sender?.phone && (
                        <p>
                          Liên hệ: {p.sender.name ? `${p.sender.name} · ` : ""}
                          {p.sender.phone}
                        </p>
                      )}
                    </div>
                    <div className="qr">
                      <PrintQr value={url} label="QR hồ sơ online" />
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <div className="ftr-space">
                  <div className="ft">
                    <span>Hồ sơ online · {BRAND.domain}</span>
                    <span>In lúc {format(printedAt, "HH:mm, dd/MM/yyyy")}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
