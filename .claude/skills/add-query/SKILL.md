---
name: add-query
description: Add a TanStack React Query read or write for taisandaugia — a typed supabase client select with the queryKey convention, or a useMutation that invalidates the right key + toasts. Reads respect RLS; writes go through the typed client. Use PROACTIVELY when a component needs server data or a persisted write. Trigger phrases "fetch X", "load data", "add a query/mutation", "save to the DB", "wire up React Query". (This project has NO in-memory store — always go through Supabase.)
---

# /add-query — read/write server state via React Query

taisandaugia has **no hand-rolled store and no mock path** — all state is real Supabase reached through TanStack React Query. Put hooks in `src/hooks/` and consume them from pages. Copy the shape of `src/hooks/useAssetPosting.ts` (reads + mutation) and `src/hooks/useCredits.tsx` (user-scoped read). Import the client from `@/integrations/supabase/client` — there is **no versioned client**.

## 1. Read — `useQuery`
```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
type Row = Database["public"]["Tables"]["<table>"]["Row"];

export function useMyThings() {
  const { userId } = useAuth();                      // single auth source — never getSession
  return useQuery({
    queryKey: ["my-things", userId],                 // key convention below
    queryFn: async () => {
      const { data, error } = await supabase
        .from("<table>").select("*").eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;                         // ALWAYS throw — React Query captures it
      return (data ?? []) as Row[];
    },
    enabled: !!userId,                               // don't fire before auth resolves
  });
}
```
- **queryKey convention:** `[<"kebab-entity">, <scopingId>]` — user-scoped keys end in `userId` (`["my-postings", userId]`, `["user-credits", userId]`); global pools take no id (`["matched-orgs-pool"]`); detail keys take the row id (`["posting-detail", id]`).
- **Loading/error:** consume `isLoading`/`error` from the hook in the page; never read a half-loaded `data`.
- **RLS does the filtering** — but still `.eq("user_id", userId)` for correctness and index use.
- `staleTime` for rarely-changing pools (the global default is `60_000`; matched-orgs uses `5 * 60 * 1000`).

## 2. Write — `useMutation`
```ts
const qc = useQueryClient();
return useMutation({
  mutationFn: async (payload: …) => {
    if (!userId) throw new Error("Bạn cần đăng nhập.");
    const { data, error } = await supabase.from("<table>").insert({ ...payload, user_id: userId }).select("id").single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["my-things", userId] });   // invalidate EXACTLY the affected key
    toast.success("Đã lưu");                                     // sonner; Vietnamese
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : "Không thể lưu. Vui lòng thử lại."),
});
```
Credit/unlock writes are special — they already invalidate `["user-credits", userId]` inside `useCredits`; don't hand-roll them, go through **`/add-unlock`**.

## 3. Non-negotiables
- **Throw on `error`** in every `queryFn`/`mutationFn` — a swallowed Supabase error shows an empty screen with no signal.
- **Invalidate, don't refetch by hand** — after a write, `invalidateQueries` the key(s) the write touched (and only those).
- Type rows from `Database["public"]["Tables"][…]["Row"|"Insert"]` — never `any`.
- Toasts are **sonner** (`import { toast } from "sonner"`) with **Vietnamese** copy.

## 4. Verify + log
Phase 4: `npm run lint && npm run build` green. New query-key or a cross-cutting caching decision → close with **`/log-decision`** (update `architecture.md`).
