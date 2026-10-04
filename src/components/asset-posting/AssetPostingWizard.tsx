import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Step1AssetType } from "./steps/Step1AssetType";
import { Step3LegalStatus } from "./steps/Step3LegalStatus";
import { Step4AuctionNeeds } from "./steps/Step4AuctionNeeds";
import { StepReview } from "./steps/StepReview";
import { StepInfo } from "./info/StepInfo";
import { infoSections, jumpToSection, sectionOfKey } from "./info/infoSections";
import { WizardTopBar } from "./wizard/WizardTopBar";
import { WizardNav } from "./wizard/WizardNav";
import { WIZARD_STEPS } from "./wizard/wizardSteps";
import { WizardFooter } from "./wizard/WizardFooter";
import { WizardDoneScreen } from "./wizard/WizardDoneScreen";
import { canSaveDraft, useDraftAutosave } from "./wizard/useDraftAutosave";
import { useWizardDossier } from "./wizard/useWizardDossier";
import { PartnerScopeProvider } from "./partners/PartnerScope";
import { useWizardAuthentication } from "./useWizardAuthentication";
import { ownerConsignmentPath } from "@/lib/consignment/ownerConsignment";
import { AuthenticationOutcomeNotice } from "@/components/authentication/AuthenticationOutcomeNotice";
import { useAiMediaExtraction } from "@/hooks/useAiMediaExtraction";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  useCreateBrokerRequest,
  useCreatePosting,
  useMatchedOrgs,
  usePostingDetail,
  useSendServiceRequests,
} from "@/hooks/useAssetPosting";
import {
  wizardSchema,
  wizardDefaults,
  requirements,
  REQUIREMENT_MSG,
  buildMatchCriteria,
  buildPostingPayload,
  postingToWizardValues,
  type WizardValues,
} from "./wizardSchema";

interface AssetPostingWizardProps {
  /** Mở lại một bản nháp đã lưu. Bỏ trống = tạo hồ sơ mới. */
  postingId?: string | null;
  /** Quay về danh sách hồ sơ (sau khi hoàn tất). */
  onDone?: () => void;
  /** Thoát giữa chừng, quay về danh sách. */
  onCancel?: () => void;
}

/**
 * Wizard số hoá tài sản — full-page, requirements-driven (port thiết kế "So Hoa Tai San v3":
 * rail dọc + mục con của bước Thông tin, tự lưu nháp, footer cùng lưới với nội dung).
 * Lớp phủ `fixed inset-0` phải ĐỤC (bg-muted) để che hẳn sidebar + topbar của Cổng chủ
 * tài sản — luồng số hoá là màn tập trung, không menu.
 */
export function AssetPostingWizard({ postingId = null, onDone, onCancel }: AssetPostingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [phase, setPhase] = useState<"wizard" | "done">("wizard");
  // Kết quả hoàn tất: tổ chức đã nhận yêu cầu báo giá / đã nhờ sàn / id hồ sơ.
  const [sentOrgNames, setSentOrgNames] = useState<string[]>([]);
  const [sentToPlatform, setSentToPlatform] = useState(false);
  const [finishedId, setFinishedId] = useState<string | null>(null);
  const [savingExit, setSavingExit] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const form = useForm<WizardValues>({ resolver: zodResolver(wizardSchema), mode: "onTouched", defaultValues: wizardDefaults });
  const f = form.watch();

  // Nạp bản nháp một lần khi mở lại (không có bước này thì "Lưu nháp" là bẫy) — chờ cả
  // các phần "Hồ sơ dịch vụ" (bảng riêng asset_posting_dossier_items).
  const { data: draft } = usePostingDetail(postingId);
  const dossier = useWizardDossier(postingId);
  const { rows: dossierRows, ready: dossierReady, markSynced, save: saveDossier } = dossier;
  const hydrated = useRef(false);
  useEffect(() => {
    if (!draft?.posting || !dossierReady || hydrated.current) return;
    hydrated.current = true;
    const values = postingToWizardValues(draft.posting, dossierRows);
    form.reset(values);
    markSynced(draft.posting.id, values.dossier);
  }, [draft, dossierReady, dossierRows, markSynced, form]);

  // Id hồ sơ đã có trong DB: nháp mở lại, HOẶC bản vừa lưu (tự lưu / "Thêm 3D"…). Mọi
  // lần lưu sau phải UPDATE dòng này. State thuần để "Số hoá tài sản khác" xoá được.
  const [savedId, setSavedId] = useState<string | null>(postingId);
  const autosave = useDraftAutosave(
    form,
    savedId,
    useCallback((id: string) => setSavedId(id), []),
    useCallback((id: string, v: WizardValues) => saveDossier(id, v.dossier), [saveDossier]),
  );

  const up = (patch: Partial<WizardValues>) => {
    Object.entries(patch).forEach(([k, v]) => form.setValue(k as keyof WizardValues, v as never, { shouldValidate: false }));
    autosave.schedule();
  };

  // Giữ ở cấp wizard: StepInfo unmount mỗi lần đổi bước, để trong đó là mất kết quả AI.
  const ai = useAiMediaExtraction();

  const create = useCreatePosting();
  const send = useSendServiceRequests();
  const broker = useCreateBrokerRequest();
  const { results: orgResults, isLoading: orgLoading } = useMatchedOrgs(buildMatchCriteria(f));

  const gd = useWizardAuthentication(f, savedId);
  const { required: gdRequired, authentic: gdAuthentic } = gd.ctx;
  // Người bị giới hạn chi nhánh phải gắn hồ sơ vào chi nhánh trong phạm vi.
  const { workspaceId, isScoped, isPersonal, can } = useOwnerWorkspace();
  const branchRequired = !!workspaceId && isScoped;
  // Gửi hồ sơ cho tổ chức / nhờ sàn là quyền Ký gửi (ky-gui:create), tách khỏi quyền Số hoá.
  const canConsign = isPersonal || can("ky-gui", "create");
  const reqs = useMemo(
    () => requirements(f, { required: gdRequired, authentic: gdAuthentic }, { branchRequired }),
    [f, gdRequired, gdAuthentic, branchRequired],
  );
  const sections = useMemo(() => infoSections(f, reqs), [f, reqs]);
  const missing = reqs.filter((r) => !r.ok);
  // Chứng thư giám định không chặn "Tiếp tục" — chỉ chặn "Hoàn tất" (chờ đối tác vài ngày).
  const stepMissing = missing.filter((m) => m.step === step && m.key !== "authentication");
  const errs: Record<string, string> = {};
  if (shown[step]) stepMissing.forEach((m) => (errs[m.key] = REQUIREMENT_MSG[m.key] || "Bắt buộc"));

  // Chỉ giữ tổ chức CÓ TRONG kết quả gợi ý (id lạ thì không có điểm khớp, không hứa gửi).
  const chosenResults = orgResults.filter((r) => f.chosenOrgs.includes(r.org.id));
  const chosenOrgNames = chosenResults.map((r) => r.org.name);

  const exit = () => (onCancel ? onCancel() : navigate("/chu-tai-san/tai-san"));
  const finishNav = () => (onDone ? onDone() : navigate("/chu-tai-san/tai-san"));
  const toTop = () => scroller.current?.scrollTo({ top: 0, behavior: "smooth" });

  const go = (n: number) => {
    setStep(n);
    toTop();
  };
  const next = () => {
    if (stepMissing.length) {
      setShown((s) => ({ ...s, [step]: true }));
      const sec = step === 2 ? sectionOfKey(stepMissing[0].key) : undefined;
      if (sec) jumpToSection(sec);
      return;
    }
    go(Math.min(5, step + 1));
  };

  /** Lưu nháp thủ công (sau khi hàng đợi tự lưu đã yên). Trả id, null nếu lỗi. */
  const saveNow = async (v: WizardValues): Promise<string | null> => {
    const id = await autosave.settle();
    try {
      const { postingId: saved } = await create.mutateAsync({
        posting: buildPostingPayload(v),
        status: "draft",
        postingId: id ?? undefined,
      });
      setSavedId(saved);
      autosave.markSaved(saved);
      await saveDossier(saved, v.dossier);
      return saved;
    } catch {
      return null; // useCreatePosting đã toast lỗi
    }
  };

  // "Lưu & thoát" — chưa nhập gì thì thoát luôn; nhập dở thì cần tối thiểu loại + tên.
  const saveExit = async () => {
    const v = form.getValues();
    if (!savedId && !v.title && !v.parentSlug) return exit();
    if (!canSaveDraft(v)) {
      toast.error("Nhập tối thiểu loại tài sản và tên tài sản để lưu nháp.");
      return;
    }
    setSavingExit(true);
    const id = await saveNow(v);
    setSavingExit(false);
    if (id) exit();
  };

  // Lưu nháp NGẦM, không thoát — cho "Thêm 3D" / VR tour / thẩm định / tư vấn.
  const ensureDraft = async (): Promise<string | null> => {
    const v = form.getValues();
    if (!canSaveDraft(v)) {
      toast.error("Chọn loại tài sản và nhập tên tài sản (ít nhất 3 ký tự) trước khi thêm 3D / VR tour / giám định / tư vấn.");
      return null;
    }
    return saveNow(v);
  };

  // Hoàn tất (status active) → tuỳ lựa chọn: chỉ số hoá · gửi các tổ chức đã chọn · nhờ sàn.
  const finish = async () => {
    if (missing.length) {
      setShown({ 1: true, 2: true, 3: true, 4: true });
      return;
    }
    autosave.setEnabled(false);
    const id = await autosave.settle();

    const done = (pid: string, orgNames: string[], viaPlatform: boolean) => {
      setFinishedId(pid);
      setSentOrgNames(orgNames);
      setSentToPlatform(viaPlatform);
      setPhase("done");
      scroller.current?.scrollTo({ top: 0 });
    };

    create.mutate(
      { posting: buildPostingPayload(f), status: "active", postingId: id ?? undefined },
      {
        onError: () => autosave.setEnabled(true),
        onSuccess: async ({ postingId: pid }) => {
          await dossier.saveOnFinish(pid, f.dossier);
          const wants = canConsign && f.wantsAuction === "yes";
          if (wants && f.orgMode === "self" && chosenResults.length > 0) {
            send.mutate(
              {
                postingId: pid,
                orgs: chosenResults.map((r) => ({ orgId: r.org.id, matchScore: r.score })),
                message: f.orgMessage?.trim() || undefined,
              },
              { onSuccess: () => done(pid, chosenOrgNames, false) },
            );
            return;
          }
          if (wants && f.orgMode === "platform") {
            broker.mutate({ postingId: pid, note: f.brokerNote }, { onSuccess: () => done(pid, [], true) });
            return;
          }
          done(pid, [], false);
        },
      },
    );
  };

  const resetWizard = () => {
    form.reset(wizardDefaults);
    ai.reset();
    autosave.reset();
    dossier.reset();
    autosave.setEnabled(true);
    setSavedId(null);
    setShown({});
    setStep(1);
    setSentOrgNames([]);
    setSentToPlatform(false);
    setFinishedId(null);
    setPhase("wizard");
  };

  const busy = create.isPending || send.isPending || broker.isPending;

  // Nhãn nút hoàn tất phải nói đúng việc finish() làm — điều kiện PHẢI trùng nhánh ở trên.
  const willSendCount = canConsign && f.wantsAuction === "yes" && f.orgMode === "self" ? chosenResults.length : 0;
  const finishLabel =
    canConsign && f.wantsAuction === "yes" && f.orgMode === "platform"
      ? "Hoàn tất & nhờ sàn chọn giúp"
      : willSendCount > 0
        ? `Hoàn tất & gửi ${willSendCount} tổ chức`
        : "Hoàn tất số hoá";

  const s = WIZARD_STEPS[step - 1];

  return (
    // Danh bạ đối tác riêng theo phạm vi của hồ sơ (Trạm / cá nhân) — nháp cũ theo bản lưu.
    <PartnerScopeProvider workspaceId={draft?.posting ? draft.posting.workspace_id : workspaceId}>
      <div className="fixed inset-0 z-50 flex flex-col bg-muted">
        <WizardTopBar
          parentSlug={f.parentSlug}
          childSlug={f.childSlug}
          save={autosave.state}
          onExit={phase === "done" ? finishNav : exit}
          onSaveExit={phase === "wizard" ? saveExit : undefined}
          savingExit={savingExit}
        />

        <div ref={scroller} className="flex-1 overflow-y-auto">
          {phase === "done" ? (
            <WizardDoneScreen
              title={f.title}
              sentOrgNames={sentOrgNames}
              sentToPlatform={sentToPlatform}
              onTrack={finishedId ? () => navigate(ownerConsignmentPath(finishedId)) : undefined}
              onView={finishNav}
              onAnother={resetWizard}
            />
          ) : (
            <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-6 px-3.5 pb-[120px] pt-5 sm:px-6 sm:pt-8 md:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
              <WizardNav step={step} go={go} reqs={reqs} sections={sections} />
              <main className="flex min-w-0 flex-col gap-3">
                <h1 className="mb-1.5 text-[22px] font-bold tracking-tight text-foreground">{s.title}</h1>

                {/* Hồ sơ bị trả về nháp vì kết luận giám định tiêu cực: lý do phải hiện ngay đây (BR-GD-02). */}
                {savedId && <AuthenticationOutcomeNotice postingId={savedId} />}

                {step === 2 ? (
                  <StepInfo
                    f={f}
                    up={up}
                    reqs={reqs}
                    showErr={!!shown[2]}
                    ai={ai}
                    postingId={savedId}
                    ensurePostingId={ensureDraft}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {step === 1 && <Step1AssetType f={f} up={up} errs={errs} />}
                    {step === 3 && <Step3LegalStatus f={f} up={up} errs={errs} postingId={savedId} ensurePostingId={ensureDraft} />}
                    {step === 4 && (
                      <Step4AuctionNeeds
                        f={f}
                        up={up}
                        errs={errs}
                        orgResults={orgResults}
                        orgLoading={orgLoading}
                        postingId={savedId}
                        ensurePostingId={ensureDraft}
                        gdReasons={gd.reasons}
                        gdLotReason={gd.lotReason}
                        canConsign={canConsign}
                      />
                    )}
                    {step === 5 && (
                      <StepReview f={f} jump={go} missing={missing} chosenOrgNames={chosenOrgNames} />
                    )}
                  </div>
                )}
              </main>
            </div>
          )}
        </div>

        {phase === "wizard" && (
          <WizardFooter
            step={step}
            onBack={() => go(step - 1)}
            onExit={exit}
            onNext={next}
            stepMissing={stepMissing}
            finishButton={
              <button
                type="button"
                onClick={() => void finish()}
                disabled={!!missing.length || busy}
                className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted-foreground/40"
              >
                {busy ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Check className="h-[15px] w-[15px]" />} {finishLabel}
              </button>
            }
          />
        )}
      </div>
    </PartnerScopeProvider>
  );
}
