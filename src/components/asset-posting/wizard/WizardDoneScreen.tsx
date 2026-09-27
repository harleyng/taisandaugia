import { Check, Eye, Handshake, Plus } from "lucide-react";

interface WizardDoneScreenProps {
  title: string;
  /** Tên các tổ chức đã nhận yêu cầu báo giá (rỗng = không gửi tổ chức nào). */
  sentOrgNames: string[];
  /** Đã gửi "nhờ sàn chọn giúp". */
  sentToPlatform: boolean;
  /** Mở trang ký gửi của hồ sơ vừa hoàn tất (chỉ khi đã gửi đi). */
  onTrack?: () => void;
  onView: () => void;
  onAnother: () => void;
}

const PRIMARY =
  "inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90";
const GHOST =
  "inline-flex items-center gap-2 rounded-[10px] border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-muted-foreground";

/** Màn hoàn tất số hoá — ba lối kết thúc: chỉ số hoá · gửi tổ chức · nhờ sàn. */
export function WizardDoneScreen({ title, sentOrgNames, sentToPlatform, onTrack, onView, onAnother }: WizardDoneScreenProps) {
  // Đã gửi đi thì việc tiếp theo là chờ báo giá — nút chính mở trang ký gửi.
  const sent = sentOrgNames.length > 0 || sentToPlatform;
  return (
    <div className="mx-auto my-8 w-full max-w-xl px-4">
      <div className="rounded-2xl border border-border bg-card px-8 py-11 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
          <Check className="h-8 w-8" strokeWidth={2.4} />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          {sentOrgNames.length > 0 ? "Đã số hoá & gửi yêu cầu báo giá" : sentToPlatform ? "Đã gửi yêu cầu cho sàn" : "Đã số hoá tài sản"}
        </h1>
        <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
          {sentOrgNames.length > 0 ? (
            <>
              Hồ sơ <b className="text-foreground">{title}</b> đã gửi tới{" "}
              <b className="text-foreground">{sentOrgNames.length} tổ chức</b>: {sentOrgNames.join(" · ")}. Báo giá của
              từng tổ chức sẽ hiện ở mục Ký gửi đấu giá để bạn so sánh và chọn.
            </>
          ) : sentToPlatform ? (
            <>
              Sàn đang tìm tổ chức đấu giá phù hợp cho <b className="text-foreground">{title}</b>. Báo giá của các tổ chức
              sẽ hiện ở mục Ký gửi đấu giá để bạn so sánh và chọn.
            </>
          ) : (
            <>
              Hồ sơ <b className="text-foreground">{title}</b> đã lưu vào “Tài sản của tôi”. Sau khi hồ sơ được duyệt, bạn
              có thể gửi cho tổ chức đấu giá ở mục Ký gửi đấu giá.
            </>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {sent && onTrack && (
            <button type="button" onClick={onTrack} className={PRIMARY}>
              <Handshake className="h-4 w-4" /> Theo dõi báo giá
            </button>
          )}
          <button type="button" onClick={onView} className={sent && onTrack ? GHOST : PRIMARY}>
            <Eye className="h-4 w-4" /> Xem hồ sơ
          </button>
          <button type="button" onClick={onAnother} className={GHOST}>
            <Plus className="h-4 w-4" /> Số hoá tài sản khác
          </button>
        </div>
      </div>
    </div>
  );
}
