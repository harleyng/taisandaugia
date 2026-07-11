-- Đổi wording "banner" → "chiến dịch" trong thông báo lỗi vị trí unique
-- (message hiển thị cho người dùng qua toast). Giữ nguyên tiền tố "Vị trí duy nhất"
-- vì client nhận diện lỗi qua isUniquePositionError (khớp chuỗi này).

CREATE OR REPLACE FUNCTION public.enforce_unique_ad_position()
RETURNS TRIGGER AS $$
DECLARE
  v_type     TEXT;
  v_conflict INTEGER;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'active') THEN
    RETURN NEW;
  END IF;

  SELECT placement_type INTO v_type
  FROM public.ad_positions
  WHERE id = NEW.position_id;

  IF v_type IS DISTINCT FROM 'unique' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_conflict
  FROM public.advertisements a
  WHERE a.position_id = NEW.position_id
    AND a.id <> NEW.id
    AND a.status IN ('scheduled', 'active')
    AND tstzrange(COALESCE(a.start_at, now()), COALESCE(a.end_at, 'infinity'::timestamptz))
        && tstzrange(COALESCE(NEW.start_at, now()), COALESCE(NEW.end_at, 'infinity'::timestamptz));

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Vị trí duy nhất (unique) đã có chiến dịch khác chạy trong khoảng thời gian trùng lặp'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
