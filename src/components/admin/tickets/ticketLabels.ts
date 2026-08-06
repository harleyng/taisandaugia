// Nhãn nguồn ticket.
//
// Tách khỏi TicketStatusBadge.tsx để file component chỉ xuất component (rule
// react-refresh/only-export-components); TicketTable, RevenueByServiceTable và
// lib/reports/revenueSource cũng dùng hàm này mà không cần JSX.

import { SOURCE_LABELS } from "@/lib/tickets/ticketStatus";
import type { TicketSource } from "@/types/tickets";

export const sourceLabel = (s: TicketSource): string => SOURCE_LABELS[s] ?? s;
