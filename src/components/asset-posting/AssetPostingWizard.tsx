import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, Loader2, Plus, Save } from "lucide-react";
import { Step1AssetType } from "./steps/Step1AssetType";
import { Step2GeneralInfo } from "./steps/Step2GeneralInfo";
import { Step3LegalStatus } from "./steps/Step3LegalStatus";
import { Step4AuctionNeeds } from "./steps/Step4AuctionNeeds";
import { StepReview } from "./steps/StepReview";
import { useCreatePosting, useMatchedOrgs, useSendServiceRequest } from "@/hooks/useAssetPosting";
import {
  wizardSchema,
  wizardDefaults,
  requirements,
  REQUIREMENT_MSG,
  buildMatchCriteria,
  buildPostingPayload,
  type WizardValues,
} from "./wizardSchema";

const STEPS = [
  { n: 1, label: "Loại tài sản", title: "Tài sản thuộc loại nào?" },
  { n: 2, label: "Thông tin", title: "Thông tin tài sản" },
  { n: 3, label: "Pháp lý", title: "Pháp lý & giấy tờ" },
  { n: 4, label: "Đấu giá", title: "Nhu cầu đấu giá" },
  { n: 5, label: "Xem lại", title: "Xem lại & hoàn tất" },
];

interface AssetPostingWizardProps {
  /** Quay về danh sách hồ sơ (sau khi hoàn tất). */
  onDone?: () => void;
  /** Thoát giữa chừng, quay về danh sách. */
  onCancel?: () => void;
}

/** Wizard số hoá tài sản — full-page, requirements-driven (port thiết kế "So Hoa Tai San"). */
export function AssetPostingWizard({ onDone, onCancel }: AssetPostingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [phase, setPhase] = useState<"wizard" | "done">("wizard");
  const [sentOrgName, setSentOrgName] = useState<string | null>(null);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onTouched",
    defaultValues: wizardDefaults,
  });
  const f = form.watch();
  const up = (patch: Partial<WizardValues>) =>
    Object.entries(patch).forEach(([k, v]) => form.setValue(k as keyof WizardValues, v as never, { shouldValidate: false }));

  const create = useCreatePosting();
  const send = useSendServiceRequest();
  const { results: orgResults, isLoading: orgLoading } = useMatchedOrgs(buildMatchCriteria(f));

  const reqs = useMemo(() => requirements(f), [f]);
  const missing = reqs.filter((r) => !r.ok);
  const stepMissing = missing.filter((m) => m.step === step);
  const errs: Record<string, string> = {};
  if (shown[step]) stepMissing.forEach((m) => (errs[m.key] = REQUIREMENT_MSG[m.key] || "Bắt buộc"));

  const chosenOrgName = orgResults.find((r) => r.org.id === f.chosenOrg)?.org.name ?? null;
  const chosenScore = orgResults.find((r) => r.org.id === f.chosenOrg)?.score ?? null;

  const exit = () => (onCancel ? onCancel() : navigate("/chu-tai-san/tai-san"));
  const finishNav = () => (onDone ? onDone() : navigate("/chu-tai-san/tai-san"));

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    if (stepMissing.length) {
      setShown((s) => ({ ...s, [step]: true }));
      return;
    }
    go(Math.min(5, step + 1));
  };

  // Lưu nháp rồi thoát — cần tối thiểu loại + tên tài sản (cột NOT NULL ở DB).
  const saveDraft = () => {
    if (!f.parentSlug || !f.childSlug || f.title.trim().length < 3) {
      toast.error("Nhập tối thiểu loại tài sản và tên tài sản để lưu nháp.");
      return;
    }
    create.mutate({ posting: buildPostingPayload(f), status: "draft" }, { onSuccess: () => exit() });
  };

  // Hoàn tất số hoá (status active) → nếu chọn tổ chức thì gửi yêu cầu dịch vụ (luồng riêng).
  const finish = () => {
    if (missing.length) {
      setShown({ 1: true, 2: true, 3: true, 4: true });
      return;
    }
    create.mutate(
      { posting: buildPostingPayload(f), status: "active" },
      {
        onSuccess: ({ postingId }) => {
          if (f.wantsAuction === "yes" && f.chosenOrg && chosenScore != null) {
            send.mutate(
              { postingId, orgId: f.chosenOrg, matchScore: chosenScore },
              {
                onSuccess: () => {
                  setSentOrgName(chosenOrgName);
                  setPhase("done");
                  window.scrollTo({ top: 0 });
                },
              },
            );
          } else {
            setSentOrgName(null);
            setPhase("done");
            window.scrollTo({ top: 0 });
          }
        },
      },
    );
  };

  const resetWizard = () => {
    form.reset(wizardDefaults);
    setShown({});
    setStep(1);
    setSentOrgName(null);
    setPhase("wizard");
  };

  const busy = create.isPending || send.isPending;

  // ─── Màn hoàn tất ─────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-muted/30 overflow-y-auto">
        <TopBar onExit={finishNav} onSaveDraft={saveDraft} savingDraft={false} />
        <div className="mx-auto my-8 w-full max-w-xl px-4">
          <div className="bg-card border border-border rounded-2xl px-8 py-11 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 text-success grid place-items-center mx-auto mb-4">
              <Check className="h-8 w-8" strokeWidth={2.4} />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {sentOrgName ? "Đã số hoá & gửi yêu cầu" : "Đã số hoá tài sản"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              {sentOrgName ? (
                <>
                  Hồ sơ <b className="text-foreground">{f.title}</b> đã gửi tới <b className="text-foreground">{sentOrgName}</b>.
                </>
              ) : (
                <>
                  Hồ sơ <b className="text-foreground">{f.title}</b> đã lưu vào “Tài sản của tôi”. Bạn có thể gửi cho tổ chức đấu
                  giá bất cứ lúc nào từ trang chi tiết hồ sơ.
                </>
              )}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={finishNav}
                className="inline-flex items-center gap-2 rounded-[10px] bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:bg-primary/90 transition"
              >
                <Eye className="h-4 w-4" /> Xem hồ sơ
              </button>
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex items-center gap-2 rounded-[10px] border border-input bg-background px-5 py-3 text-sm font-semibold text-foreground hover:border-muted-foreground transition"
              >
                <Plus className="h-4 w-4" /> Số hoá tài sản khác
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const s = STEPS[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted/30">
      <TopBar onExit={exit} onSaveDraft={saveDraft} savingDraft={create.isPending} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-40">
          <Rail step={step} go={go} reqs={reqs} />

          <div className="pt-1 pb-4">
            <h1 className="text-[23px] font-bold tracking-tight text-foreground">{s.title}</h1>
          </div>

          {step === 1 && <Step1AssetType f={f} up={up} errs={errs} />}
          {step === 2 && <Step2GeneralInfo f={f} up={up} errs={errs} />}
          {step === 3 && <Step3LegalStatus f={f} up={up} errs={errs} />}
          {step === 4 && <Step4AuctionNeeds f={f} up={up} errs={errs} orgResults={orgResults} orgLoading={orgLoading} />}
          {step === 5 && <StepReview f={f} jump={go} missing={missing} chosenOrgName={chosenOrgName} />}
        </div>
      </div>

      {/* Footer bar */}
      <div className="fixed left-0 right-0 bottom-0 z-[46] border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
            >
              <ChevronLeft className="h-4 w-4" /> Quay lại
            </button>
          ) : (
            <button
              type="button"
              onClick={exit}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" /> Thoát
            </button>
          )}
          <div className="flex-1" />
          {step < 5 && shown[step] && stepMissing.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-warning max-w-[46ch]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Còn thiếu: {stepMissing.map((m) => m.label).join(", ")}
            </div>
          )}
          {step === 5 && missing.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-warning">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Còn {missing.length} mục bắt buộc
            </div>
          )}
          {step < 5 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition"
            >
              Tiếp tục <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={!!missing.length || busy}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 transition disabled:bg-muted-foreground/40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Hoàn tất số hoá
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────
function TopBar({ onExit, onSaveDraft, savingDraft }: { onExit: () => void; onSaveDraft: () => void; savingDraft: boolean }) {
  return (
    <header className="shrink-0 sticky top-0 z-40 bg-card border-b border-border flex items-center gap-4 px-4 sm:px-6 h-[60px]">
      <button
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-2 text-[13.5px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-2 py-1.5 transition"
      >
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Tài sản của tôi</span>
      </button>
      <div className="pl-3.5 border-l border-border">
        <div className="text-[15px] font-semibold text-foreground">Số hoá tài sản</div>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSaveDraft}
        disabled={savingDraft}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-2.5 py-1.5 transition disabled:opacity-60"
      >
        {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu nháp
      </button>
    </header>
  );
}

// ─── Rail tiến độ (stepper ngang) ─────────────────────────────────────────────
function Rail({ step, go, reqs }: { step: number; go: (n: number) => void; reqs: ReturnType<typeof requirements> }) {
  return (
    <div className="flex items-center gap-1.5 pb-1">
      {STEPS.map((s, i) => {
        const rs = reqs.filter((r) => r.step === s.n);
        const done = rs.length > 0 && rs.every((r) => r.ok);
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-1.5 flex-1 last:flex-none">
            <button type="button" onClick={() => go(s.n)} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 shrink-0">
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 border-[1.5px] ${
                  active
                    ? "bg-primary border-primary text-primary-foreground"
                    : done
                    ? "bg-success border-success text-white"
                    : "bg-card border-input text-muted-foreground"
                }`}
              >
                {done && !active ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span className={`text-[13.5px] hidden md:block ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <span className={`flex-1 h-px min-w-3 ${done ? "bg-success" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}
