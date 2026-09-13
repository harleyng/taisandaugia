import { InfoBox } from "@/components/shared/InfoBox";
import { SessionBiddingRulesCard } from "../SessionBiddingRulesCard";
import { SessionFormCard } from "../SessionFormCard";
import { SessionInfoSummary } from "../SessionInfoSummary";
import type { AuctionSessionWithItems } from "@/types/auction-session";

const ONLINE_FORMATS = new Set(["truc_tuyen", "ca_hai"]);

interface Props {
  session: AuctionSessionWithItems;
  editing: boolean;
  onExitEdit: () => void;
}

/**
 * Tab "Thông tin" — mặc định ĐỌC, bấm "Chỉnh sửa" ở hero mới thành form.
 *
 * Chỉ chứa thông tin khai báo của phiên; tài sản, tài liệu, hồ sơ là các tab
 * riêng vì mỗi thứ là một việc làm nhiều lần, thường do người khác phụ trách.
 *
 * Lưu xong ở thẻ nào cũng thoát chế độ sửa: "Lưu" = lưu rồi về màn đọc.
 */
export function SessionInfoTab({ session, editing, onExitEdit }: Props) {
  const online = ONLINE_FORMATS.has(session.auction_format);

  return (
    <div className="space-y-5">
      {session.status === "cancelled" && (
        <InfoBox variant="amber" className="text-sm">
          Phiên đã huỷ{session.cancelled_reason ? ` — lý do: ${session.cancelled_reason}` : ""}. Phiên vẫn hiện trên sàn
          kèm lý do và không chỉnh sửa được nữa.
        </InfoBox>
      )}

      {editing ? (
        <>
          <SessionFormCard
            // Key theo id + updated_at: server trả bản mới thì form dựng lại.
            key={`${session.id}:${session.updated_at}`}
            session={session}
            readOnly={false}
            onSaved={onExitEdit}
            onCancel={onExitEdit}
          />
          {/* Quy tắc trả giá: chỉ có nghĩa với phiên nhận trả giá qua sàn. Khoá
              lại khi đã mở lô đầu tiên — thẻ tự xử lý. */}
          {online && (
            <SessionBiddingRulesCard
              // Tiền tố "rules:" vì SessionFormCard ở trên đã dùng đúng chuỗi
              // `${id}:${updated_at}` — hai anh em trùng key thì React cảnh báo
              // và có thể bỏ qua một trong hai.
              key={`rules:${session.id}:${session.updated_at}`}
              session={session}
              readOnly={false}
              onSaved={onExitEdit}
              onCancel={onExitEdit}
            />
          )}
        </>
      ) : (
        <SessionInfoSummary session={session} />
      )}
    </div>
  );
}
