-- CRM: Công việc (tasks) + Ticket, gắn được vào mọi đối tượng, có cổng tập trung.
--
-- Gắn đối tượng bằng 4 CỘT FK NULLABLE chứ không phải polymorphic
-- (related_type + related_id): giữ được toàn vẹn tham chiếu thật, ON DELETE
-- SET NULL thật, và PostgREST embed cả 4 quan hệ trong MỘT select — đúng thứ
-- màn hình tổng hợp cần. Ràng buộc num_nonnulls(...) <= 1 (KHÔNG phải = 1) để
-- vẫn tạo được công việc nhắc việc độc lập.
--
-- KHÔNG thêm cột related_kind GENERATED: đổi biểu thức generated column là
-- rewrite cả bảng. Suy ra kind ở src/lib/crm/relation.ts.
--
-- Ticket THAY THẾ hẳn hộp thư "Liên hệ & Hợp tác": một hàng đợi duy nhất.
-- Giữ nguyên mã quyền 'lien-he' (đã lưu trong admin_role_permissions), chỉ đổi
-- nhãn hiển thị — đổi mã = mọi vai trò mất quyền đó.

-- ─── tasks (Công việc) ───────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.task_code_seq START 1;

CREATE TABLE public.tasks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT        UNIQUE,                        -- 'CV000001'
  title          TEXT        NOT NULL,
  description    TEXT,
  task_type      TEXT        NOT NULL DEFAULT 'other'
                   CHECK (task_type IN ('call','email','meeting','followup','other')),
  status         TEXT        NOT NULL DEFAULT 'todo'
                   CHECK (status IN ('todo','in_progress','done','cancelled')),
  priority       TEXT        NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  due_at         TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  assignee_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Quan hệ: tối đa MỘT. SET NULL để xóa đối tượng không cuốn mất công việc.
  lead_id        UUID        REFERENCES public.leads(id)         ON DELETE SET NULL,
  customer_id    UUID        REFERENCES public.customers(id)     ON DELETE SET NULL,
  opportunity_id UUID        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  order_id       UUID        REFERENCES public.orders(id)        ON DELETE SET NULL,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_one_relation
    CHECK (num_nonnulls(lead_id, customer_id, opportunity_id, order_id) <= 1)
);

CREATE INDEX idx_tasks_status      ON public.tasks (status, created_at DESC);
CREATE INDEX idx_tasks_assignee    ON public.tasks (assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_tasks_due         ON public.tasks (due_at) WHERE status IN ('todo','in_progress');
CREATE INDEX idx_tasks_lead        ON public.tasks (lead_id)        WHERE lead_id IS NOT NULL;
CREATE INDEX idx_tasks_customer    ON public.tasks (customer_id)    WHERE customer_id IS NOT NULL;
CREATE INDEX idx_tasks_opportunity ON public.tasks (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_tasks_order       ON public.tasks (order_id)       WHERE order_id IS NOT NULL;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_admin_all"
  ON public.tasks FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_task_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CV' || lpad(nextval('public.task_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_set_code
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_code();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CHỈ BEFORE UPDATE: gắn INSERT sẽ đè closed_at của seed lùi ngày thành now().
CREATE OR REPLACE FUNCTION public.tasks_sync_closed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.closed_at := CASE
    WHEN NEW.status IN ('done','cancelled') THEN COALESCE(NEW.closed_at, now())
    ELSE NULL
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_sync_closed
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_closed();

-- Quá hạn tính phía client — now() không IMMUTABLE nên generated column là bất hợp pháp.

-- ─── tickets ─────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.ticket_code_seq START 1;

CREATE TABLE public.tickets (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        TEXT        UNIQUE,          -- 'TK000001'
  subject                     TEXT        NOT NULL,
  body                        TEXT,
  source                      TEXT        NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('contact_form','partnership','phone','email','manual')),
  status                      TEXT        NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','open','pending','resolved','closed')),
  priority                    TEXT        NOT NULL DEFAULT 'normal'
                                CHECK (priority IN ('low','normal','high','urgent')),
  -- Denormalise: ticket có thể chưa gắn khách nào.
  requester_name              TEXT,
  requester_phone             TEXT,
  requester_email             TEXT,
  -- Trường riêng của từng nguồn (vd org_name/province của đăng ký hợp tác) —
  -- hai bảng intake khác shape, bỏ đi là mất đúng phần khiến lead hành động được.
  meta                        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  contact_submission_id       UUID        UNIQUE REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  partnership_registration_id UUID        UNIQUE REFERENCES public.partnership_registrations(id) ON DELETE CASCADE,
  assignee_id                 UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id                     UUID        REFERENCES public.leads(id)         ON DELETE SET NULL,
  customer_id                 UUID        REFERENCES public.customers(id)     ON DELETE SET NULL,
  opportunity_id              UUID        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  order_id                    UUID        REFERENCES public.orders(id)        ON DELETE SET NULL,
  resolution_note             TEXT,
  resolved_at                 TIMESTAMPTZ,
  first_response_at           TIMESTAMPTZ,
  created_by                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tickets_one_relation
    CHECK (num_nonnulls(lead_id, customer_id, opportunity_id, order_id) <= 1)
);

CREATE INDEX idx_tickets_status      ON public.tickets (status, created_at DESC);
CREATE INDEX idx_tickets_source      ON public.tickets (source, created_at DESC);
CREATE INDEX idx_tickets_assignee    ON public.tickets (assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_tickets_lead        ON public.tickets (lead_id)        WHERE lead_id IS NOT NULL;
CREATE INDEX idx_tickets_customer    ON public.tickets (customer_id)    WHERE customer_id IS NOT NULL;
CREATE INDEX idx_tickets_opportunity ON public.tickets (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_tickets_order       ON public.tickets (order_id)       WHERE order_id IS NOT NULL;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_admin_all"
  ON public.tickets FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_ticket_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'TK' || lpad(nextval('public.ticket_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_set_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_code();

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chỉ ĐẶT resolved_at khi chuyển VÀO resolved/closed; mở lại thì KHÔNG xóa mốc
-- (mất mốc SLA), chỉ xóa ghi chú xử lý cho khỏi hiểu nhầm là đã xong.
CREATE OR REPLACE FUNCTION public.tickets_sync_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('resolved','closed') AND OLD.status NOT IN ('resolved','closed') THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  ELSIF NEW.status NOT IN ('resolved','closed') AND OLD.status IN ('resolved','closed') THEN
    NEW.resolution_note := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_sync_resolved
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_sync_resolved();

-- ─── Cầu nối: form công khai ⇒ ticket ────────────────────────────────────────
-- SECURITY DEFINER BẮT BUỘC: trigger chạy trong transaction của khách ẩn danh
-- còn `tickets` là RLS admin-only ⇒ hàm thường sẽ làm FORM LIÊN HỆ CÔNG KHAI
-- BẮT ĐẦU LỖI.

CREATE OR REPLACE FUNCTION public.contact_submissions_create_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer UUID;
BEGIN
  -- Tự gắn khách hàng khi khớp SĐT/email — nếu không, panel Ticket trên trang
  -- khách hàng ra mắt với 0 dòng.
  SELECT c.id INTO v_customer FROM public.customers c
   WHERE (NULLIF(NEW.phone,'') IS NOT NULL
          AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g') = regexp_replace(NEW.phone, '\D', '', 'g'))
      OR (NULLIF(NEW.email,'') IS NOT NULL AND lower(c.email) = lower(NEW.email))
   LIMIT 1;

  INSERT INTO public.tickets (
    subject, body, source, status, requester_name, requester_phone, requester_email,
    contact_submission_id, customer_id, created_at
  ) VALUES (
    COALESCE(NULLIF(NEW.subject, ''), 'Liên hệ từ ' || NEW.name),
    NEW.message, 'contact_form',
    CASE NEW.status WHEN 'read' THEN 'open' WHEN 'replied' THEN 'resolved' ELSE 'new' END,
    NEW.name, NEW.phone, NEW.email,
    NEW.id, v_customer, NEW.created_at
  )
  ON CONFLICT (contact_submission_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contact_submissions_create_ticket
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.contact_submissions_create_ticket();

CREATE OR REPLACE FUNCTION public.partnership_registrations_create_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_customer UUID;
BEGIN
  SELECT c.id INTO v_customer FROM public.customers c
   WHERE (NULLIF(NEW.phone,'') IS NOT NULL
          AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g') = regexp_replace(NEW.phone, '\D', '', 'g'))
      OR (NULLIF(NEW.email,'') IS NOT NULL AND lower(c.email) = lower(NEW.email))
   LIMIT 1;

  INSERT INTO public.tickets (
    subject, body, source, status, priority,
    requester_name, requester_phone, requester_email, meta,
    partnership_registration_id, customer_id, created_at
  ) VALUES (
    'Đăng ký hợp tác — ' || NEW.org_name,
    NEW.note, 'partnership',
    CASE NEW.status WHEN 'NEW' THEN 'new' ELSE 'open' END,
    'high',
    NEW.contact_name, NEW.phone, NEW.email,
    jsonb_build_object('org_name', NEW.org_name, 'province', NEW.province),
    NEW.id, v_customer, NEW.created_at
  )
  ON CONFLICT (partnership_registration_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER partnership_registrations_create_ticket
  AFTER INSERT ON public.partnership_registrations
  FOR EACH ROW EXECUTE FUNCTION public.partnership_registrations_create_ticket();

-- ─── Backfill dữ liệu intake đã có ───────────────────────────────────────────
-- resolved_at để NULL: bịa = created_at sẽ đầu độc mọi chỉ số "thời gian xử lý"
-- bằng một đống 0 giây.

INSERT INTO public.tickets (
  subject, body, source, status, requester_name, requester_phone, requester_email,
  contact_submission_id, created_at
)
SELECT
  COALESCE(NULLIF(cs.subject, ''), 'Liên hệ từ ' || cs.name),
  cs.message, 'contact_form',
  CASE cs.status WHEN 'read' THEN 'open' WHEN 'replied' THEN 'resolved' ELSE 'new' END,
  cs.name, cs.phone, cs.email, cs.id, cs.created_at
FROM public.contact_submissions cs
ON CONFLICT (contact_submission_id) DO NOTHING;

INSERT INTO public.tickets (
  subject, body, source, status, priority,
  requester_name, requester_phone, requester_email, meta,
  partnership_registration_id, created_at
)
SELECT
  'Đăng ký hợp tác — ' || pr.org_name,
  pr.note, 'partnership',
  CASE pr.status WHEN 'NEW' THEN 'new' ELSE 'open' END,
  'high',
  pr.contact_name, pr.phone, pr.email,
  jsonb_build_object('org_name', pr.org_name, 'province', pr.province),
  pr.id, pr.created_at
FROM public.partnership_registrations pr
ON CONFLICT (partnership_registration_id) DO NOTHING;

-- Ticket là hàng đợi DUY NHẤT ⇒ bỏ đường sửa trạng thái cũ để hai bộ trạng thái
-- không thể phân kỳ.
DROP POLICY IF EXISTS "Admins can update" ON public.contact_submissions;

-- ─── Kiểm chứng backfill ─────────────────────────────────────────────────────
DO $$
DECLARE v_miss INTEGER;
BEGIN
  SELECT count(*) INTO v_miss FROM public.contact_submissions cs
   WHERE NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.contact_submission_id = cs.id);
  IF v_miss > 0 THEN RAISE EXCEPTION 'Backfill thiếu % liên hệ', v_miss; END IF;

  SELECT count(*) INTO v_miss FROM public.partnership_registrations pr
   WHERE NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.partnership_registration_id = pr.id);
  IF v_miss > 0 THEN RAISE EXCEPTION 'Backfill thiếu % đăng ký hợp tác', v_miss; END IF;
END $$;
