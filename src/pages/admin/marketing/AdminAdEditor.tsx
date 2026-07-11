import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AdSectionCard } from "@/components/admin/advertising/AdSectionCard";
import { AdReviewPanel } from "@/components/admin/advertising/AdReviewPanel";
import { AdBasicInfoSection } from "@/components/admin/advertising/sections/AdBasicInfoSection";
import { AdContentSection } from "@/components/admin/advertising/sections/AdContentSection";
import { AdScheduleSection } from "@/components/admin/advertising/sections/AdScheduleSection";
import {
  useAdvertisement,
  useUpsertAdvertisement,
  isUniquePositionError,
} from "@/hooks/useAdvertisements";
import { adSectionStatus, isEditable, type AdSection } from "@/lib/advertising/adStatus";
import { defaultAdForm, type AdFormState } from "@/lib/advertising/adForm";
import type { AdPosition, AdStatus, AdvertisementUpsert } from "@/types/advertising";

export default function AdminAdEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const fromId = searchParams.get("from");
  const isCopy = !isEdit && !!fromId;
  const sourceId = isEdit ? id : fromId ?? undefined;

  const { data: source, isLoading: loadingSource } = useAdvertisement(sourceId);
  const upsert = useUpsertAdvertisement();

  const [form, setForm] = useState<AdFormState>(defaultAdForm);
  const [position, setPosition] = useState<AdPosition | null>(null);
  const [hydrated, setHydrated] = useState(!isEdit && !isCopy);

  const patch = (p: Partial<AdFormState>) => setForm((f) => ({ ...f, ...p }));

  useEffect(() => {
    if (!source || hydrated) return;
    if (isEdit && !isEditable(source.status)) {
      toast.error("Banner đang hiển thị/đã kết thúc, không thể chỉnh sửa");
      navigate(`/admin/marketing/quang-cao/${source.id}`);
      return;
    }
    setForm({
      name: isCopy ? `${source.name} (Bản sao)` : source.name,
      customer_id: source.customer_id ?? "",
      position_id: source.position_id,
      show_desktop: source.show_desktop,
      show_mobile: source.show_mobile,
      desktop_image_url: source.desktop_image_url ?? "",
      mobile_image_url: source.mobile_image_url ?? "",
      nav_type: source.nav_type,
      nav_url: source.nav_url ?? "",
      start_type: source.start_type,
      start_at: source.start_at ?? "",
      end_type: source.end_type,
      end_at: source.end_at ?? "",
      sort_order: source.sort_order,
    });
    setHydrated(true);
  }, [source, hydrated, isEdit, isCopy, navigate]);

  const status = adSectionStatus({
    name: form.name,
    positionId: form.position_id,
    showDesktop: form.show_desktop,
    showMobile: form.show_mobile,
    desktopImageUrl: form.desktop_image_url || null,
    mobileImageUrl: form.mobile_image_url || null,
    startType: form.start_type,
    startAt: form.start_at,
    endType: form.end_type,
    endAt: form.end_at,
  });

  const refs: Record<AdSection, React.RefObject<HTMLDivElement>> = {
    basic: useRef<HTMLDivElement>(null),
    content: useRef<HTMLDivElement>(null),
    schedule: useRef<HTMLDivElement>(null),
  };
  const [flash, setFlash] = useState<AdSection | null>(null);
  const jump = (s: AdSection) => {
    refs[s].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(s);
    setTimeout(() => setFlash(null), 1200);
  };

  const buildPayload = (statusValue: AdStatus): AdvertisementUpsert => ({
    ...(isEdit && source ? { id: source.id } : {}),
    name: form.name.trim(),
    position_id: form.position_id,
    show_desktop: form.show_desktop,
    show_mobile: form.show_mobile,
    desktop_image_url: form.show_desktop ? form.desktop_image_url || null : null,
    mobile_image_url: form.show_mobile ? form.mobile_image_url || null : null,
    nav_type: form.nav_type,
    nav_url: form.nav_type === "link" ? form.nav_url || null : null,
    nav_filter: null,
    start_type: form.start_type,
    start_at: form.start_type === "scheduled" ? form.start_at || null : null,
    end_type: form.end_type,
    end_at: form.end_type === "scheduled" ? form.end_at || null : null,
    sort_order: form.sort_order,
    status: statusValue,
    customer_id: form.customer_id || null,
  });

  const busy = upsert.isPending;

  const saveWith = async (statusValue: AdStatus, okMsg: string) => {
    try {
      const saved = await upsert.mutateAsync(buildPayload(statusValue));
      toast.success(okMsg);
      navigate(`/admin/marketing/quang-cao/${saved.id}`);
    } catch (e) {
      if (isUniquePositionError(e)) toast.error((e as Error).message);
      else toast.error(`Lưu thất bại: ${e instanceof Error ? e.message : "Lỗi không xác định"}`);
    }
  };

  const handleSaveDraft = async () => {
    if (form.name.trim().length < 3) return toast.error("Vui lòng nhập tên banner (≥ 3 ký tự)");
    if (!form.position_id) return toast.error("Vui lòng chọn vị trí hiển thị");
    await saveWith("draft", "Đã lưu nháp");
  };

  const handlePublish = async () => {
    if (!status.basic.done) return toast.error("Vui lòng nhập tên banner");
    if (!status.content.done) return toast.error("Cần chọn vị trí, thiết bị và ảnh banner tương ứng");
    if (!status.schedule.done) return toast.error("Vui lòng hoàn thiện lịch đăng");
    const publishStatus: AdStatus = form.start_type === "scheduled" ? "scheduled" : "active";
    await saveWith(
      publishStatus,
      publishStatus === "scheduled" ? "Đã lên lịch banner" : "Đã đăng banner",
    );
  };

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
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing/quang-cao")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 text-xl font-semibold text-foreground">
          {isEdit ? "Chỉnh sửa Banner" : isCopy ? "Sao chép Banner" : "Tạo Banner"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <AdSectionCard ref={refs.basic} index={1} title="Thông tin cơ bản" done={status.basic.done} flash={flash === "basic"}>
            <AdBasicInfoSection form={form} patch={patch} />
          </AdSectionCard>

          <AdSectionCard ref={refs.content} index={2} title="Nội dung Banner" done={status.content.done} flash={flash === "content"}>
            <AdContentSection form={form} patch={patch} onPositionResolved={setPosition} />
          </AdSectionCard>

          <AdSectionCard ref={refs.schedule} index={3} title="Thông tin lịch đăng" done={status.schedule.done} flash={flash === "schedule"}>
            <AdScheduleSection form={form} patch={patch} />
          </AdSectionCard>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => navigate("/admin/marketing/quang-cao")}>
              Hủy
            </Button>
            <Button variant="outline" disabled={busy} onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-1.5" />
              Lưu vào bản nháp
            </Button>
            <Button disabled={busy} onClick={handlePublish}>
              {isEdit ? "Lưu banner" : "Tạo banner mới"}
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-4">
            <AdReviewPanel status={status} position={position} onJump={jump} />
          </div>
        </aside>
      </div>
    </div>
  );
}
