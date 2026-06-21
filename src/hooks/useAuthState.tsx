import { useAuth } from "@/contexts/AuthContext";

/**
 * Wrapper mỏng quanh `useAuth()` để giữ nguyên API cũ `{ session, loading, userId }`
 * cho các call site hiện có (AuctionDetail, ListingDetail, Listings…). Nguồn auth
 * thật sự là AuthProvider — không còn tự `getSession`/subscribe ở đây.
 */
export function useAuthState() {
  const { session, loading, userId } = useAuth();
  return { session, loading, userId };
}
