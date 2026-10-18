-- "Tài liệu khác" trong tab Tài liệu của phiên (portal).
--
-- Bốn loại cố định (thông báo, quy chế, tiền đặt trước, lịch xem) mỗi phiên tối
-- đa MỘT tài liệu. Tổ chức còn nhiều giấy tờ ngoài bốn loại đó (quyết định phê
-- duyệt giá, sơ đồ thửa đất, giấy chứng nhận…) ⇒ thêm loại `other`, được NHIỀU
-- tài liệu mỗi phiên. Vòng đời giữ nguyên: tải tệp → trích xuất/nhập điều khoản
-- → xác nhận; chỉ tài liệu đã xác nhận mới vào hỏi đáp và trang công khai.
--
-- Ràng buộc duy nhất cũ đổi thành chỉ mục duy nhất CÓ ĐIỀU KIỆN, giữ nguyên tên
-- `case_documents_session_type_key` vì caseQaErrorMessage bắt lỗi 23505 theo tên.
-- public_session_documents xếp theo array_position ⇒ `other` (NULL) tự xuống cuối;
-- case_citable_clauses rơi vào nhánh ELSE 5 — không cần sửa hai RPC đó.

ALTER TABLE public.case_documents DROP CONSTRAINT IF EXISTS case_documents_doc_type_check;
ALTER TABLE public.case_documents
  ADD CONSTRAINT case_documents_doc_type_check
  CHECK (doc_type IN ('notice', 'rules', 'deposit_terms', 'viewing_schedule', 'clarification', 'other'));

ALTER TABLE public.case_documents DROP CONSTRAINT IF EXISTS case_documents_session_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS case_documents_session_type_key
  ON public.case_documents (session_id, doc_type)
  WHERE doc_type <> 'other';

CREATE INDEX IF NOT EXISTS idx_case_documents_session ON public.case_documents (session_id, created_at);
