import type { ReactNode } from "react";

/** Ô ảnh của thiết kế (image-slot): nền kẻ sọc, ảnh phủ kín; chưa có ảnh thì in chú thích. */
export function Slot({ src, placeholder, className }: { src?: string | null; placeholder: string; className?: string }) {
  return (
    <div className={`slot ${className ?? ""}`}>
      {src ? <img src={src} alt="" /> : <span className="ph">{placeholder}</span>}
    </div>
  );
}

/** Thẻ trống khi in (.emp): vòng tròn ký hiệu + tiêu đề + một dòng giải thích. */
export function PrintEmpty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="emp">
      <span className="ico">{icon}</span>
      <div>
        <b>{title}</b>
        {text}
      </div>
    </div>
  );
}

/** Tiêu đề mục: ô số · tên · đường mảnh · chữ phụ. */
export function SectionHead({ n, title, aux }: { n: string; title: string; aux?: ReactNode }) {
  return (
    <div className="sh">
      <span className="n">{n}</span>
      <h2>{title}</h2>
      <span className="ln" />
      {aux && <span className="aux">{aux}</span>}
    </div>
  );
}

const MAX_COVER_THUMBS = 4;

/**
 * Cụm ảnh trên bìa: ảnh chính + hàng ảnh nhỏ chia đều theo SỐ ẢNH THẬT (tối đa 4) — không
 * in ô trống hay ô "+N ảnh"; toàn bộ ảnh đã có ở mục Hình ảnh.
 */
export function CoverPhotos({ photos }: { photos: string[] }) {
  const thumbs = photos.slice(1, 1 + MAX_COVER_THUMBS);
  return (
    <div className="pic">
      <Slot src={photos[0]} placeholder="Chưa có ảnh" className="main" />
      {thumbs.length > 0 && (
        <div className={`th n${thumbs.length}`}>
          {thumbs.map((src, i) => (
            <Slot key={i} src={src} placeholder={`Ảnh ${i + 2}`} />
          ))}
        </div>
      )}
    </div>
  );
}
