import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseStorageUploadOptions {
  /** Bucket đích: 'asset-media' (public) hoặc 'asset-docs' (private). */
  bucket: string;
  /** Trần dung lượng mỗi tệp, tính bằng byte. */
  maxSize: number;
  /** Thư mục con trong folder của user, vd "ownership" | "extra" | "video". */
  folder?: string;
  /**
   * Bucket public trả về public URL để render thẳng; bucket private trả về
   * storage path vì không có URL nào đọc được mà không ký.
   * ⚠️ image_urls/video_urls chứa URL còn ownership_proof_urls/doc_urls chứa
   * PATH — đừng xử lý hai loại này như nhau.
   */
  returns: "url" | "path";
  /** Nhãn trong toast, vd "ảnh" | "video" | "tài liệu". */
  label: string;
}

/**
 * `crypto.randomUUID` chỉ tồn tại trong secure context (https / localhost). Mở
 * dev server qua IP LAN để thử trên điện thoại là nó undefined — không có nhánh
 * dự phòng này thì cả vòng upload ném TypeError.
 */
const newId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Vòng lặp upload dùng chung cho cả ba uploader của wizard số hoá tài sản.
 *
 * Trước đây mỗi component tự chép lại: guard auth → check size → tách đuôi →
 * `${uid}/${folder}/${uuid}.${ext}` → storage.upload → toast từng tệp. Tệp lỗi
 * bị BỎ QUA chứ không làm hỏng cả lượt — người dùng chọn 5 ảnh mà 1 ảnh quá
 * nặng thì 4 ảnh kia vẫn lên.
 */
export function useStorageUpload({ bucket, maxSize, folder, returns, label }: UseStorageUploadOptions) {
  const { userId } = useAuth();
  const [uploading, setUploading] = useState(false);

  const maxMb = Math.round(maxSize / (1024 * 1024));

  const upload = async (files: FileList | File[]): Promise<string[]> => {
    if (!userId) {
      toast.error(`Bạn cần đăng nhập để tải ${label}.`);
      return [];
    }
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > maxSize) {
          toast.error(`${file.name}: vượt quá ${maxMb}MB`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = folder ? `${userId}/${folder}/${newId()}.${ext}` : `${userId}/${newId()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (error) {
          toast.error(`Lỗi tải ${file.name}: ${error.message}`);
          continue;
        }
        uploaded.push(returns === "url" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : path);
      }
    } catch (err) {
      // finally là phần quan trọng: không có nó, một lần throw sẽ treo `uploading`
      // ở true VĨNH VIỄN và nút "Thêm ảnh" disabled luôn — nhìn y hệt lỗi "không
      // tải được ảnh" nhưng console sạch trơn.
      toast.error(err instanceof Error ? `Lỗi tải ${label}: ${err.message}` : `Lỗi tải ${label}`);
    } finally {
      setUploading(false);
    }
    return uploaded;
  };

  return { uploading, upload };
}
