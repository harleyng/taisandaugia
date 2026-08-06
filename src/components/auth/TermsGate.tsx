import { useTermsGate } from "@/hooks/useTermsGate";

/**
 * Component vô hình gắn cổng đồng ý điều khoản một lần cho toàn app.
 * Đặt bên trong AuthProvider (cần useAuth) và QueryClientProvider (cần React Query).
 */
export function TermsGate(): null {
  useTermsGate();
  return null;
}
