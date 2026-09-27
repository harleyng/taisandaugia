import { useState } from "react";
import { Plus } from "lucide-react";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { getDeltaFields } from "@/constants/asset-delta-fields";
import { PostingModel3dCard } from "@/components/asset-3d/PostingModel3dCard";
import { PostingVrTourCard } from "@/components/vr-tour/PostingVrTourCard";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { mediaSignature } from "@/lib/aiMediaExtraction";
import type { UseAiMediaExtraction } from "@/hooks/useAiMediaExtraction";
import {
  applyExtractedFields,
  fieldCurrentValue,
  filled,
  REQUIREMENT_MSG,
  type Requirement,
  type WizardValues,
} from "../wizardSchema";
import { InfoAiBar } from "./InfoAiBar";
import { InfoMediaGrid } from "./InfoMediaGrid";
import { InfoDelta, InfoError, InfoField, InfoInput, InfoSection, InfoSelect, InfoSuggestion, InfoTextarea, SectionTag } from "./infoParts";

interface StepInfoProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  /** requirements() của cả wizard — bước này chỉ đọc các dòng step 2. */
  reqs: Requirement[];
  /** Đã bấm "Tiếp tục" mà còn thiếu ⇒ hiện lỗi dưới từng ô. */
  showErr: boolean;
  /** State trích xuất AI — giữ ở cấp wizard để không mất khi qua bước khác rồi quay lại. */
  ai: UseAiMediaExtraction;
  /** Id hồ sơ đã lưu (null = chưa lưu lần nào) — model 3D / VR tour gắn theo id này. */
  postingId: string | null;
  /** Lưu nháp ngầm để có id trước khi đặt 3D / VR tour. */
  ensurePostingId: () => Promise<string | null>;
}

const CHILD_NAME: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((c) => c.children.map((ch) => [ch.slug, ch.name])),
);

/**
 * Bước 2 "Thông tin tài sản" — 5 mục theo thiết kế So Hoa Tai San v3:
 * Ảnh & video (+ AI + 3D/VR) · Tên tài sản (+ chi nhánh) · Vị trí · Thông số · Mô tả.
 * Ảnh đứng ĐẦU có chủ ý: là thứ người dùng có sẵn, và là nguyên liệu để AI điền hộ các mục dưới.
 */
export function StepInfo({ f, up, reqs, showErr, ai, postingId, ensurePostingId }: StepInfoProps) {
  const [moreSpecs, setMoreSpecs] = useState(false);
  const deltas = getDeltaFields(f.childSlug);
  const reqD = deltas.filter((d) => d.required);
  const optD = deltas.filter((d) => !d.required);
  const prov = vietnamProvinces.find((p) => p.name === f.province);
  const dist = prov?.districts.find((d) => d.name === f.district);

  const reqOf = (k: string) => reqs.find((r) => r.step === 2 && r.key === k);
  const errOf = (k: string) => {
    const r = reqOf(k);
    return showErr && r && !r.ok ? REQUIREMENT_MSG[k] || "Bắt buộc" : null;
  };
  const sectionDone = (keys: string[]) => keys.every((k) => reqOf(k)?.ok ?? true);

  // ── AI: kết quả chỉ còn giá trị khi ảnh + loại tài sản vẫn là bộ đã phân tích.
  const signature = mediaSignature({ childSlug: f.childSlug, imageUrls: f.imageUrls, videoUrls: f.videoUrls });
  const st = ai.state;
  const fresh = st.phase === "done" && st.result.signature === signature;
  const aiFields = fresh ? st.result.fields : [];
  const pending = aiFields.filter((x) => !ai.resolved.has(x.path));
  const aiPhase =
    st.phase === "idle" ? "idle" : st.phase === "running" ? "run" : st.phase === "error" ? "error" : fresh ? "done" : "stale";

  // Nhận quận/phường khi tỉnh còn trống thì kéo theo gợi ý tỉnh (ô quận bị khoá khi chưa có tỉnh).
  const pathsFor = (path: string): string[] =>
    (path === "district" || path === "ward") && !f.province && aiFields.some((x) => x.path === "province")
      ? ["province", path]
      : [path];
  const takeSuggestion = (path: string) => {
    const paths = pathsFor(path);
    up(applyExtractedFields(f, aiFields, new Set(paths)));
    ai.apply(paths);
  };
  const applyAll = () => {
    const paths = pending.map((x) => x.path);
    up(applyExtractedFields(f, pending, new Set(paths)));
    ai.apply(paths);
  };
  const sug = (path: string, label?: (display: string) => string) => {
    const field = pending.find((x) => x.path === path);
    if (!field) return null;
    return (
      <InfoSuggestion
        field={field}
        label={label?.(field.display)}
        hasValue={fieldCurrentValue(f, path) !== ""}
        onUse={() => takeSuggestion(path)}
        onSkip={() => ai.resolve([path])}
      />
    );
  };
  const isAi = (path: string) => ai.applied.has(path);
  // Sửa tay một ô ⇒ giá trị không còn là của AI, bỏ nhãn "AI".
  const edit = (path: string, patch: Partial<WizardValues>) => {
    ai.touch(path);
    up(patch);
  };
  const setDelta = (k: string) => (v: string) => edit(`delta.${k}`, { deltaFields: { ...f.deltaFields, [k]: v } });

  const optOpen = moreSpecs || optD.some((d) => filled(f.deltaFields[d.key]) || pending.some((x) => x.path === `delta.${d.key}`));
  const mediaCount = [
    f.imageUrls.length ? `${f.imageUrls.length} ảnh` : "",
    f.videoUrls.length ? `${f.videoUrls.length} video` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <InfoSection id="anh" title="Ảnh & video" right={mediaCount && <SectionTag ok={f.imageUrls.length > 0}>{mediaCount}</SectionTag>}>
        <InfoMediaGrid
          images={f.imageUrls}
          videos={f.videoUrls}
          onImages={(v) => up({ imageUrls: v })}
          onVideos={(v) => up({ videoUrls: v })}
          bad={!!errOf("imageUrls")}
        />
        {errOf("imageUrls") && (
          <div className="mt-2">
            <InfoError>{errOf("imageUrls")}</InfoError>
          </div>
        )}
        {f.imageUrls.length > 0 && (
          <InfoAiBar
            phase={aiPhase}
            pending={pending.length}
            errorMessage={st.phase === "error" ? st.message : undefined}
            onRun={() =>
              ai.run({
                parentSlug: f.parentSlug,
                childSlug: f.childSlug,
                province: f.province,
                imageUrls: f.imageUrls,
                videoUrls: f.videoUrls,
              })
            }
            onApplyAll={applyAll}
          />
        )}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <PostingModel3dCard
            variant="panel"
            postingId={postingId}
            title={f.title || "Tài sản"}
            mode="owner"
            resolvePostingId={ensurePostingId}
          />
          <PostingVrTourCard
            variant="panel"
            postingId={postingId}
            title={f.title || "Tài sản"}
            mode="owner"
            resolvePostingId={ensurePostingId}
          />
        </div>
      </InfoSection>

      <InfoSection id="nhandien" title="Tên tài sản" right={sectionDone(["title", "branchId"]) && <SectionTag ok>Đã xong</SectionTag>}>
        <div className="grid gap-4">
          <InfoField label="Tên tài sản" req err={errOf("title")} ai={isAi("title")}>
            <InfoInput
              value={f.title}
              onChange={(v) => edit("title", { title: v })}
              placeholder="VD: Quyền sử dụng đất tại 12 Nguyễn Huệ, Quận 1"
            />
            {sug("title")}
          </InfoField>
          <BranchSelect value={f.branchId} onChange={(v) => up({ branchId: v })} err={errOf("branchId")} />
        </div>
      </InfoSection>

      <InfoSection id="vitri" title="Vị trí" right={sectionDone(["province"]) && <SectionTag ok>Đã xong</SectionTag>}>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <InfoField label="Tỉnh / Thành phố" req err={errOf("province")} ai={isAi("province")}>
              <InfoSelect
                value={f.province}
                onChange={(v) => edit("province", { province: v, district: "", ward: "" })}
                options={vietnamProvinces.map((p) => p.name)}
                placeholder="Chọn tỉnh / thành phố"
              />
              {sug("province")}
            </InfoField>
            <InfoField label="Quận / Huyện" ai={isAi("district")}>
              <InfoSelect
                value={f.district ?? ""}
                onChange={(v) => edit("district", { district: v, ward: "" })}
                options={prov?.districts.map((d) => d.name) ?? []}
                disabled={!prov}
                placeholder={prov ? "Chọn" : "Chọn tỉnh trước"}
              />
              {sug("district")}
            </InfoField>
            <InfoField label="Phường / Xã" ai={isAi("ward")}>
              <InfoSelect
                value={f.ward ?? ""}
                onChange={(v) => edit("ward", { ward: v })}
                options={dist?.wards ?? []}
                disabled={!dist}
                placeholder={dist ? "Chọn" : "Chọn quận trước"}
              />
              {sug("ward")}
            </InfoField>
          </div>
          <InfoField label="Địa chỉ cụ thể" ai={isAi("address")}>
            <InfoInput value={f.address ?? ""} onChange={(v) => edit("address", { address: v })} placeholder="Số nhà, tên đường…" />
            {sug("address")}
          </InfoField>
        </div>
      </InfoSection>

      {deltas.length > 0 && (
        <InfoSection id="thongso" title="Thông số" ds={CHILD_NAME[f.childSlug]}>
          <div className="grid gap-4">
            {reqD.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {reqD.map((d) => (
                  <InfoDelta
                    key={d.key}
                    d={d}
                    value={f.deltaFields[d.key]}
                    onChange={setDelta(d.key)}
                    err={errOf(`delta.${d.key}`)}
                    ai={isAi(`delta.${d.key}`)}
                    suggestion={sug(`delta.${d.key}`)}
                  />
                ))}
              </div>
            )}
            {optD.length > 0 &&
              (optOpen ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {optD.map((d) => (
                    <InfoDelta
                      key={d.key}
                      d={d}
                      value={f.deltaFields[d.key]}
                      onChange={setDelta(d.key)}
                      ai={isAi(`delta.${d.key}`)}
                      suggestion={sug(`delta.${d.key}`)}
                    />
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMoreSpecs(true)}
                  className="flex items-center gap-1.5 self-start py-1.5 text-[13.5px] font-semibold text-primary"
                >
                  <Plus className="h-[15px] w-[15px]" /> Thêm {optD.length} thông số
                </button>
              ))}
          </div>
        </InfoSection>
      )}

      <InfoSection id="mota" title="Mô tả">
        <InfoField label="Mô tả" ai={isAi("description")}>
          <InfoTextarea
            rows={5}
            value={f.description ?? ""}
            onChange={(v) => edit("description", { description: v })}
            placeholder="Vị trí, hiện trạng sử dụng, ưu điểm…"
          />
          {sug("description", (s) => (s.length > 70 ? `${s.slice(0, 70)}…` : s))}
        </InfoField>
      </InfoSection>
    </>
  );
}

/**
 * "Chi nhánh" của hồ sơ trong không gian đang chọn. Ẩn ở tenant Cá nhân và khi không
 * gian chưa có chi nhánh. Người bị giới hạn: bắt buộc, chỉ hiện chi nhánh trong phạm vi
 * — hồ sơ không chi nhánh thì RLS không cho họ ghi.
 */
function BranchSelect({ value, onChange, err }: { value: string; onChange: (v: string) => void; err?: string | null }) {
  const { workspaceId, isScoped: scoped, branchScope } = useOwnerWorkspace();
  const { data: branches = [] } = useWorkspaceBranchOptions(workspaceId);
  if (!workspaceId || (branches.length === 0 && !value)) return null;

  const options = branches
    .filter((b) => b.isActive || b.id === value)
    .filter((b) => !scoped || branchScope.includes(b.id))
    .map((b) => ({ value: b.id, label: b.label }));

  return (
    <InfoField
      label="Chi nhánh"
      req={scoped}
      err={err}
      help={scoped ? "Bạn chỉ số hoá được tài sản của chi nhánh được giao." : null}
    >
      <InfoSelect value={value} onChange={onChange} options={options} placeholder={scoped ? "Chọn chi nhánh" : "Toàn đơn vị"} />
    </InfoField>
  );
}
