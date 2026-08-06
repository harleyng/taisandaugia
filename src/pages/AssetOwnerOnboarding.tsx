import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, Home, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthDialog } from "@/contexts/AuthDialogContext";

import { trackFeature } from "@/lib/analytics/track";
import { useAssetOwnerKYC } from "@/hooks/useAssetOwnerKYC";
import { useAssetOwnerOrgKYC } from "@/hooks/useAssetOwnerOrgKYC";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";

import { BranchSelector } from "@/components/asset-owner-onboarding/BranchSelector";
import { PreFillBanner } from "@/components/asset-owner-onboarding/PreFillBanner";
import { StatusScreen } from "@/components/asset-owner-onboarding/StatusScreen";

import { PersonalInfoSection } from "@/components/asset-owner-onboarding/individual/PersonalInfoSection";
import { EKYCSection } from "@/components/asset-owner-onboarding/individual/EKYCSection";
import { TermsSection } from "@/components/asset-owner-onboarding/individual/TermsSection";

import { OrgInfoSection } from "@/components/asset-owner-onboarding/organization/tier1/OrgInfoSection";
import { RepInfoSection } from "@/components/asset-owner-onboarding/organization/tier1/RepInfoSection";
import { RepEKYCSection } from "@/components/asset-owner-onboarding/organization/tier1/RepEKYCSection";
import { OrgDocsSection } from "@/components/asset-owner-onboarding/organization/tier1/OrgDocsSection";

import type { AssetOwnerBranch, IdType, OrgType, RegistryAssetOwner } from "@/types/asset-owner";
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

  useEffect(() => {
    trackFeature("start_owner_kyc");
  }, []);

  // Individual KYC local form state
  const [indForm, setIndForm] = useState({
    full_name: "", phone: "", phone_verified: false,
    contact_email: "", id_type: "cccd" as IdType, id_number: "",
    id_front_url: null as string | null,
    id_back_url: null as string | null,
    selfie_url: null as string | null,
  });

  // Org KYC local form state
  const [orgForm, setOrgForm] = useState({
    org_type: "" as OrgType | "",
    org_name: "", tax_code: "", official_email: "", email_domain: "",
    aliases: [] as string[],
    linked_asset_owner_id: null as string | null,
    linked_auction_org_id: null as string | null,
    registry_match_score: null as number | null,
    rep_full_name: "", rep_title: "",
    rep_id_type: "cccd" as IdType, rep_id_number: "",
    rep_id_front_url: null as string | null,
    rep_id_back_url: null as string | null,
    rep_selfie_url: null as string | null,
    establishment_doc_url: null as string | null,
    authorization_doc_url: null as string | null,
  });

  const userId = profile?.id ?? null;
  const { kyc, isLoading: kycLoading, saveDraft, submit, uploadEKYCFile } = useAssetOwnerKYC(userId);
  const { orgKyc, isLoading: orgKycLoading, saveDraft: orgSaveDraft, submit: orgSubmit, uploadDoc } = useAssetOwnerOrgKYC(userId);
  // Chỉ để hiển thị số tài sản đã được khớp tự động sau khi duyệt — mọi thao tác
  // chỉnh alias / khớp lại nay nằm ở portal (/chu-tai-san/chi-nhanh-amc).
  const { workspace, wsLoading } = useAssetOwnerWorkspace(userId);

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
      .select("id, name, address, owner_kind, aliases")
      .eq("id", ownerId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setRegistryOwner(data as RegistryAssetOwner);
      });
    return () => { cancelled = true; };
  }, [orgKyc?.linked_asset_owner_id, registryOwner?.id]);

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
    if (!orgForm.org_type) {
      toast.error("Vui lòng chọn loại tổ chức");
      return;
    }
    if (orgForm.org_name.trim().length < 3) {
      toast.error("Vui lòng nhập tên tổ chức đầy đủ");
      return;
    }
    if (orgForm.tax_code.trim().length < 5) {
      toast.error("Mã số thuế / mã cơ quan chưa hợp lệ");
      return;
    }
    if (!orgForm.official_email.includes("@")) {
      toast.error("Email công vụ chưa hợp lệ");
      return;
    }
    if (orgForm.rep_full_name.trim().length < 3) {
      toast.error("Vui lòng nhập họ tên người đại diện");
      return;
    }
    if (!orgForm.rep_title.trim()) {
      toast.error("Vui lòng nhập chức vụ người đại diện");
      return;
    }
    if (orgForm.rep_id_number.trim().length < 6) {
      toast.error("Số CCCD / hộ chiếu người đại diện chưa hợp lệ");
      return;
    }
    if (!orgForm.rep_id_front_url || !orgForm.rep_id_back_url) {
      toast.error("Vui lòng tải lên ảnh CCCD người đại diện (2 mặt)");
      return;
    }
    if (!orgForm.rep_selfie_url) {
      toast.error("Vui lòng tải lên ảnh selfie người đại diện");
      return;
    }
    if (!orgForm.establishment_doc_url) {
      toast.error("Vui lòng tải lên giấy phép / quyết định thành lập");
      return;
    }
    const recordId = await orgSaveDraft.mutateAsync({ ...orgForm, org_type: orgForm.org_type || undefined });
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
                <>
                  {wsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-2xl bg-success/10 border border-success/25 p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <h3 className="font-semibold text-foreground">Tổ chức đã được xác thực</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Hệ thống đã tự nhận diện và gán{" "}
                          <strong className="text-foreground">
                            {workspace?.total_claimed ?? 0} tài sản
                          </strong>{" "}
                          vào danh mục của bạn dựa trên tên và các alias đã khai. Bạn không cần làm
                          thêm bước nào.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Muốn bổ sung alias hoặc đơn vị thành viên để tìm thêm tài sản? Vào mục{" "}
                          <strong>Chi nhánh</strong> trong cổng Chủ tài sản.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button onClick={() => navigate("/chu-tai-san/dashboard")}>
                            Vào cổng Chủ tài sản
                          </Button>
                          <Button variant="outline" onClick={() => navigate("/chu-tai-san/chi-nhanh-amc")}>
                            Quản lý alias &amp; chi nhánh
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
                    taxCode={orgForm.tax_code}
                    officialEmail={orgForm.official_email}
                    aliases={orgForm.aliases}
                    onChange={(f) => setOrgForm((prev) => ({ ...prev, ...f }))}
                    onSelectRegistryOwner={setRegistryOwner}
                  />

                  <RepInfoSection
                    repFullName={orgForm.rep_full_name}
                    repTitle={orgForm.rep_title}
                    repIdType={orgForm.rep_id_type}
                    repIdNumber={orgForm.rep_id_number}
                    onChange={(f) => setOrgForm((prev) => ({ ...prev, ...f }))}
                  />

                  <RepEKYCSection
                    repIdFrontUploaded={!!orgForm.rep_id_front_url}
                    repIdBackUploaded={!!orgForm.rep_id_back_url}
                    repSelfieUploaded={!!orgForm.rep_selfie_url}
                    onUpload={(slot, file) => handleOrgDocUpload(slot, file)}
                  />

                  <OrgDocsSection
                    establishmentUploaded={!!orgForm.establishment_doc_url}
                    authorizationUploaded={!!orgForm.authorization_doc_url}
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
