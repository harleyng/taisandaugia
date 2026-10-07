import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/shared/InfoBox";
import { useOrgCheckIn } from "@/hooks/useSessionCheckin";
import { biddingReasonMessage } from "@/lib/bidding/errors";
import { bidderCardPrintPath, formatBidderNo } from "@/lib/biddingContracts/paths";
import {
  BUYER_KIND_LABELS,
  CHECKIN_ATTENDEE_LABELS,
  ID_TYPE_LABELS,
  KYC_FIELD_LABELS,
  type CheckInResult,
  type CheckinAttendee,
  type CheckinLookupMatch,
  type IdType,
  type KycField,
} from "@/types/bidding-contract";
import { KycImageThumb } from "./KycImageThumb";

interface Props {
  match: CheckinLookupMatch | null;
  onOpenChange: (open: boolean) => void;
}

const formatDob = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

/**
 * Đối chiếu giấy tờ tại cửa rồi điểm danh ⇒ số báo danh NGẪU NHIÊN do server cấp.
 * Hồ sơ có người được uỷ quyền ⇒ nhân viên chọn ai đang có mặt.
 */
export function CheckInConfirmDialog({ match, onOpenChange }: Props) {
  const checkIn = useOrgCheckIn();
  const [attendee, setAttendee] = useState<CheckinAttendee>("principal");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);

  useEffect(() => {
    if (!match) return;
    setAttendee("principal");
    setNote("");
    setResult(null);
  }, [match]);

  if (!match) return null;

  const already = match.checked_in_at != null && match.bidder_no != null;
  const issuedNo = result?.bidder_no ?? (already ? match.bidder_no : null);
  const blocked = !already && match.block_reason ? biddingReasonMessage(match.block_reason) : null;

  const submit = () =>
    checkIn.mutate(
      { contractId: match.id, attendee, note: note.trim() || undefined },
      { onSuccess: (r) => setResult(r) },
    );

  const printCard = () => window.open(bidderCardPrintPath(match.session_id, match.id) + "?auto=1", "_blank");

  return (
    <Dialog open={!!match} onOpenChange={(v) => !checkIn.isPending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{issuedNo != null ? "Đã điểm danh" : "Đối chiếu & điểm danh"}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{match.code}</span> · {BUYER_KIND_LABELS[match.buyer_kind]}
            {match.org_name && ` · ${match.org_name} (MST ${match.org_tax_code})`}
          </DialogDescription>
        </DialogHeader>

        {issuedNo != null ? (
          <div className="space-y-3 py-2 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">Số báo danh</p>
            <p className="font-mono text-7xl font-bold tracking-wider text-primary">{formatBidderNo(issuedNo)}</p>
            <p className="text-sm text-foreground">
              {match.full_name}
              {(result?.attendee ?? match.checkin_attendee) === "proxy" &&
                ` — người được uỷ quyền: ${match.proxy_full_name}`}
            </p>
            {result?.already && (
              <p className="text-xs text-muted-foreground">Người này đã điểm danh trước đó — giữ nguyên số.</p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {blocked && (
              <InfoBox variant="amber" className="text-sm">
                {blocked}
              </InfoBox>
            )}

            <PersonBlock
              title={match.buyer_kind === "organization" ? "Người đại diện theo pháp luật" : "Người đăng ký"}
              fullName={match.full_name}
              idType={match.id_type}
              idNumber={match.id_number}
              dob={match.date_of_birth}
              frontPath={match.id_front_path}
              backPath={match.id_back_path}
              edited={match.id_edited_fields}
            />

            {match.has_proxy && (
              <>
                <PersonBlock
                  title="Người được uỷ quyền"
                  fullName={match.proxy_full_name ?? "—"}
                  idType={match.proxy_id_type ?? "cccd"}
                  idNumber={match.proxy_id_number ?? "—"}
                  dob={match.proxy_date_of_birth}
                  frontPath={match.proxy_id_front_path}
                  backPath={match.proxy_id_back_path}
                  edited={match.proxy_id_edited_fields}
                />
                <div className="w-40">
                  <KycImageThumb path={match.poa_doc_path} label="Giấy uỷ quyền" />
                </div>
              </>
            )}

            {!blocked && (
              <div className="space-y-4 rounded-xl border border-border p-4">
                {match.has_proxy && (
                  <div className="space-y-2">
                    <Label>
                      Người có mặt <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                      value={attendee}
                      onValueChange={(v) => setAttendee(v as CheckinAttendee)}
                      className="flex flex-wrap gap-4"
                    >
                      {(["principal", "proxy"] as const).map((a) => (
                        <label key={a} className="flex cursor-pointer items-center gap-2 text-sm">
                          <RadioGroupItem value={a} />
                          {CHECKIN_ATTENDEE_LABELS[a]}
                          <span className="text-muted-foreground">
                            ({a === "principal" ? match.full_name : match.proxy_full_name})
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="checkin-note">Ghi chú</Label>
                  <Textarea
                    id="checkin-note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: đã đối chiếu CCCD bản gốc"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {issuedNo != null ? (
            <>
              <Button variant="outline" className="gap-1.5" onClick={printCard}>
                <Printer className="h-4 w-4" />
                In thẻ số báo danh
              </Button>
              <Button onClick={() => onOpenChange(false)}>Xong</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={checkIn.isPending}>
                Đóng
              </Button>
              <Button onClick={submit} disabled={!!blocked || checkIn.isPending} className="gap-1.5">
                {checkIn.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Xác nhận điểm danh
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonBlock(props: {
  title: string;
  fullName: string;
  idType: IdType;
  idNumber: string;
  dob: string | null;
  frontPath: string | null;
  backPath: string | null;
  edited: KycField[];
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Họ tên</dt>
          <dd className="font-medium text-foreground">{props.fullName}</dd>
          <dt className="text-muted-foreground">{ID_TYPE_LABELS[props.idType]}</dt>
          <dd className="font-mono text-foreground">{props.idNumber}</dd>
          <dt className="text-muted-foreground">Ngày sinh</dt>
          <dd className="text-foreground">{formatDob(props.dob)}</dd>
        </dl>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
          <KycImageThumb path={props.frontPath} label="Mặt trước" />
          {props.idType === "cccd" && <KycImageThumb path={props.backPath} label="Mặt sau" />}
        </div>
      </div>
      {props.edited.length > 0 && (
        <p className="text-xs text-warning">
          Người mua đã sửa tay so với dữ liệu đọc từ giấy tờ:{" "}
          {props.edited.map((f) => KYC_FIELD_LABELS[f]).join(", ")} — đối chiếu kỹ với bản gốc.
        </p>
      )}
    </section>
  );
}
