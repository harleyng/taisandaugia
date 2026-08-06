-- ─────────────────────────────────────────────────────────────────────────────
-- Báo cáo tuân thủ bồi dưỡng đấu giá viên TOÀN SÀN (/admin/bao-cao/boi-duong)
--
-- RPC này CỐ Ý KHÔNG TRẢ TRẠNG THÁI TUÂN THỦ, chỉ trả số liệu thô đã gộp.
--
-- Quy tắc kết luận (miễn ▸ hình thức thay thế Điều 26.2 ▸ đủ 8 giờ) sống ở
-- src/lib/personnel/cpd.ts và đã có ba nơi gọi phía portal. Nhân bản nó sang SQL
-- là mời gọi trôi lệch — repo đã dính đúng lỗi đó ở báo cáo Tin đấu giá (logic
-- sessionStatus tồn tại hai bản SQL và TS). Ở đây SQL chỉ làm việc SQL giỏi
-- (gộp), TypeScript giữ nguyên một bản quy tắc duy nhất.
--
-- Hệ quả kiểm chứng được: số "đã đạt" của một tổ chức trên trang này phải KHỚP
-- tuyệt đối với trang /portal/boi-duong của chính tổ chức đó.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_cpd_report(
  _year     INT,
  _province TEXT  DEFAULT NULL,
  _org_id   UUID  DEFAULT NULL,
  _q        TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rows JSONB;
  _n    INT;
  -- Chặn runaway: bảng chi tiết phân trang phía client nên phải có trần. Số bị
  -- cắt trả ra ngoài để UI nói rõ, không im lặng như thể đã phủ hết.
  _cap  CONSTANT INT := 2000;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH people AS (
    SELECT
      a.id                AS auctioneer_id,
      a.organization_id,
      a.auction_org_id,
      a.full_name,
      a.position,
      a.license_number,
      a.license_expiry_date,
      COALESCE(o.name, ao.name, '(Chưa đặt tên)') AS org_name,
      ao.province
    FROM public.org_auctioneers a
    LEFT JOIN public.organizations        o  ON o.id  = a.organization_id
    LEFT JOIN public.auction_organizations ao ON ao.id = a.auction_org_id
    -- Nghĩa vụ chỉ áp cho người ĐANG hành nghề — khớp `applicable` ở useOrgCpd.
    WHERE a.is_active
      AND (_org_id   IS NULL OR a.organization_id = _org_id)
      AND (_province IS NULL OR ao.province = _province)
      AND (_q IS NULL OR btrim(_q) = '' OR a.full_name ILIKE '%' || btrim(_q) || '%')
  ),
  records AS (
    SELECT
      e.auctioneer_id,
      e.cpd_kind,
      e.hours,
      e.is_accredited_provider,
      cardinality(COALESCE(e.attachments, '{}')) AS attachment_count
    FROM public.org_auctioneer_events e
    WHERE e.event_type = 'TRAINING'
      AND e.cpd_kind IS NOT NULL
      -- Suy năm y hệt `cpdEventYear` phía TS: ưu tiên cpd_year, thiếu thì lấy
      -- năm của started_on (bản ghi cũ trước khi có cột này).
      AND COALESCE(e.cpd_year, EXTRACT(YEAR FROM e.started_on)::SMALLINT) = _year::SMALLINT
  ),
  agg AS (
    SELECT
      r.auctioneer_id,
      COALESCE(SUM(r.hours) FILTER (WHERE r.cpd_kind = 'COURSE'), 0)::NUMERIC AS course_hours,
      COALESCE(
        ARRAY_AGG(DISTINCT r.cpd_kind) FILTER (WHERE r.cpd_kind <> 'COURSE'),
        '{}'
      ) AS alt_kinds,
      COUNT(*)::INT AS records_total,
      COUNT(*) FILTER (WHERE r.attachment_count = 0)::INT AS records_without_proof,
      COUNT(*) FILTER (
        WHERE r.cpd_kind = 'COURSE' AND NOT r.is_accredited_provider
      )::INT AS records_unaccredited
    FROM records r
    GROUP BY r.auctioneer_id
  )
  SELECT
    COALESCE(jsonb_agg(t ORDER BY t.org_name, t.full_name), '[]'::jsonb),
    COUNT(*)::INT
  INTO _rows, _n
  FROM (
    SELECT
      p.auctioneer_id,
      p.organization_id,
      p.auction_org_id,
      p.org_name,
      p.province,
      p.full_name,
      p.position,
      p.license_number,
      p.license_expiry_date,
      COALESCE(g.course_hours, 0)          AS course_hours,
      COALESCE(g.alt_kinds, '{}')          AS alt_kinds,
      COALESCE(g.records_total, 0)         AS records_total,
      COALESCE(g.records_without_proof, 0) AS records_without_proof,
      COALESCE(g.records_unaccredited, 0)  AS records_unaccredited,
      (x.id IS NOT NULL)                   AS is_exempt,
      x.reason                             AS exempt_reason
    FROM people p
    LEFT JOIN agg g ON g.auctioneer_id = p.auctioneer_id
    LEFT JOIN public.org_auctioneer_cpd_exemptions x
           ON x.auctioneer_id = p.auctioneer_id AND x.year = _year::SMALLINT
    ORDER BY p.org_name, p.full_name
    LIMIT _cap
  ) t;

  RETURN jsonb_build_object(
    'year', _year,
    'rows', _rows,
    'truncated', _n >= _cap,
    'cap', _cap
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_cpd_report(INT, TEXT, UUID, TEXT) TO authenticated;

-- Danh sách tỉnh để dựng bộ lọc — không tự suy từ rows vì rows đã bị lọc.
CREATE OR REPLACE FUNCTION public.admin_cpd_report_filters()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'provinces', COALESCE((
      SELECT jsonb_agg(DISTINCT ao.province ORDER BY ao.province)
      FROM public.org_auctioneers a
      JOIN public.auction_organizations ao ON ao.id = a.auction_org_id
      WHERE a.is_active AND ao.province IS NOT NULL AND ao.province <> ''
    ), '[]'::jsonb),
    'organizations', COALESCE((
      SELECT jsonb_agg(o ORDER BY o->>'name')
      FROM (
        SELECT DISTINCT jsonb_build_object(
          'id', a.organization_id,
          'name', COALESCE(org.name, ao.name, '(Chưa đặt tên)')
        ) AS o
        FROM public.org_auctioneers a
        LEFT JOIN public.organizations         org ON org.id = a.organization_id
        LEFT JOIN public.auction_organizations ao  ON ao.id  = a.auction_org_id
        WHERE a.is_active
      ) s
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_cpd_report_filters() TO authenticated;

NOTIFY pgrst, 'reload schema';
