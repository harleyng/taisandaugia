// Dữ liệu trang in hồ sơ số hoá (/chu-tai-san/dang-tai-san/:id/in): gom đúng các query của
// trang chi tiết (cùng queryKey ⇒ mở từ trang chi tiết là có sẵn cache) + tên chủ tài sản
// và dung lượng giấy tờ.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePostingDetail } from "@/hooks/useAssetPosting";
import { useOwnerConsignmentSummary, usePostingContracts } from "@/hooks/useConsignmentContract";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { useLegalConsultItems, usePostingLegalConsultations } from "@/hooks/useLegalConsultations";
import { summarizeScans, usePostingScans } from "@/hooks/useAsset3dScans";
import { usePostingVrOrders } from "@/hooks/useVrTourOrders";
import { usePostingAuthenticationOrders } from "@/hooks/useAuthenticationOrders";
import { useDossierItems } from "@/hooks/useDossierItems";
import { usePostingValuationOrders } from "@/hooks/useValuationOrders";
import { summarizeValuations } from "@/lib/valuation/status";
import { digitizeStatusOf } from "@/lib/asset-posting/digitizeStatus";
import { summarizeConsultations } from "@/lib/legalConsult/status";
import { summarizeVrOrders } from "@/lib/vrTour/status";
import { summarizeGdOrders } from "@/lib/authentication/status";
import { LEGAL_DOC_BUCKET } from "@/lib/legalConsult/paths";
import type { AssetPosting } from "@/types/asset-posting";

/** Kết quả thẩm định giá in ở mục 05 — từ đơn của sàn hoặc đối tác riêng của chủ. */
export interface PrintAppraisal {
  source: "platform" | "external";
  partnerName: string | null;
  value: number;
  issuedAt: string | null;
  validUntil: string | null;
  certificateNo: string | null;
}

/** Dung lượng từng giấy tờ (bytes) theo đường dẫn — liệt kê theo thư mục, lỗi thì bỏ trống. */
function useDocSizes(paths: string[]) {
  return useQuery({
    queryKey: ["posting-print", "doc-sizes", ...paths],
    enabled: paths.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const byFolder = new Map<string, string[]>();
      for (const p of paths) {
        const i = p.lastIndexOf("/");
        const folder = i >= 0 ? p.slice(0, i) : "";
        byFolder.set(folder, [...(byFolder.get(folder) ?? []), p]);
      }
      const sizes: Record<string, number> = {};
      await Promise.all(
        [...byFolder.entries()].map(async ([folder, files]) => {
          const { data } = await supabase.storage.from(LEGAL_DOC_BUCKET).list(folder, { limit: 1000 });
          for (const obj of data ?? []) {
            const full = folder ? `${folder}/${obj.name}` : obj.name;
            const size = (obj.metadata as { size?: number } | null)?.size;
            if (files.includes(full) && typeof size === "number") sizes[full] = size;
          }
        }),
      );
      return sizes;
    },
  });
}

function useWorkspaceName(workspaceId: string | null) {
  return useQuery({
    queryKey: ["posting-print", "workspace-name", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_workspaces")
        .select("primary_name")
        .eq("id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data?.primary_name ?? null;
    },
  });
}

export function usePostingPrintData(postingId: string | undefined) {
  const id = postingId ?? null;
  const detail = usePostingDetail(id);
  const posting: AssetPosting | null = detail.data?.posting ?? null;
  const { data: contracts = [], isLoading: contractsLoading } = usePostingContracts(id);
  const { data: summary } = useOwnerConsignmentSummary();
  const { personalName } = useOwnerWorkspace();
  const { data: branches } = useWorkspaceBranchOptions(posting?.branch_id ? posting.workspace_id : null);
  const workspaceName = useWorkspaceName(posting?.workspace_id ?? null);

  const legalRows = usePostingLegalConsultations(id);
  const legal = summarizeConsultations(legalRows.data ?? []);
  const legalItems = useLegalConsultItems(legal.current?.id);

  const scans = usePostingScans(id);
  const vrOrders = usePostingVrOrders(id);
  const gdOrders = usePostingAuthenticationOrders(id);
  const dossierItems = useDossierItems(id);
  const tdgOrders = usePostingValuationOrders(id);

  const docPaths = [...(posting?.ownership_proof_urls ?? []), ...(posting?.doc_urls ?? [])];
  const docSizes = useDocSizes(docPaths);

  const isLoading =
    detail.isLoading ||
    contractsLoading ||
    legalRows.isLoading ||
    (!!legal.current && legalItems.isLoading) ||
    scans.isLoading ||
    vrOrders.isLoading ||
    gdOrders.isLoading ||
    dossierItems.isLoading ||
    tdgOrders.isLoading ||
    workspaceName.isLoading ||
    (docPaths.length > 0 && docSizes.isLoading);

  if (!posting || !detail.data) return { isLoading, data: null };

  const status = digitizeStatusOf({
    postingStatus: posting.status,
    reviewStatus: posting.review_status,
    requestStatuses: detail.data.requests.map((r) => r.status),
    brokerStatus: detail.data.brokerRequest?.status ?? null,
    contractStatuses: contracts.map((c) => c.status),
    ownerAction: summary?.byPosting[posting.id]?.owner_action ?? null,
  });
  const s3 = summarizeScans(scans.data ?? []);
  const vr = summarizeVrOrders(vrOrders.data ?? []);
  const gd = summarizeGdOrders(gdOrders.data ?? []);
  const tdg = summarizeValuations(tdgOrders.data ?? []).current;
  const appRow = dossierItems.data?.find((r) => r.kind === "appraisal") ?? null;
  const external: PrintAppraisal | null =
    appRow?.source === "external_partner" && appRow.appraised_value != null
      ? {
          source: "external",
          partnerName: appRow.partner_name,
          value: Number(appRow.appraised_value),
          issuedAt: appRow.issued_at,
          validUntil: appRow.valid_until,
          certificateNo: null,
        }
      : null;
  const platform: PrintAppraisal | null =
    tdg?.appraised_value != null
      ? {
          source: "platform",
          partnerName: tdg.partner_name,
          value: Number(tdg.appraised_value),
          issuedAt: tdg.valuation_date,
          validUntil: tdg.valid_until,
          certificateNo: tdg.certificate_no,
        }
      : null;

  return {
    isLoading,
    data: {
      posting,
      status,
      branch: posting.branch_id ? (branches?.find((b) => b.id === posting.branch_id)?.label ?? null) : null,
      ownerName: posting.workspace_id
        ? (workspaceName.data ?? null)
        : (personalName ?? posting.ownership_declaration?.name ?? null),
      docSizes: docSizes.data ?? {},
      legal: { current: legal.current, active: !!legal.active, items: legalItems.data ?? [] },
      /** Kết quả thẩm định giá — theo nguồn chủ đã chọn, thiếu thì lấy nguồn còn lại; chưa có thì không in mục. */
      appraisal: (appRow?.source === "external_partner" ? (external ?? platform) : (platform ?? external)) as PrintAppraisal | null,
      // Có dịch vụ = thẻ media "has"; url null ⇒ QR trỏ về trang hồ sơ (vd. chứng thư ở bucket private).
      media: {
        model3d: { has: !!s3.current, url: s3.current?.model_url ?? null },
        vr: { has: !!vr.attached, url: vr.attached?.vr_url ?? null },
        certificate: { has: !!gd.completed, url: null as string | null },
      },
    },
  };
}

export type PostingPrintData = NonNullable<ReturnType<typeof usePostingPrintData>["data"]>;
