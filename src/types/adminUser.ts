// Types for the admin "Quản lý người dùng" module.
import type { InvoiceInfo } from "@/lib/credits";

// Derived status shown in the list badge (priority: locked → not_activated → active).
export type AccountStatus = "active" | "not_activated" | "locked";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  activated: boolean;
  activated_at: string | null;
  lockStatus: "active" | "locked"; // profiles.status — mirror of GoTrue ban
  kyc_status: string;
  notifications_enabled: boolean;
  invoice_info: InvoiceInfo | null;
  balance: number;
  isAdmin: boolean;
}

export interface AdminUserTransaction {
  id: string;
  type: string;
  description: string;
  credit_delta: number;
  created_at: string;
}

export interface AdminUserUnlocks {
  assets: number;
  companies: number;
  owners: number;
  reports: number;
}

export interface AdminUserStats {
  total: number;
  active: number; // activated && not locked
  newThisWeek: number;
  newThisMonth: number;
  topupThisMonth: number; // credits granted/purchased this month
}

// Derive the single badge status from the two independent dimensions.
export const accountStatus = (u: Pick<AdminUser, "lockStatus" | "activated">): AccountStatus =>
  u.lockStatus === "locked" ? "locked" : !u.activated ? "not_activated" : "active";
