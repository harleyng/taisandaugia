import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TwoColumn } from "@/components/buyer-contracts/BuyerPageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useKycProfile, useSaveIdPhotoIdentity } from "@/hooks/useKycProfile";
import {
  useCancelBiddingContract,
  useMyBiddingContracts,
  useStartBiddingContract,
} from "@/hooks/useBiddingContracts";
import { contractCheckoutPath } from "@/lib/biddingContracts/paths";
import { contractToRegistrationPayload } from "@/lib/biddingContracts/registrationPayload";
import {
  applySavedIdentity,
  emptyIdentity,
  makeRegistrationSchema,
  matchesVneid,
  registrationDefaults,
  toStartPayload,
  type RegistrationFormValues,
} from "@/lib/biddingContracts/registrationForm";
import {
  canOfferProfileSave,
  emptyIssues,
  firstStepWithIssues,
  issuesForStep,
  LAST_STEP,
  profileSaveInput,
  withProfileSaveIssues,
  type RegistrationStepIndex,
} from "@/lib/biddingContracts/registrationSteps";
import { groupIssues, hasIssues } from "@/lib/biddingContracts/resubmitForm";
import { discardKycFiles } from "@/lib/ekyc/uploadKycImage";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { BiddingContract, ContractSummary, VerifiedIdentity } from "@/types/bidding-contract";
import { BuyerKindStep } from "./BuyerKindStep";
import { IdentityStep } from "./IdentityStep";
import { PaymentStep, type HeldContract } from "./PaymentStep";
import { ProxySection } from "./ProxySection";
import { RegistrationReview } from "./RegistrationReview";
import { RegistrationSessionAside } from "./RegistrationSessionAside";
import { RegistrationStepper } from "./RegistrationStepper";
import type { StepProps, UploadSlot } from "./types";

const ALL_STEPS: RegistrationStepIndex[] = [0, 1, 2, 3];
const PAYMENT_STEP = 4;

interface Props {
  session: PublicSessionDetail;
  summary: ContractSummary | null;
  /** Hồ sơ đang chờ thanh toán của người xem (quay lại trang) ⇒ mở thẳng bước thanh toán. */
  pending: BiddingContract | null;
}

/**
 * Mua hồ sơ tham gia 5 chặng: người đăng ký → danh tính → người dự phiên →
 * xác nhận (chọn tài sản) ⇒ giữ suất 15 phút (start_bidding_contract) ⇒ thanh
 * toán VNPay. Một schema cho cả form; mỗi bước chỉ báo lỗi của mình sau lần bấm
 * "Tiếp tục" đầu tiên.
 */
export function RegistrationWizard({ session, summary, pending }: Props) {
  const navigate = useNavigate();
  const { userId, session: authSession } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const { data: saved, isLoading: savedLoading } = useKycProfile();
  const { data: mine = [], isLoading: mineLoading } = useMyBiddingContracts();
  const start = useStartBiddingContract();
  const cancel = useCancelBiddingContract();
  const saveProfile = useSaveIdPhotoIdentity();

  const lots = useMemo(() => [...session.auction_session_items].sort((a, b) => a.lot_no - b.lot_no), [session]);
  const [values, setValues] = useState<RegistrationFormValues | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [held, setHeld] = useState<HeldContract | null>(() =>
    pending
      ? { contractId: pending.id, code: pending.code, holdExpiresAt: pending.hold_expires_at, fee: pending.fee_amount }
      : null,
  );
  // Form đã điền trong lượt này (khác với mở lại hồ sơ đang chờ thanh toán).
  const [filled, setFilled] = useState(false);
  const [step, setStep] = useState<number>(pending ? PAYMENT_STEP : 0);
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [busyBy, setBusyBy] = useState<Partial<Record<UploadSlot, boolean>>>({});
  const [finishing, setFinishing] = useState(false);
  // Tệp tải trong lượt này — rời trang thì dọn, nộp xong thì dọn phần không dùng.
  const uploads = useRef<string[]>([]);

  // Điền sẵn MỘT lần, sau khi danh tính đã lưu + hồ sơ cũ + profile đã tải xong.
  const ready = !savedLoading && !mineLoading && !profileLoading;
  useEffect(() => {
    if (!ready || values) return;
    setValues(
      registrationDefaults({
        profileName: profile?.name,
        authEmail: authSession?.user?.email,
        authPhone: authSession?.user?.phone,
        saved: saved ?? null,
        last: mine[0] ?? null,
        lotIds: lots.map((l) => l.id),
      }),
    );
    setUsingSaved(!!saved);
  }, [ready, values, profile, authSession, saved, mine, lots]);

  useEffect(() => () => void discardKycFiles(uploads.current), []);

  const vneid = saved?.source === "vneid" ? saved : null;
  const schema = useMemo(() => makeRegistrationSchema({ vneid, lotCount: lots.length }), [vneid, lots.length]);
  const offerSave = !!values && !usingSaved && canOfferProfileSave(values, !!saved);

  const allIssues = useMemo(() => {
    if (!values) return emptyIssues();
    const r = schema.safeParse(values);
    const g = r.success ? emptyIssues() : groupIssues(r.error.issues);
    return offerSave && saveToProfile ? withProfileSaveIssues(g, values.principal) : g;
  }, [values, schema, offerSave, saveToProfile]);

  const onUploaded = useCallback((path: string) => uploads.current.push(path), []);
  const busyHandlers = useMemo(() => {
    const make = (key: UploadSlot) => (b: boolean) => setBusyBy((m) => (m[key] === b ? m : { ...m, [key]: b }));
    return { principal: make("principal"), proxy: make("proxy"), regDoc: make("regDoc"), poa: make("poa") };
  }, []);

  const aside = <RegistrationSessionAside session={session} summary={summary} />;

  if (!values) {
    return (
      <TwoColumn
        main={<Skeleton className="h-[420px] rounded-2xl" />}
        aside={<Skeleton className="h-72 rounded-2xl" />}
      />
    );
  }

  const submitting = start.isPending || finishing || cancel.isPending;
  const busy = submitting || Object.values(busyBy).some(Boolean);
  const formStep = Math.min(step, LAST_STEP) as RegistrationStepIndex;
  const errors = attempted.has(step) ? issuesForStep(allIssues, formStep) : emptyIssues();
  const patch = (p: Partial<RegistrationFormValues>) => setValues((v) => (v ? { ...v, ...p } : v));

  const goTo = (s: number) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    setAttempted((a) => new Set(a).add(step));
    if (!hasIssues(issuesForStep(allIssues, formStep))) goTo(step + 1);
  };

  const onUseSaved = (identity: VerifiedIdentity) => {
    patch({ principal: applySavedIdentity(identity) });
    setUsingSaved(true);
  };
  const onUseOther = () => {
    patch({ principal: { ...emptyIdentity(), full_name: profile?.name?.trim() ?? "" } });
    setUsingSaved(false);
  };

  const submit = () => {
    setAttempted(new Set(ALL_STEPS));
    const first = firstStepWithIssues(allIssues);
    if (first !== null) {
      goTo(first);
      return;
    }
    const payload = toStartPayload(values);
    const toSave = offerSave && saveToProfile ? profileSaveInput(values.principal) : null;
    start.mutate(
      { sessionId: session.id, payload },
      {
        onSuccess: async (r) => {
          setFinishing(true);
          // Lưu danh tính là phụ: lỗi đã có toast, không chặn thanh toán.
          if (toSave) await saveProfile.mutateAsync(toSave).catch((): null => null);
          const p = payload.principal;
          const x = payload.proxy;
          const kept = new Set([
            p.id_front_path, p.id_back_path, payload.organization?.reg_doc_path,
            x?.id_front_path, x?.id_back_path, x?.poa_doc_path,
          ]);
          void discardKycFiles(uploads.current.filter((u) => !kept.has(u)));
          uploads.current = [];
          setFinishing(false);
          setFilled(true);
          setHeld({ contractId: r.contract_id, code: r.code, holdExpiresAt: r.hold_expires_at, fee: r.fee_amount });
          goTo(PAYMENT_STEP);
        },
      },
    );
  };

  const pay = (expired: boolean) => {
    if (!held) return;
    if (!expired) {
      navigate(contractCheckoutPath(held.contractId, session.id));
      return;
    }
    // Hết giờ giữ suất ⇒ giữ suất mới bằng chính dữ liệu đã nộp rồi mới sang VNPay.
    const payload = filled || !pending ? toStartPayload(values) : contractToRegistrationPayload(pending);
    start.mutate(
      { sessionId: session.id, payload },
      { onSuccess: (r) => navigate(contractCheckoutPath(r.contract_id, session.id)) },
    );
  };

  const cancelHeld = () => {
    if (!held) return;
    cancel.mutate(held.contractId, { onSuccess: () => navigate(`/sessions/${session.id}`) });
  };

  const stepProps: StepProps = { values, patch, errors, submitting, busy, onUploaded, busyHandlers };
  const orgName = session.auction_organizations?.name ?? "tổ chức đấu giá";
  const blockConfirm = step === LAST_STEP && (!values.consent || (lots.length > 0 && values.lot_ids.length === 0));

  return (
    <>
      <RegistrationStepper current={step} onSelect={goTo} disabled={busy} />
      <TwoColumn
        main={
          <>
            {step === 0 && <BuyerKindStep {...stepProps} />}
            {step === 1 && (
              <IdentityStep
                {...stepProps}
                saved={saved ?? null}
                usingSaved={usingSaved}
                onUseSaved={onUseSaved}
                onUseOther={onUseOther}
                offerSave={offerSave}
                saveToProfile={saveToProfile}
                onSaveToProfileChange={setSaveToProfile}
              />
            )}
            {step === 2 && (
              <ProxySection {...stepProps} session={session} saved={saved ?? null} principalIsSaved={usingSaved} />
            )}
            {step === 3 && (
              <RegistrationReview
                {...stepProps}
                orgName={orgName}
                fee={session.dossier_fee ?? 0}
                lots={lots}
                vneid={matchesVneid(values.principal, vneid)}
                onEdit={goTo}
              />
            )}
            {step === PAYMENT_STEP && held && (
              <PaymentStep
                held={held}
                sessionCode={session.code}
                busy={submitting}
                onPay={pay}
                onEdit={() => goTo(filled ? LAST_STEP : 0)}
                onCancel={cancelHeld}
              />
            )}

            {step < PAYMENT_STEP && (
              <>
                {hasIssues(errors) && (
                  <p className="text-sm font-medium text-destructive">Kiểm tra lại các trường được đánh dấu.</p>
                )}
                <div className="flex justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    disabled={busy}
                    onClick={() => (step === 0 ? navigate(`/sessions/${session.id}`) : goTo(step - 1))}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {step === 0 ? "Về trang phiên" : "Quay lại"}
                  </Button>
                  {step < LAST_STEP ? (
                    <Button type="button" onClick={next} disabled={busy}>
                      Tiếp tục
                    </Button>
                  ) : (
                    <Button type="button" onClick={submit} disabled={busy || blockConfirm} className="gap-1.5">
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Tiếp tục thanh toán
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        }
        aside={aside}
      />
    </>
  );
}
