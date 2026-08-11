-- Bản xuất hồ sơ nhân sự: ba mẫu trình bày + ghi lại các mục đã chọn.
--
-- Trước đó `20260805000120` siết `template` về đúng một giá trị 'FULL'. Nay
-- popup xuất cho chọn 1 trong 3 phong cách nên nới lại CHECK, và thêm cột
-- `sections` để lịch sử xuất phân biệt được hai lần cùng mẫu nhưng khác nội
-- dung (người dùng đã trả credit cho từng lần).

ALTER TABLE public.personnel_dossier_exports
  DROP CONSTRAINT IF EXISTS personnel_dossier_exports_template_check;

ALTER TABLE public.personnel_dossier_exports
  ADD CONSTRAINT personnel_dossier_exports_template_check
  CHECK (template IN ('FULL', 'FORMAL', 'COMPACT'));

-- NULL ở bản ghi cũ = xuất đủ mọi mục (lúc đó chưa có lựa chọn). KHÔNG backfill:
-- điền một danh sách mục vào bản ghi cũ là bịa lại lịch sử.
ALTER TABLE public.personnel_dossier_exports
  ADD COLUMN IF NOT EXISTS sections text[];

COMMENT ON COLUMN public.personnel_dossier_exports.sections IS
  'Mục nội dung đã chọn lúc xuất (strengths, education, notable, cpd, rewards, identity, practice, annex). NULL = bản ghi trước khi có tính năng chọn mục, tương đương đủ mọi mục.';
