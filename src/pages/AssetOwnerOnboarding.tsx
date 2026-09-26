import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

import { trackFeature } from "@/lib/analytics/track";
import { useAssetOwnerKYC } from "@/hooks/useAssetOwnerKYC";
import { useAssetOwnerOrgKYC } from "@/hooks/useAssetOwnerOrgKYC";
import { useOwnerWorkspaceMemberships } from "@/hooks/useOwnerWorkspace";

import { BranchSelector } from "@/components/asset-owner-onboarding/BranchSelector";
import { PreFillBanner } from "@/components/asset-owner-onboarding/PreFillBanner";
import { StatusScreen } from "@/components/asset-owner-onboarding/StatusScreen";
import { OrgApprovedCard } from "@/components/asset-owner-onboarding/OrgApprovedCard";

import { PersonalInfoSection } from "@/components/asset-owner-onboarding/individual/PersonalInfoSection";
import { EKYCSection } from "@/components/asset-owner-onboarding/individual/EKYCSection";
import { TermsSection } from "@/components/asset-owner-onboarding/individual/TermsSection";

import { OrgInfoSection } from "@/components/asset-owner-onboarding/organization/tier1/OrgInfoSection";
import { RepInfoSection } from "@/components/asset-owner-onboarding/organization/tier1/RepInfoSection";
import { RepEKYCSection } from "@/components/asset-owner-onboarding/organization/tier1/RepEKYCSection";
import { OrgDocsSection } from "@/components/asset-owner-onboarding/organization/tier1/OrgDocsSection";
import { AddressSection } from "@/components/asset-owner-onboarding/AddressSection";

import {
  EMPTY_ORG_KYC_FORM, validateOrgKycForm, type OrgKycForm,
} from "@/lib/assetOwnerKyc/orgKycValidation";
import { REGISTRY_OWNER_SELECT } from "@/types/asset-owner";
import type { AssetOwnerBranch, IdType, RegistryAssetOwner } from "@/types/asset-owner";
import type { Json } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  agent_info: Json | null;
}

const AssetOwnerOnboarding = () => {
  const navigate = useNavigate();
  const { openAuthDialog } = useAuthDialog();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branch, setBranch] = useState<AssetOwnerBranch | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [orgTermsAccepted, setOrgTermsAccepted] = useState(false);
  // Entity danh bạ đang chọn ở ô tên tổ chức — giữ ở page để thẻ đã chọn còn
  // nguyên khi quay lại bản nháp (orgKyc chỉ lưu id).
  const [registryOwner, setRegistryOwner] = useState<RegistryAssetOwner | null>(null);
  // Công ty mẹ đã khai của hồ sơ chi nhánh (Phase 13) — cùng lý do giữ ở page.
  const [parentOwner, setParentOwner] = useState<RegistryAssetOwner | null>(null);

  useEffect(() => {
    trackFeature("start_owner_kyc");
  }, []);

  // Individual KYC local form state
  const [indForm, setIndForm] = useState({
    full_name: "", phone: "", phone_verified: false,
    contact_email: "", id_type: "cccd" as IdType, id_number: "",
    // Địa chỉ — Bên A trong hợp đồng dịch vụ đấu giá.
    address: "", ward: "", province: "",
    id_front_url: null as string | null,
    id_back_url: null as string | null,
    selfie_url: null as string | null,
  });

  // Org KYC local form state (luật kiểm ở lib/assetOwnerKyc/orgKycValidation)
  const [orgForm, setOrgForm] = useState<OrgKycForm>(EMPTY_ORG_KYC_FORM);
  const isBranchKyc = orgForm.kyc_scope === "branch";

  const userId = profile?.id ?? null;
  const { kyc, isLoading: kycLoading, saveDraft, submit, uploadEKYCFile } = useAssetOwnerKYC(userId);
  const { orgKyc, isLoading: orgKycLoading, saveDraft: orgSaveDraft, submit: orgSubmit, uploadDoc } = useAssetOwnerOrgKYC(userId);
  // Chỉ để hiển thị số tài sản đã được khớp tự động sau khi duyệt — mọi thao tác
  // chỉnh alias / khớp lại nay nằm ở portal (/chu-tai-san/chi-nhanh-amc).
  // Lấy đúng không gian sinh ra từ HỒ SƠ NÀY, không phải không gian đang chọn
  // (người dùng có thể đồng thời là thành viên được mời của nơi khác).
  const { memberships, isLoading: wsLoading } = useOwnerWorkspaceMemberships();
  const workspace = memberships.find((m) => m.workspace.org_kyc_id === orgKyc?.id)?.workspace ?? null;

  // Load session + profile
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, name, agent_info")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) setProfile({ ...data, email: session.user.email ?? "" });
      setLoading(false);
    };
    load();
  }, []);

  // Restore branch from existing records
  useEffect(() => {
    if (!branch) {
      if (kyc) setBranch("individual");
      else if (orgKyc) setBranch("organization");
    }
  }, [kyc, orgKyc, branch]);

  // When KYC status goes back to draft (after resubmit click), re-sync form so it re-renders
  useEffect(() => {
    if (kyc?.status === "draft" && profile) {
      const basic = ((profile.agent_info as Record<string, unknown>)?.basic as Record<string, unknown>) ?? {};
      setIndForm((prev) => ({
        ...prev,
        full_name: kyc.full_name ?? profile.name ?? prev.full_name,
        phone: kyc.phone ?? (basic.phone as string | undefined) ?? prev.phone,
        phone_verified: kyc.phone_verified ?? prev.phone_verified,
        contact_email: kyc.contact_email ?? profile.email ?? prev.contact_email,
        id_type: kyc.id_type ?? prev.id_type,
        id_number: kyc.id_number ?? prev.id_number,
        address: kyc.address ?? prev.address,
        ward: kyc.ward ?? prev.ward,
        province: kyc.province ?? prev.province,
        id_front_url: kyc.id_front_url ?? null,
        id_back_url: kyc.id_back_url ?? null,
        selfie_url: kyc.selfie_url ?? null,
      }));
    }
  }, [kyc?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill individual form from Layer 2 + existing KYC record
  useEffect(() => {
    if (!profile) return;
    const basic = ((profile.agent_info as Record<string, unknown>)?.basic as Record<string, unknown>) ?? {};
    setIndForm((prev) => ({
      ...prev,
      full_name: kyc?.full_name ?? profile.name ?? prev.full_name,
      phone: kyc?.phone ?? (basic.phone as string | undefined) ?? prev.phone,
      phone_verified: kyc?.phone_verified ?? (basic.phone_verified as boolean | undefined) ?? prev.phone_verified,
      contact_email: kyc?.contact_email ?? profile.email ?? prev.contact_email,
      id_type: kyc?.id_type ?? prev.id_type,
      id_number: kyc?.id_number ?? prev.id_number,
      address: kyc?.address ?? prev.address,
      ward: kyc?.ward ?? prev.ward,
      province: kyc?.province ?? prev.province,
      id_front_url: kyc?.id_front_url ?? null,
      id_back_url: kyc?.id_back_url ?? null,
      selfie_url: kyc?.selfie_url ?? null,
    }));
  }, [profile, kyc]);

  // Pre-fill org form from existing record
  useEffect(() => {
    if (!orgKyc) return;
    setOrgForm((prev) => ({
      ...prev,
      kyc_scope: orgKyc.kyc_scope ?? prev.kyc_scope,
      parent_asset_owner_id: orgKyc.parent_asset_owner_id,
      org_type: orgKyc.org_type ?? prev.org_type,
      org_name: orgKyc.org_name ?? prev.org_name,
      tax_code: orgKyc.tax_code ?? prev.tax_code,
      official_email: orgKyc.official_email ?? prev.official_email,
      email_domain: orgKyc.email_domain ?? prev.email_domain,
      aliases: orgKyc.aliases?.length ? orgKyc.aliases : prev.aliases,
      linked_asset_owner_id: orgKyc.linked_asset_owner_id,
      linked_auction_org_id: orgKyc.linked_auction_org_id,
      registry_match_score: orgKyc.registry_match_score,
      rep_full_name: orgKyc.rep_full_name ?? prev.rep_full_name,
      rep_title: orgKyc.rep_title ?? prev.rep_title,
      head_office_address: orgKyc.head_office_address ?? prev.head_office_address,
      head_office_province: orgKyc.head_office_province ?? prev.head_office_province,
      rep_id_type: orgKyc.rep_id_type ?? prev.rep_id_type,
      rep_id_number: orgKyc.rep_id_number ?? prev.rep_id_number,
      rep_id_front_url: orgKyc.rep_id_front_url,
      rep_id_back_url: orgKyc.rep_id_back_url,
      rep_selfie_url: orgKyc.rep_selfie_url,
      establishment_doc_url: orgKyc.establishment_doc_url,
      authorization_doc_url: orgKyc.authorization_doc_url,
    }));
  }, [orgKyc]);

  // Bản nháp chỉ giữ id chủ tài sản — nạp lại bản ghi danh bạ để hiện thẻ đã chọn
  useEffect(() => {
    const ownerId = orgKyc?.linked_asset_owner_id;
    if (!ownerId || registryOwner?.id === ownerId) return;
    let cancelled = false;
    supabase
      .from("asset_owners")
      .select(REGISTRY_OWNER_SELECT)
      .eq("id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setRegistryOwner(data as unknown as RegistryAssetOwner);
      });
    return () => { cancelled = true; };
  }, [orgKyc?.linked_asset_owner_id, registryOwner?.id]);

  // Tương tự cho công ty mẹ của hồ sơ chi nhánh
  useEffect(() => {
    const parentId = orgKyc?.parent_asset_owner_id;
    if (!parentId || parentOwner?.id === parentId) return;
    let cancelled = false;
    supabase
      .from("asset_owners")
      .select(REGISTRY_OWNER_SELECT)
      .eq("id", parentId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setParentOwner(data as unknown as RegistryAssetOwner);
      });
    return () => { cancelled = true; };
  }, [orgKyc?.parent_asset_owner_id, parentOwner?.id]);

  // Compute pre-fill labels
  const preFillFields = (() => {
    const fields: string[] = [];
    const basic = ((profile?.agent_info as Record<string, unknown>)?.basic as Record<string, unknown>) ?? {};
    if (profile?.name) fields.push("Họ tên");
    if (basic.phone) fields.push("Số điện thoại");
    if (profile?.email) fields.push("Email");
    return fields;
  })();

  // ─── Individual helpers ────────────────────────────────────────────────────

  const handleIndUpload = async (slot: "id_front" | "id_back" | "selfie", file: File) => {
    const path = await uploadEKYCFile(file, slot);
    if (!path) {
      toast.error("Tải ảnh thất bại, vui lòng thử lại");
      return;
    }
    const urlKey = `${slot}_url` as keyof typeof indForm;
    const updated = { ...indForm, [urlKey]: path };
    setIndForm(updated);
    await saveDraft.mutateAsync({ ...updated });
  };

  const handleIndSubmit = async () => {
    if (indForm.full_name.trim().length < 3) {
      toast.error("Vui lòng nhập họ tên (ít nhất 3 ký tự)");
      return;
    }
    if (!indForm.id_type || indForm.id_number.trim().length < 6) {
      toast.error("Vui lòng nhập số CCCD / hộ chiếu hợp lệ");
      return;
    }
    if (!/^0[0-9]{9}$/.test(indForm.phone)) {
      toast.error("Số điện thoại chưa đúng định dạng (10 chữ số, bắt đầu 0)");
      return;
    }
    if (!indForm.phone_verified) {
      toast.error("Vui lòng xác thực số điện thoại qua OTP");
      return;
    }
    if (!indForm.contact_email.includes("@")) {
      toast.error("Email liên hệ chưa hợp lệ");
      return;
    }
    if (indForm.address.trim().length < 5) {
      toast.error("Vui lòng nhập địa chỉ (dùng trong hợp đồng dịch vụ đấu giá)");
      return;
    }
    if (!indForm.id_front_url || !indForm.id_back_url) {
      toast.error("Vui lòng tải lên ảnh CCCD 2 mặt");
      return;
    }
    if (!indForm.selfie_url) {
      toast.error("Vui lòng tải lên ảnh selfie");
      return;
    }
    await saveDraft.mutateAsync(indForm);
    await submit.mutateAsync();
    navigate("/profile?tab=my-assets");
  };

  // ─── Org doc upload ────────────────────────────────────────────────────────

  const handleOrgDocUpload = async (
    slot: "establishment_doc" | "authorization_doc" | "rep_id_front" | "rep_id_back" | "rep_selfie",
    file: File
  ) => {
    const path = await uploadDoc(file, slot);
    if (!path) {
      toast.error("Tải tài liệu thất bại, vui lòng thử lại");
      return;
    }
    const key = `${slot}_url` as keyof typeof orgForm;
    setOrgForm((prev) => ({ ...prev, [key]: path }));
  };

  const handleOrgSubmit = async () => {
    const problem = validateOrgKycForm(orgForm);
    if (problem) {
      toast.error(problem);
      return;
    }
    // Trạm của chi nhánh khớp theo thực thể — alias không dùng, không lưu.
    const payload = { ...orgForm, org_type: orgForm.org_type || undefined, ...(isBranchKyc ? { aliases: [] } : {}) };
    const recordId = await orgSaveDraft.mutateAsync(payload);
    await orgSubmit.mutateAsync(recordId);
    navigate("/profile?tab=my-assets");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading || kycLoading || orgKycLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm px-4">
            <p className="text-muted-foreground">Vui lòng đăng nhập để tiếp tục.</p>
            <Button onClick={() => openAuthDialog(() => window.location.reload())}>Đăng nhập</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <button onClick={() => navigate("/profile?tab=my-assets")} className="hover:text-foreground flex items-center gap-1">
            <Home className="h-3.5 w-3.5" />
            Tài sản của tôi
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">Xác thực Chủ tài sản</span>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Xác thực Chủ tài sản</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Kích hoạt vai trò Chủ tài sản để quản lý tài sản trên sàn đấu giá.
            </p>
          </div>

          {/* ─── No branch selected yet ─── */}
          {!branch && (
            <BranchSelector value={branch} onChange={(b) => setBranch(b)} />
          )}

          {/* ─── Đã chọn nhánh nhưng chưa submit → cho đổi lại ─── */}
          {branch && !kyc && !orgKyc && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Loại: <strong className="text-foreground">{branch === "individual" ? "Cá nhân" : "Tổ chức"}</strong></span>
              <button
                onClick={() => setBranch(null)}
                className="text-primary hover:underline font-medium"
              >
                ← Thay đổi
              </button>
            </div>
          )}

          {/* ─── INDIVIDUAL BRANCH ─── */}
          {branch === "individual" && (
            <>
              {kyc && kyc.status !== "draft" ? (
                <StatusScreen
                  status={kyc.status}
                  rejectionReason={kyc.rejection_reason}
                  onResubmit={() => saveDraft.mutate({ status: "draft" })}
                  submittedAt={kyc.submitted_at}
                />
              ) : (
                <div className="space-y-5">
                  <PreFillBanner fields={preFillFields} />

                  <PersonalInfoSection
                    fullName={indForm.full_name}
                    phone={indForm.phone}
                    phoneVerified={indForm.phone_verified}
                    contactEmail={indForm.contact_email}
                    idType={indForm.id_type}
                    idNumber={indForm.id_number}
                    onChange={(f) => setIndForm((prev) => ({ ...prev, ...f }))}
                  />

                  <AddressSection
                    title="Địa chỉ"
                    addressLabel="Số nhà, đường"
                    value={{ address: indForm.address, ward: indForm.ward, province: indForm.province }}
                    onChange={(f) => setIndForm((prev) => ({ ...prev, ...f }))}
                  />

                  <EKYCSection
                    idFrontUploaded={!!indForm.id_front_url}
                    idBackUploaded={!!indForm.id_back_url}
                    selfieUploaded={!!indForm.selfie_url}
                    onUpload={handleIndUpload}
                  />

                  <TermsSection
                    accepted={termsAccepted}
                    onAccept={setTermsAccepted}
                    onSubmit={handleIndSubmit}
                    disabled={false}
                    isSubmitting={submit.isPending}
                  />
                </div>
              )}
            </>
          )}

          {/* ─── ORGANIZATION BRANCH ─── */}
          {branch === "organization" && (
            <>
              {/* Đã duyệt → xong. Việc khớp tài sản đã chạy tự động phía server khi
                  hồ sơ được duyệt (trigger create_workspace_on_org_approval), nên
                  không còn bước claim chi nhánh thủ công ở đây nữa. */}
              {orgKyc?.status === "approved" && (
                <OrgApprovedCard workspace={workspace} loading={wsLoading} />
              )}

              {/* Tier 1 pending/under_review/rejected */}
              {orgKyc && orgKyc.status !== "draft" && orgKyc.status !== "approved" && (
                <StatusScreen
                  status={orgKyc.status}
                  rejectionReason={orgKyc.rejection_reason}
                  onResubmit={() => orgSaveDraft.mutate({ status: "draft" })}
                  isOrg
                  submittedAt={orgKyc.submitted_at}
                  orgName={orgKyc.org_name}
                />
              )}

              {/* Tier 1 form (draft or new) */}
              {(!orgKyc || orgKyc.status === "draft") && (
                <div className="space-y-5">
                  <OrgInfoSection
                    orgType={orgForm.org_type}
                    orgName={orgForm.org_name}
                    linkedAssetOwner={registryOwner}
                    kycScope={orgForm.kyc_scope}
                    parentOwner={parentOwner}
                    taxCode={orgForm.tax_code}
                    officialEmail={orgForm.official_email}
                    aliases={orgForm.aliases}
                    onChange={(f) => setOrgForm((prev) => ({ ...prev, ...f }))}
                    onSelectRegistryOwner={setRegistryOwner}
                    onSelectParentOwner={setParentOwner}
                  />

                  <AddressSection
                    title={isBranchKyc ? "Địa chỉ chi nhánh" : "Địa chỉ trụ sở"}
                    addressLabel={isBranchKyc ? "Địa chỉ chi nhánh" : "Địa chỉ trụ sở"}
                    showWard={false}
                    value={{
                      address: orgForm.head_office_address,
                      ward: "",
                      province: orgForm.head_office_province,
                    }}
                    onChange={(f) =>
                      setOrgForm((prev) => ({
                        ...prev,
                        ...(f.address !== undefined ? { head_office_address: f.address } : {}),
                        ...(f.province !== undefined ? { head_office_province: f.province } : {}),
                      }))
                    }
                  />

                  <RepInfoSection
                    repFullName={orgForm.rep_full_name}
                    repTitle={orgForm.rep_title}
                    repIdType={orgForm.rep_id_type}
                    repIdNumber={orgForm.rep_id_number}
                    isBranch={isBranchKyc}
                    onChange={(f) => setOrgForm((prev) => ({ ...prev, ...f }))}
                  />

                  <RepEKYCSection
                    repIdFrontUploaded={!!orgForm.rep_id_front_url}
                    repIdBackUploaded={!!orgForm.rep_id_back_url}
                    repSelfieUploaded={!!orgForm.rep_selfie_url}
                    isBranch={isBranchKyc}
                    onUpload={(slot, file) => handleOrgDocUpload(slot, file)}
                  />

                  <OrgDocsSection
                    establishmentUploaded={!!orgForm.establishment_doc_url}
                    authorizationUploaded={!!orgForm.authorization_doc_url}
                    isBranch={isBranchKyc}
                    termsAccepted={orgTermsAccepted}
                    onAcceptTerms={setOrgTermsAccepted}
                    onUpload={(slot, file) => handleOrgDocUpload(slot, file)}
                    onSubmit={handleOrgSubmit}
                    disabled={false}
                    isSubmitting={orgSubmit.isPending}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AssetOwnerOnboarding;
