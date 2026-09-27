import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerConsignmentSummary } from "@/hooks/useConsignmentContract";
import { qk } from "@/lib/queryKeys";
import { consignmentStageOf, type OwnerConsignmentStage } from "@/lib/consignment/ownerConsignment";
import { isConsignmentOwnerAction, type OwnerConsignmentSummaryRow } from "@/lib/consignment/postingBadge";
import { kgNextLine, kgStageOf, kgStatusOf, type KgStatus } from "@/lib/consignment/ownerConsignmentView";
import type {
  AssetPostingReviewStatus,
  AssetPostingStatus,
  BrokerRequestStatus,
  ServiceRequestStatus,
} from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

/**
 * Hồ sơ + chuỗi ký gửi trong MỘT lượt đọc. Kiểu `string` như PIPELINE_POSTING_SELECT:
 * dòng được ép về ConsignmentPostingRow, không để supabase-js dựng kiểu lồng.
 */
const CONSIGNMENT_POSTING_SELECT: string = `
  id, code, title, status, review_status, parent_slug, child_slug, district, province, branch_id,
  starting_price, image_urls, created_at, updated_at,
  requests:asset_service_requests(status, created_at, updated_at, auction_org_id, broker_request_id,
    org:auction_organizations(name)),
  brokers:asset_broker_requests(id, status, created_at),
  contracts:consignment_contracts(status, created_at, signed_at)
`;

interface ConsignmentPostingRow {
  id: string;
  code: string;
  title: string;
  status: AssetPostingStatus;
  review_status: AssetPostingReviewStatus | null;
  parent_slug: string;
  child_slug: string;
  district: string | null;
  province: string | null;
  branch_id: string | null;
  starting_price: number | null;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
  requests:
    | {
        status: ServiceRequestStatus;
        created_at: string;
        updated_at: string;
        auction_org_id: string;
        broker_request_id: string | null;
        org: { name: string } | null;
      }[]
    | null;
  brokers: { id: string; status: BrokerRequestStatus; created_at: string }[] | null;
  contracts: { status: ConsignmentContractStatus; created_at: string; signed_at: string | null }[] | null;
}

/** Một tổ chức đã nhận hồ sơ — chấm tròn ở cột "Tổ chức". */
export interface ConsignmentOrgDot {
  orgId: string;
  orgName: string;
  status: ServiceRequestStatus;
}

const OPEN_BROKER: readonly BrokerRequestStatus[] = ["pending", "sourcing", "quoted"];

export interface OwnerConsignmentRow {
  posting: Omit<ConsignmentPostingRow, "requests" | "brokers" | "contracts">;
  stage: OwnerConsignmentStage;
  /** Nhãn / bên phải làm / bước theo thiết kế Ký gửi. */
  kg: KgStatus;
  /** Câu "bước tiếp theo". */
  nextLine: string;
  summary: OwnerConsignmentSummaryRow | null;
  /** Có việc ký gửi cho người đang xem — đếm vào số trên menu. */
  needsAction: boolean;
  /** Theo thứ tự gửi. */
  orgs: ConsignmentOrgDot[];
  sentCount: number;
  quotedCount: number;
  declinedCount: number;
  /** Nhờ sàn đang mở: số tổ chức sàn đã gửi hộ. */
  brokerOpen: boolean;
  brokerContacted: number;
  /** Tên tổ chức đã chốt (nếu có). */
  chosenOrgName: string | null;
  /** Lần cuối luồng ký gửi có chuyển động — để sắp xếp và hiện "Cập nhật". */
  lastActivityAt: string;
}

function latest(values: (string | null | undefined)[]): string {
  let out = "";
  for (const v of values) if (v && v > out) out = v;
  return out;
}

function toRow(p: ConsignmentPostingRow, summary: OwnerConsignmentSummaryRow | null): OwnerConsignmentRow | null {
  const requests = [...(p.requests ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const brokers = [...(p.brokers ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const contracts = p.contracts ?? [];
  const broker = brokers[0] ?? null;
  const stage = consignmentStageOf({
    postingStatus: p.status,
    reviewStatus: p.review_status,
    requestStatuses: requests.map((r) => r.status),
    brokerStatus: broker?.status ?? null,
    contractStatuses: contracts.map((c) => c.status),
  });
  if (!stage) return null;

  const { requests: _r, brokers: _b, contracts: _c, ...posting } = p;
  const brokerOpen = !!broker && OPEN_BROKER.includes(broker.status);
  const ownerAction = isConsignmentOwnerAction(summary?.owner_action) ? summary!.owner_action : null;
  const kg = kgStatusOf(kgStageOf(stage, brokerOpen), ownerAction);
  const chosen = requests.find((r) => r.status === "selected" || r.status === "accepted");
  const quotedCount = requests.filter((r) => r.status === "quoted" || r.status === "selected").length;
  const declinedCount = requests.filter((r) => r.status === "declined").length;
  const chosenOrgName = chosen?.org?.name ?? null;

  return {
    posting,
    stage,
    kg,
    nextLine: kgNextLine(kg, {
      waitingCount: requests.filter((r) => r.status === "sent" || r.status === "seen").length,
      sentCount: requests.length,
      declinedCount,
      quotedCount,
      orgName: chosenOrgName,
    }),
    summary,
    needsAction: ownerAction !== null,
    orgs: requests.map((r) => ({ orgId: r.auction_org_id, orgName: r.org?.name ?? "Tổ chức đấu giá", status: r.status })),
    sentCount: requests.length,
    quotedCount,
    declinedCount,
    brokerOpen,
    brokerContacted: broker ? requests.filter((r) => r.broker_request_id === broker.id).length : 0,
    chosenOrgName,
    lastActivityAt: latest([
      p.updated_at,
      ...requests.map((r) => r.updated_at),
      ...brokers.map((b) => b.created_at),
      ...contracts.flatMap((c) => [c.created_at, c.signed_at]),
    ]),
  };
}

/**
 * Menu "Ký gửi đấu giá": hồ sơ của TENANT đang chọn đã vào (hoặc sẵn sàng vào)
 * luồng ký gửi. Việc cần làm lên đầu, rồi theo lần chuyển động gần nhất.
 */
export function useOwnerConsignments() {
  const { userId } = useAuth();
  const { workspaceId, isPersonal, tenantKey, isLoading: tenantLoading } = useOwnerWorkspace();
  const { data: summary } = useOwnerConsignmentSummary();

  const query = useQuery({
    queryKey: qk.ownerConsignmentPostings(userId, tenantKey),
    enabled: !!userId && !tenantLoading && !!tenantKey,
    queryFn: async (): Promise<ConsignmentPostingRow[]> => {
      let q = supabase
        .from("asset_postings")
        .select(CONSIGNMENT_POSTING_SELECT)
        .not("status", "in", "(draft,cancelled)");
      // Lọc tường minh như useMyPostings — admin đọc được mọi hồ sơ qua RLS.
      q = isPersonal ? q.is("workspace_id", null).eq("user_id", userId!) : q.eq("workspace_id", workspaceId!);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ConsignmentPostingRow[];
    },
  });

  const rows = useMemo(() => {
    const out: OwnerConsignmentRow[] = [];
    for (const p of query.data ?? []) {
      const row = toRow(p, summary?.byPosting[p.id] ?? null);
      if (row) out.push(row);
    }
    return out.sort(
      (a, b) => Number(b.needsAction) - Number(a.needsAction) || b.lastActivityAt.localeCompare(a.lastActivityAt),
    );
  }, [query.data, summary]);

  return { rows, isLoading: query.isLoading, error: query.error };
}
