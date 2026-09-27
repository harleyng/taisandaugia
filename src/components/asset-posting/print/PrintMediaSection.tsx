import { galleryLayout, isPreApproval, verificationCode } from "@/lib/asset-posting/postingPrint";
import { ownerPostingPath } from "@/lib/asset-posting/paths";
import type { PostingPrintData } from "@/hooks/usePostingPrintData";
import { PrintQr } from "./PrintQr";
import { SectionHead, Slot } from "./printParts";

/** Link tuyệt đối tới trang hồ sơ — đích QR khi dịch vụ không có link công khai (chứng thư ở bucket private). */
const postingUrl = (id: string) => `${window.location.origin}${ownerPostingPath(id)}`;

/** 04 Hình ảnh & media: lưới ảnh (9 / 5 / tất cả + ô thiếu) và 3 thẻ 3D · VR · giám định kèm QR. */
export function PrintMediaSection({ data }: { data: PostingPrintData }) {
  const p = data.posting;
  const photos = p.image_urls ?? [];
  const { shown, miss, big } = galleryLayout(photos.length);
  const fallback = postingUrl(p.id);
  const cards = [
    { k: "3D", cls: "k3D", title: "Model 3D", ...data.media.model3d, sub: "Quét QR để xem model" },
    { k: "VR", cls: "kVR", title: "VR tour 360°", ...data.media.vr, sub: "Quét QR để tham quan" },
    { k: "GĐ", cls: "kGD", title: "Chứng thư giám định", ...data.media.certificate, sub: "Quét QR để xem chứng thư" },
  ];

  return (
    <section className="sec">
      <SectionHead
        n="04"
        title="Hình ảnh & media"
        aux={`${photos.length} ảnh${photos.length > shown ? ` · hiển thị ${shown}` : ""}`}
      />
      <div className="gal">
        {photos.slice(0, shown).map((src, i) => (
          <Slot key={src} src={src} placeholder={`Ảnh ${i + 1}`} className={i === 0 && big ? "big" : undefined} />
        ))}
        {Array.from({ length: miss }, (_, i) => (
          <div key={`miss-${i}`} className="miss">
            {i === 0 && (
              <>
                Thiếu {miss} ảnh
                <br />
                cần tối thiểu 5
              </>
            )}
          </div>
        ))}
      </div>
      <div className="media">
        {cards.map((c) => (
          <div key={c.k} className={`md ${c.cls}${c.has ? " has" : ""}`}>
            <div className="top">
              <span className="badge">{c.k}</span>
              {c.has && (
                <span className="qr">
                  <PrintQr value={c.url ?? fallback} label={`QR ${c.title}`} />
                </span>
              )}
            </div>
            <div className="bd">
              <b className="one">{c.title}</b>
              <span className="one">{c.has ? c.sub : "Chưa có"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Hộp xác thực cuối tài liệu: câu nguồn gốc + mã xác thực + QR về trang hồ sơ. */
export function PrintVerifyBox({ data }: { data: PostingPrintData }) {
  const p = data.posting;
  const pre = isPreApproval(data.status.stage) || p.review_status !== "approved";
  return (
    <div className="ver">
      <div>
        <p>
          Hồ sơ được tạo và lưu trữ trên nền tảng Tài Sản Đấu Giá. Thông tin do chủ tài sản cung cấp
          {pre ? "; chưa được sàn xác minh" : " và đã được sàn duyệt"}.
        </p>
        <p>Mã xác thực tài liệu</p>
        <div className="code">{verificationCode(p)}</div>
      </div>
      <div className="qr">
        <PrintQr value={postingUrl(p.id)} label="QR xác thực" />
      </div>
    </div>
  );
}
