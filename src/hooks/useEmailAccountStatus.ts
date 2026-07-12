import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tra xem mỗi email import (spec.emails) có khớp tài khoản (profiles) hay không —
 * để "Danh sách cụ thể" gắn badge "Chưa có tài khoản" cho email ngoài hệ thống.
 *
 * Trả về map email(lowercase) → hasAccount. Email CHƯA có trong map = chưa tra
 * xong (không kết luận vội để tránh gắn badge nhầm khi đang tải). Back-fill dần
 * theo lô như useUserLabels. So khớp lowercase — nhất quán với fetchOptOut và
 * nhánh email-ngoài-hệ-thống của RPC (lower(p.email) = email).
 */
export function useEmailAccountStatus(emails: string[]) {
  const [status, setStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const lower = emails.map((e) => e.toLowerCase());
    const missing = Array.from(new Set(lower.filter((e) => !(e in status))));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const found = new Set<string>();
      const CHUNK = 200;
      for (let i = 0; i < missing.length; i += CHUNK) {
        const chunk = missing.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("profiles")
          .select("email")
          .in("email", chunk);
        if (error) return; // giữ nguyên trạng thái đã biết; lần render sau thử lại
        for (const r of data ?? []) {
          if (r.email) found.add(String(r.email).toLowerCase());
        }
      }
      if (cancelled) return;
      setStatus((prev) => {
        const next = { ...prev };
        for (const e of missing) next[e] = found.has(e);
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emails]);

  return status;
}
