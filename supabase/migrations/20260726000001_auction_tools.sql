-- Công cụ đấu giá: khu nội dung giới thiệu 4 công cụ hỗ trợ đấu giá, mỗi công cụ
-- do một hoặc nhiều PROVIDER (đối tác ngoài hoặc SSCorp) cung cấp, kèm SHOWCASE
-- (3D tour / ảnh / video / link) để trình bày năng lực.
--
-- 3 bảng:
--   auction_tools           — 4 công cụ cố định (seed sẵn), nội dung admin sửa được
--   auction_tool_providers  — provider dưới mỗi công cụ; gắn supplier + service để
--                             sinh doanh thu (đối tác ngoài = commission, SSCorp = direct)
--   auction_tool_showcases  — showcase của provider; public HOẶC cần mật khẩu chung
--
-- RLS:
--   tools/providers có public_read (theo cờ hiển thị) cho trang MKP đọc trực tiếp.
--   showcases CHỈ admin — `url`/`access_password` là dữ liệu nhạy cảm, RLS lọc theo
--   DÒNG không giấu được CỘT, nên MKP đọc showcase qua RPC list_tool_showcases
--   (migration kế tiếp) chỉ trả url cho showcase public.

-- ─── auction_tools (4 công cụ) ───────────────────────────────────────────────

CREATE TABLE public.auction_tools (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL UNIQUE
                CHECK (key IN ('so-hoa', 'dinh-gia', 'vay-von', 'phap-ly')),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  tagline     TEXT,
  description TEXT,
  icon        TEXT,                                  -- tên icon lucide-react
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auction_tools_public_read"
  ON public.auction_tools FOR SELECT
  USING (is_active = true);

CREATE POLICY "auction_tools_admin_all"
  ON public.auction_tools FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER auction_tools_updated_at
  BEFORE UPDATE ON public.auction_tools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── auction_tool_providers (đối tác cung cấp công cụ) ───────────────────────

CREATE TABLE public.auction_tool_providers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id            UUID        NOT NULL REFERENCES public.auction_tools(id) ON DELETE RESTRICT,
  name               TEXT        NOT NULL,
  slug               TEXT        NOT NULL UNIQUE,      -- URL trang chi tiết
  -- Công cụ nhà (SSCorp) = true → khác nhãn "Đối tác" và không tính hoa hồng.
  is_own             BOOLEAN     NOT NULL DEFAULT false,
  -- Quy doanh thu: supplier nhận hoa hồng, service quyết định direct/commission.
  supplier_id        UUID        REFERENCES public.suppliers(id)         ON DELETE SET NULL,
  service_id         UUID        REFERENCES public.services(id)          ON DELETE SET NULL,
  service_variant_id UUID        REFERENCES public.service_variants(id)  ON DELETE SET NULL,
  logo_url           TEXT,
  tagline            TEXT,
  description        TEXT,                              -- giới thiệu sâu (trang chi tiết)
  website            TEXT,
  price_label        TEXT,                              -- chuỗi hiển thị, vd "Liên hệ báo giá"
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  status             TEXT        NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'inactive')),
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_providers_tool   ON public.auction_tool_providers (tool_id, sort_order);
CREATE INDEX idx_tool_providers_status ON public.auction_tool_providers (status);

ALTER TABLE public.auction_tool_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auction_tool_providers_public_read"
  ON public.auction_tool_providers FOR SELECT
  USING (status = 'active');

CREATE POLICY "auction_tool_providers_admin_all"
  ON public.auction_tool_providers FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER auction_tool_providers_updated_at
  BEFORE UPDATE ON public.auction_tool_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── auction_tool_showcases (showcase của provider) ──────────────────────────

CREATE TABLE public.auction_tool_showcases (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID        NOT NULL REFERENCES public.auction_tool_providers(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  kind          TEXT        NOT NULL DEFAULT 'tour_3d'
                  CHECK (kind IN ('tour_3d', 'image', 'video', 'link')),
  url           TEXT        NOT NULL,
  thumbnail_url TEXT,
  description   TEXT,
  visibility    TEXT        NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'password')),
  -- Bắt buộc có mật khẩu khi visibility='password'; null khi public.
  access_password TEXT,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT showcases_password_check
    CHECK (visibility <> 'password' OR NULLIF(access_password, '') IS NOT NULL)
);

CREATE INDEX idx_tool_showcases_provider ON public.auction_tool_showcases (provider_id, sort_order);

ALTER TABLE public.auction_tool_showcases ENABLE ROW LEVEL SECURITY;

-- CHỈ admin. KHÔNG public_read: `url` (showcase password) + `access_password` là
-- bí mật; MKP đọc qua RPC list_tool_showcases (chỉ trả url cho showcase public).
CREATE POLICY "auction_tool_showcases_admin_all"
  ON public.auction_tool_showcases FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER auction_tool_showcases_updated_at
  BEFORE UPDATE ON public.auction_tool_showcases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Seed 4 công cụ cố định ──────────────────────────────────────────────────
-- Idempotent theo `key` (UNIQUE). Nội dung admin sửa sau nên chỉ chèn khi thiếu.

INSERT INTO public.auction_tools (key, name, slug, tagline, description, icon, sort_order)
VALUES
  ('so-hoa',   'Số hoá tài sản',  'so-hoa-tai-san',
   'Số hoá tài sản đấu giá bằng ảnh 360° và tour 3D thực tế ảo',
   'Biến tài sản thành không gian số: quét 3D, tour thực tế ảo, ảnh 360° giúp người mua khảo sát từ xa trước phiên đấu giá.',
   'ScanLine', 10),
  ('dinh-gia', 'Định giá tài sản', 'dinh-gia-tai-san',
   'Thẩm định giá tài sản độc lập, chuẩn hồ sơ đấu giá',
   'Kết nối đơn vị thẩm định giá uy tín để xác định giá khởi điểm và giá trị thị trường của tài sản chuẩn bị đấu giá.',
   'Scale', 20),
  ('vay-von',  'Hỗ trợ vay vốn',   'ho-tro-vay-von',
   'Kết nối gói vay ưu đãi từ ngân hàng để tham gia đấu giá',
   'Giới thiệu gói tín dụng từ các ngân hàng đối tác giúp người mua chuẩn bị tài chính tham gia và thanh toán tài sản trúng đấu giá.',
   'Landmark', 30),
  ('phap-ly',  'Tư vấn pháp lý',   'tu-van-phap-ly',
   'Tư vấn, soát xét pháp lý hồ sơ tài sản đấu giá',
   'Kết nối chuyên gia pháp lý rà soát tình trạng pháp lý, thủ tục chuyển nhượng và rủi ro của tài sản đấu giá.',
   'Gavel', 40)
ON CONFLICT (key) DO NOTHING;
