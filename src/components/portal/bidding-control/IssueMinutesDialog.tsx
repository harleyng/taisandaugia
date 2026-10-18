import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { BiddingRpcError } from "@/lib/bidding/errors";
import { MINUTES_BUCKET } from "@/lib/bidding/minutes-pdf/input";
import { useIssueMinutes, useSessionAuctioneers, useSessionMinutes } from "@/hooks/useOrgBidding";
import { qk } from "@/lib/queryKeys";
import { useOutreachOrgInfo } from "@/hooks/useSessionOutreach";
import type { LotState, SessionMinutes } from "@/types/auction-bidding";
import type { AuctionSessionItem, AuctionSessionWithItems } from "@/types/auction-session";
import type { ContractWithSession } from "@/types/bidding-contract";

/**
 * Lập và phát hành biên bản đấu giá.
 *
 * TẢI LÊN RỒI GỌI RPC KHÔNG PHẢI MỘT GIAO DỊCH — org_issue_minutes từ chối
 * `file_missing` nếu tệp chưa có trong storage, nên thứ tự bắt buộc là upload
 * trước. Hệ quả và cách xử lý:
 *
 *   • Tải lại CÙNG đường dẫn thì luôn hỏng (upsert:false, bucket không có policy
 *     UPDATE) ⇒ nút "thử lại" CHỈ gọi lại RPC, không bao giờ tạo hay tải tệp mới.
 *   • Chốt trùng của RPC đọc auction_session_minutes.pdf_path, KHÔNG đọc
 *     storage.objects ⇒ gọi lại RPC với cùng đường dẫn: thành công nếu lần trước
 *     hỏng TRƯỚC khi INSERT, trả `invalid_path` nếu đã ghi rồi. Cả hai đều là
 *     kết luận đúng, nên thử lại luôn an toàn.
 *   • Tệp mồ côi (tải lên mà chưa ghi nhận) KHÔNG xoá được, nhưng cũng KHÔNG
 *     công khai: auction_minutes_object_is_public đòi có dòng tương ứng.
 *
 * Không tải gì lên cho tới khi người dùng bấm "Phát hành" — bấm "Tạo biên bản"
 * bao nhiêu lần cũng chỉ dựng blob trong bộ nhớ.
 */

const NO_AUCTIONEER = "__none__";

interface Draft {
  blob: Blob;
  hash: string;
  path: string;
  fileName: string;
  /** Đã nằm trong storage rồi — lần thử lại không được tải lên nữa. */
  uploaded: boolean;
}

interface Props {
  session: AuctionSessionWithItems;
  lots: AuctionSessionItem[];
  stateByLot: Map<string, LotState>;
  contracts: ContractWithSession[];
  canFinalize: boolean;
}

export function IssueMinutesCard({ session, lots, stateByLot, contracts, canFinalize }: Props) {
  const { data: minutes = [], isLoading: minutesLoading } = useSessionMinutes(session.id);
  const { data: auctioneers = [] } = useSessionAuctioneers(session.organization_id);
  const { data: org } = useOutreachOrgInfo(session.auction_org_id);
  const issue = useIssueMinutes(session.id);
  const queryClient = useQueryClient();

  const [auctioneerId, setAuctioneerId] = useState(NO_AUCTIONEER);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!draft) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(draft.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft]);

  // useOutreachOrgInfo lùi về tổ chức đang chọn ở OrgSwitcher khi thiếu
  // auction_org_id — in tên tổ chức khác lên biên bản là sai nghiêm trọng.
  const orgUnknown = !session.auction_org_id;
  const busy = building || uploading || issue.isPending;

  const build = async () => {
    setBuilding(true);
    try {
      const [{ buildMinutesPdfInput, minutesFileName, minutesObjectPath }, { minutesPdfBlob }, { sha256Hex }] =
        await Promise.all([
          import("@/lib/bidding/minutes-pdf/input"),
          import("@/lib/bidding/minutes-pdf"),
          import("@/lib/bidding/minutes-pdf/hash"),
        ]);

      const picked = auctioneers.find((a) => a.id === auctioneerId) ?? null;
      const now = new Date();
      const input = buildMinutesPdfInput({
        session: {
          id: session.id,
          code: session.code,
          title: session.title,
          startsAt: session.starts_at,
          endsAt: session.ends_at,
          venue: session.venue,
          province: session.province,
          auctionFormat: session.auction_format,
          extensionSeconds: session.extension_seconds,
          maxBidSteps: session.max_bid_steps,
          finalizedAt: session.finalized_at,
        },
        org: {
          name: org?.name ?? "Tổ chức đấu giá",
          address: org?.address ?? null,
          phone: org?.phone ?? null,
        },
        // CHỈ họ tên + số thẻ: biên bản công khai sau khi chốt phiên.
        auctioneer: picked ? { fullName: picked.fullName, licenseNumber: picked.licenseNumber || null } : null,
        lots,
        stateByLot,
        contracts,
        now,
      });

      const blob = await minutesPdfBlob(input);
      const hash = await sha256Hex(blob);
      const fileName = minutesFileName(session.code, session.id, hash, now);
      setDraft({
        blob,
        hash,
        fileName,
        path: minutesObjectPath(session.organization_id, session.id, fileName),
        uploaded: false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tạo được biên bản. Vui lòng thử lại.");
    } finally {
      setBuilding(false);
    }
  };

  const record = (d: Draft) =>
    issue.mutate(
      { id: session.id, pdfPath: d.path, hash: d.hash },
      {
        onSuccess: () => setDraft(null),
        onError: (err) => {
          // `invalid_path` sau khi đã tải lên = biên bản này ghi rồi. Bỏ bản nháp
          // và nạp lại danh sách để dòng đã ghi hiện ra — giữ nháp lại chỉ mời
          // người dùng bấm mãi vào một việc đã xong.
          // KHÔNG toast thêm ở đây: useIssueMinutes đã toast lỗi, thêm nữa là hai
          // hộp chồng nhau.
          if (err instanceof BiddingRpcError && err.reason === "invalid_path") {
            setDraft(null);
            queryClient.invalidateQueries({ queryKey: qk.bidding.minutes(session.id) });
          }
        },
      },
    );

  const publish = async () => {
    if (!draft) return;
    if (draft.uploaded) {
      record(draft);
      return;
    }
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from(MINUTES_BUCKET)
        .upload(draft.path, draft.blob, { upsert: false, contentType: "application/pdf" });
      // Tệp đã tồn tại = lần bấm trước đã tải lên xong rồi mới hỏng. Đi tiếp.
      if (error && !/exist|duplicate|409/i.test(error.message)) {
        toast.error("Không tải được biên bản lên. Vui lòng thử lại.");
        return;
      }
      const uploaded = { ...draft, uploaded: true };
      setDraft(uploaded);
      record(uploaded);
    } finally {
      setUploading(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash).then(
      () => toast.success("Đã chép mã kiểm tra."),
      () => toast.error("Không chép được mã kiểm tra."),
    );
  };

  return (
    <Card className="rounded-2xl p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
        <FileText className="h-4 w-4 text-primary" />
        Biên bản đấu giá
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Biên bản do sàn lập từ diễn biến đã ghi nhận. Sau khi phát hành, ai cũng xem được ở trang phiên.
      </p>

      {canFinalize && (
        <div className="space-y-3">
          {orgUnknown && (
            <InfoBox variant="amber" className="text-sm">
              Phiên chưa gắn với tổ chức đấu giá trên sàn nên chưa lập được biên bản.
            </InfoBox>
          )}

          <div className="space-y-1.5">
            <Label>Đấu giá viên điều hành cuộc đấu giá</Label>
            <Select value={auctioneerId} onValueChange={setAuctioneerId} disabled={busy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AUCTIONEER}>— Để trống, ký tay —</SelectItem>
                {auctioneers.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.fullName}
                    {a.licenseNumber ? ` — Thẻ số ${a.licenseNumber}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="w-full gap-1.5" onClick={build} disabled={busy || orgUnknown}>
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {building ? "Đang lập biên bản…" : draft ? "Lập lại biên bản" : "Tạo biên bản"}
          </Button>

          {draft && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-sm font-medium text-foreground">{draft.fileName}</p>
              <InfoBox variant="amber" className="text-xs">
                Rà soát trước khi phát hành — tệp đã phát hành không sửa và không xoá được.
              </InfoBox>
              {draft.uploaded && !issue.isPending && (
                <InfoBox variant="amber" className="text-xs">
                  Tệp đã tải lên nhưng chưa ghi nhận trên sàn. Bấm “Thử ghi nhận lại” — hệ thống dùng lại đúng tệp đã
                  tải, không tạo tệp mới.
                </InfoBox>
              )}
              <div className="flex flex-wrap gap-2">
                {previewUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank", "noopener")}>
                    Xem thử
                  </Button>
                )}
                <Button size="sm" className="gap-1.5" onClick={publish} disabled={busy}>
                  {(uploading || issue.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {draft.uploaded ? "Thử ghi nhận lại" : "Phát hành biên bản"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">Biên bản đã phát hành</p>
        {minutesLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải…</p>
        ) : minutes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa phát hành biên bản nào.</p>
        ) : (
          minutes.map((m: SessionMinutes) => (
            <div key={m.id} className="space-y-1.5 rounded-xl bg-muted p-3">
              <p className="text-sm text-foreground">
                Biên bản lần {m.sequence_no} · ghi nhận lúc {formatDateTime(m.issued_at)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ContractFileButton path={m.pdf_path} bucket={MINUTES_BUCKET} label="Mở biên bản" />
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => copyHash(m.content_hash)}>
                  <Copy className="h-3.5 w-3.5" />
                  Chép mã kiểm tra
                </Button>
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">SHA-256 {m.content_hash}</p>
              <p className="text-xs text-muted-foreground">Tải tệp về và tính SHA-256 để đối chiếu.</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
