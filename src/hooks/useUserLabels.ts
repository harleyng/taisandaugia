import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserLabel {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Nạp nhãn hiển thị (email/tên) cho danh sách userId đã chọn.
 * Dùng cho "Danh sách cụ thể" ở màn tạo/sửa chiến dịch: ids có thể đến từ
 * typeahead (đã biết nhãn) hoặc từ bản ghi cũ khi sửa (cần back-fill).
 * `seed` cho phép nạp sẵn nhãn ngay khi người dùng chọn, tránh gọi lại DB.
 */
export function useUserLabels(userIds: string[]) {
  const [labels, setLabels] = useState<Record<string, UserLabel>>({});

  useEffect(() => {
    const missing = userIds.filter((id) => !labels[id]);
    if (missing.length === 0) return;
    supabase
      .from("profiles")
      .select("id,email,name")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) return;
        setLabels((prev) => {
          const next = { ...prev };
          for (const u of data) next[u.id] = u as UserLabel;
          return next;
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds]);

  const seed = useCallback(
    (u: UserLabel) => setLabels((prev) => ({ ...prev, [u.id]: u })),
    [],
  );

  return { labels, seed };
}
