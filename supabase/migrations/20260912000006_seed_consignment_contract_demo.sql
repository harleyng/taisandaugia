-- Demo: hợp đồng ký gửi của hồ sơ demo phiên đấu giá (Bảo Tín) coi như đã ký
--
-- Seed 20260911000004 tạo sẵn một yêu cầu 'selected' để tab "Ký gửi đã trúng"
-- trong hộp thoại thêm lô có dữ liệu. Từ khi phiên đòi hợp đồng đã ký, tab đó
-- rỗng nếu hợp đồng backfill vẫn 'drafting'. source='backfill' được miễn điều
-- kiện có bản scan (cc_signed_complete) — đây là dữ liệu demo, không phải hợp
-- đồng thật.

UPDATE public.consignment_contracts
   SET status             = 'signed',
       contract_no        = 'DEMO-HDDV-001',
       signed_date        = CURRENT_DATE - 8,
       owner_confirmed_at = now() - interval '8 days',
       org_confirmed_at   = now() - interval '8 days',
       signed_at          = now() - interval '8 days'
 WHERE service_request_id = 'a5e5d001-0000-4000-8000-000000000002'
   AND source = 'backfill'
   AND status = 'drafting';

INSERT INTO public.consignment_contract_events (contract_id, action, data)
SELECT c.id, 'signed', jsonb_build_object('source', 'demo_seed')
  FROM public.consignment_contracts c
 WHERE c.service_request_id = 'a5e5d001-0000-4000-8000-000000000002'
   AND c.status = 'signed'
   AND NOT EXISTS (SELECT 1 FROM public.consignment_contract_events e
                    WHERE e.contract_id = c.id AND e.action = 'signed');
