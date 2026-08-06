-- Chỉ còn một mẫu hồ sơ: "Hồ sơ đấu giá viên đầy đủ".
--
-- Hai mẫu SUMMARY (trích ngang) và EXPERIENCE (phụ lục kinh nghiệm) đã bỏ khỏi
-- sản phẩm. Giữ NGUYÊN cột `template` để sau này thêm mẫu mới không phải đổi
-- schema, chỉ siết lại giá trị hợp lệ.

-- Bản đã xuất bằng mẫu cũ (nếu có) quy về FULL: file trong Storage vẫn nguyên
-- vẹn và tải lại được, chỉ nhãn hiển thị đổi. Không xoá bản ghi — người dùng
-- đã trả credit cho chúng.
UPDATE public.personnel_dossier_exports
   SET template = 'FULL'
 WHERE template <> 'FULL';

ALTER TABLE public.personnel_dossier_exports
  DROP CONSTRAINT IF EXISTS personnel_dossier_exports_template_check;

ALTER TABLE public.personnel_dossier_exports
  ADD CONSTRAINT personnel_dossier_exports_template_check
  CHECK (template IN ('FULL'));
