import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CampaignSectionCard } from "@/components/admin/marketing/CampaignSectionCard";
import { CampaignReviewPanel } from "@/components/admin/marketing/CampaignReviewPanel";
import { BasicInfoSection } from "@/components/admin/marketing/sections/BasicInfoSection";
import { AudienceSection } from "@/components/admin/marketing/sections/AudienceSection";
import { ContentSection } from "@/components/admin/marketing/sections/ContentSection";
import { ScheduleSection } from "@/components/admin/marketing/sections/ScheduleSection";
import {
  EmptyAudienceError,
  useCampaign,
  useSendCampaign,
  useUpsertCampaign,
  type CampaignUpsert,
} from "@/hooks/useCampaigns";
import { useAudiencePreview } from "@/hooks/useAudiencePreview";
import { campaignDefaults, campaignSchema, type CampaignFormValues } from "@/lib/marketing/campaignSchema";
import { campaignSectionStatus, isEditable, type CampaignSection } from "@/lib/marketing/campaignStatus";
import { DEFAULT_AUDIENCE_SPEC, normalizeSpec } from "@/lib/marketing/audienceCriteria";
import type { AudienceSpec, Campaign } from "@/types/marketing";

export default function AdminCampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  // Chế độ sao chép: /new?from=:id — nạp từ chiến dịch nguồn nhưng lưu ra bản mới.
  const fromId = searchParams.get("from");
  const isCopy = !isEdit && !!fromId;
  const sourceId = isEdit ? id : (fromId ?? undefined);

  const { data: source, isLoading: loadingSource } = useCampaign(sourceId);
  const upsert = useUpsertCampaign();
  const send = useSendCampaign();

  const [content, setContent] = useState("");
  const [spec, setSpec] = useState<AudienceSpec>(DEFAULT_AUDIENCE_SPEC);
  const [hydrated, setHydrated] = useState(!isEdit && !isCopy);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaignDefaults,
  });

  // Nạp dữ liệu khi sửa hoặc sao chép.
  useEffect(() => {
    if (!source || hydrated) return;
    // Chỉ chặn khi SỬA bản không sửa được; sao chép thì cho phép từ mọi trạng thái.
    if (isEdit && !isEditable(source.status)) {
      toast.error("Chiến dịch đã gửi/lên lịch, không thể chỉnh sửa");
      navigate(`/admin/marketing/email/${source.id}`);
      return;
    }
    form.reset({
      name: isCopy ? `${source.name} (Bản sao)` : source.name,
      notes: source.notes ?? "",
      subject: source.subject ?? "",
      preview_text: source.preview_text ?? "",
      schedule_type: source.schedule_type,
      scheduled_at: source.scheduled_at ?? "",
    });
    setContent(source.content_html ?? "");
    setSpec(normalizeSpec(source.audience_spec));
    setHydrated(true);
  }, [source, hydrated, isEdit, isCopy, form, navigate]);

  const preview = useAudiencePreview(spec);

  const status = campaignSectionStatus({
    name: form.watch("name") ?? "",
    subject: form.watch("subject") ?? "",
    contentHtml: content,
    scheduleType: form.watch("schedule_type"),
    scheduledAt: form.watch("scheduled_at") ?? "",
    spec,
  });

  // Section jump + flash.
  const refs: Record<CampaignSection, React.RefObject<HTMLDivElement>> = {
    basic: useRef<HTMLDivElement>(null),
    audience: useRef<HTMLDivElement>(null),
    content: useRef<HTMLDivElement>(null),
    schedule: useRef<HTMLDivElement>(null),
  };
  const [flash, setFlash] = useState<CampaignSection | null>(null);
  const jump = (s: CampaignSection) => {
    refs[s].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(s);
    setTimeout(() => setFlash(null), 1200);
  };

  const buildPayload = (statusValue: string): CampaignUpsert => {
    const v = form.getValues();
    return {
      ...(isEdit && source ? { id: source.id } : {}),
      name: v.name,
      notes: v.notes || null,
      subject: v.subject || null,
      preview_text: v.preview_text || null,
      content_html: content || null,
      audience_spec: spec,
      schedule_type: v.schedule_type,
      scheduled_at: v.schedule_type === "scheduled" ? v.scheduled_at || null : null,
      respect_optin: true,
      status: statusValue,
    };
  };

  const busy = upsert.isPending || send.isPending;

  const handleSaveDraft = async () => {
    if (!(await form.trigger())) {
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }
    try {
      const saved = await upsert.mutateAsync(buildPayload("draft"));
      toast.success("Đã lưu nháp");
      navigate(`/admin/marketing/email/${saved.id}`);
    } catch (e: unknown) {
      toast.error(`Lưu thất bại: ${e instanceof Error ? e.message : "Lỗi không xác định"}`);
    }
  };

  const handleSend = async () => {
    if (!(await form.trigger())) {
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }
    if (!status.audience.done) return toast.error("Chưa chọn đối tượng nhận");
    if (!status.content.done) return toast.error("Cần nhập tiêu đề và nội dung email");
    if (form.getValues("schedule_type") === "scheduled" && !form.getValues("scheduled_at")) {
      return toast.error("Vui lòng chọn thời gian gửi");
    }
    try {
      const saved = await upsert.mutateAsync(buildPayload("draft"));
      const res = await send.mutateAsync({ ...saved, audience_spec: spec } as Campaign);
      toast.success(
        res.scheduled
          ? `Đã lên lịch gửi tới ${res.count.toLocaleString("vi-VN")} người`
          : `Đã gửi tới ${res.count.toLocaleString("vi-VN")} người`,
      );
      navigate(`/admin/marketing/email/${saved.id}`);
    } catch (e: unknown) {
      if (e instanceof EmptyAudienceError) {
        toast.error("Không có người nhận đủ điều kiện (chưa ai cho phép gửi email)");
      } else {
        toast.error(`Gửi thất bại: ${e instanceof Error ? e.message : "Lỗi không xác định"}`);
      }
    }
  };

  const scheduled = form.watch("schedule_type") === "scheduled";

  if ((isEdit || isCopy) && loadingSource) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing/email")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 text-xl font-semibold text-foreground">
          {isEdit ? "Chỉnh sửa chiến dịch" : isCopy ? "Sao chép chiến dịch" : "Tạo chiến dịch email"}
        </h1>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <CampaignSectionCard ref={refs.basic} index={1} title="Thông tin cơ bản" done={status.basic.done} flash={flash === "basic"}>
            <BasicInfoSection form={form} />
          </CampaignSectionCard>

          <CampaignSectionCard
            ref={refs.audience}
            index={2}
            title="Đối tượng nhận"
            description="Chọn tất cả, theo tiêu chí, hoặc người dùng cụ thể"
            done={status.audience.done}
            flash={flash === "audience"}
          >
            <AudienceSection
              spec={spec}
              onChange={setSpec}
              count={preview.data}
              isFetching={preview.isFetching}
              isError={preview.isError}
            />
          </CampaignSectionCard>

          <CampaignSectionCard ref={refs.content} index={3} title="Nội dung email" done={status.content.done} flash={flash === "content"}>
            <ContentSection form={form} content={content} onContentChange={setContent} />
          </CampaignSectionCard>

          <CampaignSectionCard ref={refs.schedule} index={4} title="Lịch gửi" done={status.schedule.done} flash={flash === "schedule"}>
            <ScheduleSection form={form} />
          </CampaignSectionCard>

          {/* Hành động — đặt ở cuối form */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-1.5" />
              Lưu nháp
            </Button>
            <Button disabled={busy} onClick={handleSend}>
              {scheduled ? <Clock className="h-4 w-4 mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              {scheduled ? "Lên lịch gửi" : "Gửi ngay"}
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-4">
            <CampaignReviewPanel
              status={status}
              spec={spec}
              count={preview.data}
              isFetching={preview.isFetching}
              isError={preview.isError}
              onJump={jump}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
