import { CHANNEL_LABELS, type ChannelKey } from "./fieldKeys";
import type { OutreachEditKind, OutreachSendChannel } from "@/types/outreach";

export const EDIT_KIND_LABELS: Record<OutreachEditKind, string> = {
  generate: "Trình soạn tạo",
  regenerate: "Trình soạn cập nhật",
  suggest: "Trình soạn đề xuất bản mới (chưa áp dụng)",
  edit: "Sửa tay",
  reset: "Dùng lại bản trình soạn",
  case_file: "Sửa hồ sơ vụ việc",
};

export const SEND_CHANNEL_LABELS: Record<OutreachSendChannel, string> = {
  ...(CHANNEL_LABELS as Record<ChannelKey, string>),
  notice: "Thông báo đấu giá (niêm yết)",
};

/** Chép vào clipboard; trả false khi trình duyệt chặn để nơi gọi báo người dùng. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
