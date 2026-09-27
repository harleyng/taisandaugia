import type { Database } from "@/integrations/supabase/types";

export type Asset3dScan = Database["public"]["Tables"]["asset_3d_scans"]["Row"];

export type Asset3dScanStatus = "awaiting_scan" | "processing" | "ready" | "failed" | "expired" | "superseded";

export type Asset3dFormat = "glb" | "usdz" | "embed";

/** Model đã công khai của một lô trong phiên — đọc qua RPC public_session_lot_3d_models. */
export interface Lot3dModel {
  item_id: string;
  model_url: string;
  poster_url: string | null;
  format: Asset3dFormat;
}

/** Kết quả start_asset_3d_scan khi thành công. */
export interface StartedScan {
  scanId: string;
  scanToken: string;
  lotId: string;
  /** true = trả lại phiên quét đang chạy, không trừ credit. */
  reused: boolean;
  cost: number;
  /** true = gói thuê bao của Trạm bao lượt quét này (không trừ credit). */
  covered?: boolean;
  /** Lượt quét còn lại của gói trong tháng khi covered; null = không giới hạn. */
  remaining?: number | null;
}
