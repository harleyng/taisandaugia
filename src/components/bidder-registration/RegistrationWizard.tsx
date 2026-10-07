import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useKycProfile, useSaveIdPhotoIdentity } from "@/hooks/useKycProfile";
import { useMyBiddingContracts, useStartBiddingContract } from "@/hooks/useBiddingContracts";
import { contractCheckoutPath } from "@/lib/biddingContracts/paths";
import {
  applySavedIdentity,
  emptyIdentity,
  makeRegistrationSchema,
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
  REGISTRATION_STEPS,
  withProfileSaveIssues,
  type RegistrationStepIndex,
} from "@/lib/biddingContracts/registrationSteps";
import { groupIssues, hasIssues } from "@/lib/biddingContracts/resubmitForm";
import { discardKycFiles } from "@/lib/ekyc/uploadKycImage";
import type { PublicSessionDetail } from "@/types/auction-session";
import type { VerifiedIdentity } from "@/types/bidding-contract";
import { BuyerKindStep } from "./BuyerKindStep";
import { IdentityStep } from "./IdentityStep";
import { ProxySection } from "./ProxySection";
import { RegistrationReview } from "./RegistrationReview";
import { RegistrationStepper } from "./RegistrationStepper";
import type { StepProps, UploadSlot } from "./types";

const ALL_STEPS: RegistrationStepIndex[] = [0, 1, 2, 3];

/**
 * Đăng ký tham gia đấu giá 4 bước: người đăng ký → danh tính → người dự phiên →
 * xác nhận ⇒ giữ chỗ 15 phút (start_bidding_contract) ⇒ VNPay. Một schema cho cả
 * form; mỗi bước chỉ báo lỗi của mình sau lần bấm "Tiếp tục" đầu tiên.
 */
export function RegistrationWizard({ session }: { session: PublicSessionDetail }) {
  const navigate = useNavigate();
  const { userId, session: authSession } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(userId);
  const { data: saved, isLoading: savedLoading } = useKycProfile();
  const { data: mine = [], isLoading: mineLoading } = useMyBiddingContracts();
  const start = useStartBiddingContract();
  const saveProfile = useSaveIdPhotoIdentity();

  const [values, setValues] = useState<RegistrationFormValues | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [step, setStep] = useState<RegistrationStepIndex>(0);
  const [attempted, setAttempted] = useState<Set<RegistrationStepIndex>>(new Set());
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
      }),
    );
    setUsingSaved(!!saved);
  }, [ready, values, profile, authSession, saved, mine]);

  useEffect(() => () => void discardKycFiles(uploads.current), []);

  const schema = useMemo(() => makeRegistrationSchema({ vneid: saved?.source === "vneid" ? saved : null }), [saved]);
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

  if (!values) {
    return (
      <Card className="space-y-4 rounded-2xl p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  const submitting = start.isPending || finishing;
  const busy = submitting || Object.values(busyBy).some(Boolean);
  const errors = attempted.has(step) ? issuesForStep(allIssues, step) : emptyIssues();
  const patch = (p: Partial<RegistrationFormValues>) => setValues((v) => (v ? { ...v, ...p } : v));

  const goTo = (s: RegistrationStepIndex) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    setAttempted((a) => new Set(a).add(step));
    if (!hasIssues(issuesForStep(allIssues, step))) goTo((step + 1) as RegistrationStepIndex);
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
          navigate(contractCheckoutPath(r.contract_id, session.id));
        },
      },
    );
  };

  const stepProps: StepProps = { values, patch, errors, submitting, busy, onUploaded, busyHandlers };
  const orgName = session.auction_organizations?.name ?? "tổ chức đấu giá";

  return (
    <Card className="space-y-6 rounded-2xl p-4 sm:p-6">
      <RegistrationStepper current={step} onSelect={goTo} disabled={busy} />

      <div className="space-y-1 border-t border-border pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Bước {step + 1}/{REGISTRATION_STEPS.length}
        </p>
        <h2 className="text-lg font-bold text-foreground">{REGISTRATION_STEPS[step].title}</h2>
      </div>

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
      {step === 2 && <ProxySection {...stepProps} saved={saved ?? null} principalIsSaved={usingSaved} />}
      {step === 3 && <RegistrationReview {...stepProps} orgName={orgName} fee={session.dossier_fee ?? 0} onEdit={goTo} />}

      {hasIssues(errors) && (
        <p className="text-sm font-medium text-destructive">Kiểm tra lại các trường được đánh dấu.</p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => (step === 0 ? navigate(`/sessions/${session.id}`) : goTo((step - 1) as RegistrationStepIndex))}
        >
          {step === 0 ? "Huỷ" : "Quay lại"}
        </Button>
        {step < LAST_STEP ? (
          <Button type="button" onClick={next} disabled={busy}>
            Tiếp tục
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={busy} className="gap-1.5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận & thanh toán
          </Button>
        )}
      </div>
    </Card>
  );
}
