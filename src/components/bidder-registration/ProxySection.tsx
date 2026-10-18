import { Button } from "@/components/ui/button";
import { Note } from "@/components/auction-sessions/detail/ui";
import { IdentityCapture, type IdentityCaptureErrors } from "@/components/ekyc/IdentityCapture";
import { KycDocumentSlot } from "@/components/bidding-contracts/KycDocumentSlot";
import { OptionTile } from "@/components/buyer-contracts/ui";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { applySavedIdentity } from "@/lib/biddingContracts/registrationForm";
import { checkinChannelOf, checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { VerifiedIdentity } from "@/types/bidding-contract";
import { RegField } from "./RegField";
import { StepCard } from "./StepCard";
import type { StepProps } from "./types";

interface Props extends StepProps {
  session: PublicSessionDetail;
  saved: VerifiedIdentity | null;
  /** Người đăng ký đang dùng danh tính đã lưu ⇒ không thể đồng thời là người được uỷ quyền. */
  principalIsSaved: boolean;
}

/**
 * Bước 3 — ai dự phiên: chính người đăng ký / người đại diện theo pháp luật, hoặc
 * người được uỷ quyền (B2) ⇒ KYC thêm người đó + giấy uỷ quyền.
 */
export function ProxySection(props: Props) {
  const { values, patch, errors, busy, submitting, onUploaded, busyHandlers, saved, session } = props;
  const org = values.buyer_kind === "organization";
  const x = values.proxy;
  const set = (p: Partial<typeof x>) => patch({ proxy: { ...x, ...p } });
  const proxy = values.attendee === "proxy";
  const w = checkinWindowOf(session);
  const online = checkinChannelOf(session.auction_format) === "online";

  // Nhân viên được tổ chức uỷ quyền thường là chính chủ tài khoản ⇒ dùng ảnh đã lưu.
  const canUseSavedForProxy = saved?.source === "id_photo" && !props.principalIsSaved;

  return (
    <StepCard title="Ai sẽ dự phiên?" sub="Người dự phiên điểm danh và trả giá trong phòng đấu giá.">
      <div role="radiogroup" aria-label="Người dự phiên" className="grid gap-3 sm:grid-cols-2">
        <OptionTile
          selected={!proxy}
          title={org ? "Người đại diện theo pháp luật" : "Tôi tự dự phiên"}
          hint={online ? "Điểm danh bằng tài khoản này" : "Mang giấy tờ gốc đã kê khai khi điểm danh"}
          disabled={busy}
          onSelect={() => patch({ attendee: "self" })}
        />
        <OptionTile
          selected={proxy}
          title="Uỷ quyền người khác"
          hint="Cần giấy uỷ quyền công chứng hoặc chứng thực"
          disabled={busy}
          onSelect={() => patch({ attendee: "proxy" })}
        />
      </div>

      {proxy ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Người được uỷ quyền</p>
            {canUseSavedForProxy && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={submitting}
                onClick={() => set({ ...applySavedIdentity(saved!), phone: x.phone || values.phone })}
              >
                Tôi là người được uỷ quyền
              </Button>
            )}
          </div>
          <IdentityCapture
            value={x}
            onChange={(next) => set(next)}
            errors={errors.proxy as IdentityCaptureErrors}
            disabled={submitting}
            onUploaded={onUploaded}
            onBusyChange={busyHandlers.proxy}
          />
          <RegField id="reg-proxy-phone" label="Số điện thoại" inputMode="tel" placeholder="0912345678"
            value={x.phone} error={errors.proxy.phone} disabled={busy} onChange={(v) => set({ phone: v })} />
          <KycDocumentSlot
            label="Giấy uỷ quyền (bản công chứng / chứng thực)"
            required
            path={x.poa_doc_path}
            error={errors.proxy.poa_doc_path}
            disabled={busy}
            onChange={(p) => set({ poa_doc_path: p })}
            onUploaded={onUploaded}
            onBusyChange={busyHandlers.poa}
          />
          <Note tone="amber">
            Người được uỷ quyền phải khác {org ? "người đại diện theo pháp luật" : "người đăng ký"} và tự điểm danh bằng giấy
            tờ của mình.
          </Note>
        </>
      ) : (
        <Note>
          Điểm danh {online ? "trực tuyến" : "tại địa điểm"} mở {formatDateTime(w.opensAt.toISOString())} →{" "}
          {formatDateTime(w.closesAt.toISOString())}. Quá giờ đóng điểm danh sẽ bị ghi vắng và mất tiền đặt trước.
        </Note>
      )}
    </StepCard>
  );
}
