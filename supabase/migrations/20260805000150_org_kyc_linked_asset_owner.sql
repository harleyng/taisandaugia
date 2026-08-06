-- KYC Chủ tài sản (nhánh tổ chức): ghi nhận CHỦ TÀI SẢN được chọn từ danh bạ.
--
-- Trước đây "Tên theo Giấy phép / Quyết định thành lập" là ô text tự do, giống
-- hệt cách KYC công ty đấu giá từng làm trước khi có CompanyTypeahead. Hệ quả:
-- người khai gõ sai một dấu/một chữ là run_workspace_match() (khớp theo
-- org_name_similarity với public.asset_owners) tụt điểm, tài sản không tự về
-- danh mục sau khi duyệt.
--
-- Nay form cho chọn thẳng từ public.asset_owners. Cột này lưu chính entity đã
-- chọn để: (1) admin duyệt biết hồ sơ trỏ vào pháp nhân nào trong danh bạ thay
-- vì đoán qua tên, (2) phân biệt "chọn từ danh bạ" với "tự nhập tay" (NULL) khi
-- tổ chức chưa có trong danh bạ.
--
-- Không đụng tới create_workspace_on_org_approval/run_workspace_match: việc chọn
-- từ danh bạ đã khiến org_name khớp tuyệt đối (similarity = 1.0 → auto_claimed),
-- nên logic khớp giữ nguyên.

ALTER TABLE public.asset_owner_org_kyc
  ADD COLUMN IF NOT EXISTS linked_asset_owner_id UUID REFERENCES public.asset_owners(id);

COMMENT ON COLUMN public.asset_owner_org_kyc.linked_asset_owner_id IS
  'Chủ tài sản trong danh bạ public.asset_owners mà người khai đã chọn. NULL = tự nhập tên tay (chưa có trong danh bạ).';

CREATE INDEX IF NOT EXISTS idx_asset_owner_org_kyc_linked_owner
  ON public.asset_owner_org_kyc(linked_asset_owner_id)
  WHERE linked_asset_owner_id IS NOT NULL;
