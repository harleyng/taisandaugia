import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { TermsGate } from "@/components/auth/TermsGate";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { AdminPermissionRoute } from "@/components/admin/AdminPermissionRoute";
import { SERVICE_KIND_MODULES } from "@/lib/serviceRequests/kinds";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalPermissionRoute } from "@/components/portal/PortalPermissionRoute";
import { OwnerPortalLayout } from "@/components/owner-portal/OwnerPortalLayout";
import { OwnerKycGate } from "@/components/owner-portal/OwnerKycGate";
import { PaywallProvider } from "@/contexts/PaywallContext";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

// Critical path — eager. CHỈ trang chủ, trang tìm kiếm và 404: đây là những gì
// khách vãng lai thấy đầu tiên nên đáng nằm trong entry bundle.
import Index from "./pages/Index";
import Listings from "./pages/Listings";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";

// Điều hướng tới sau — lazy như 84 route còn lại. Hai trang chi tiết là phần
// nặng nhất của entry chunk cũ mà không ai thấy khi vừa vào site.
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Auth = lazy(() => import("./pages/Auth"));
const SetPassword = lazy(() => import("./pages/SetPassword"));

// Admin pages — lazy
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminKYCPage = lazy(() => import("./pages/AdminKYCPage"));
const AdminKYCDetail = lazy(() => import("./pages/admin/AdminKYCDetail"));
const AdminAssetOwnerKYCPage = lazy(() => import("./pages/admin/AdminAssetOwnerKYCPage"));
const AdminAssetPostingsPage = lazy(() => import("./pages/admin/asset-postings/AdminAssetPostingsPage"));
const AdminAssetPostingDetail = lazy(() => import("./pages/admin/asset-postings/AdminAssetPostingDetail"));
const AdminServiceRequestsPage = lazy(() => import("./pages/admin/service-requests/AdminServiceRequestsPage"));
const AdminVrTourOrderDetail = lazy(() => import("./pages/admin/vr-tour/AdminVrTourOrderDetail"));
const AdminAuthenticationOrderDetail = lazy(() => import("./pages/admin/authentication/AdminAuthenticationOrderDetail"));
const AdminLegalConsultationDetail = lazy(() => import("./pages/admin/legal-consult/AdminLegalConsultationDetail"));
const AdminValuationOrderDetail = lazy(() => import("./pages/admin/valuation/AdminValuationOrderDetail"));
const AdminAuctionConsultationDetail = lazy(() => import("./pages/admin/auction-consult/AdminAuctionConsultationDetail"));
const AdminMarketingOrderDetail = lazy(() => import("./pages/admin/marketing-orders/AdminMarketingOrderDetail"));
const AdminAssetOwnerKYCDetail = lazy(() => import("./pages/admin/AdminAssetOwnerKYCDetail"));
const AdminArticlesPage = lazy(() => import("./pages/admin/AdminArticlesPage"));
const AdminArticleEditor = lazy(() => import("./pages/admin/AdminArticleEditor"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminCampaignsPage = lazy(() => import("./pages/admin/marketing/AdminCampaignsPage"));
const AdminCampaignEditor = lazy(() => import("./pages/admin/marketing/AdminCampaignEditor"));
const AdminCampaignDetail = lazy(() => import("./pages/admin/marketing/AdminCampaignDetail"));
const AdminAdsPage = lazy(() => import("./pages/admin/marketing/AdminAdsPage"));
const AdminAdEditor = lazy(() => import("./pages/admin/marketing/AdminAdEditor"));
const AdminAdDetail = lazy(() => import("./pages/admin/marketing/AdminAdDetail"));
const AdminAdPagesPage = lazy(() => import("./pages/admin/marketing/AdminAdPagesPage"));
const AdminAdPositionsPage = lazy(() => import("./pages/admin/marketing/AdminAdPositionsPage"));
const AdminCustomersPage = lazy(() => import("./pages/admin/customers/AdminCustomersPage"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/customers/AdminCustomerDetail"));
const AdminServicesPage = lazy(() => import("./pages/admin/services/AdminServicesPage"));
const AdminSuppliersPage = lazy(() => import("./pages/admin/suppliers/AdminSuppliersPage"));
const AdminSupplierDetail = lazy(() => import("./pages/admin/suppliers/AdminSupplierDetail"));
const AdminLeadsPage = lazy(() => import("./pages/admin/leads/AdminLeadsPage"));
const AdminLeadDetail = lazy(() => import("./pages/admin/leads/AdminLeadDetail"));
const AdminOpportunitiesPage = lazy(() => import("./pages/admin/opportunities/AdminOpportunitiesPage"));
const AdminTasksPage = lazy(() => import("./pages/admin/tasks/AdminTasksPage"));
const AdminTicketsPage = lazy(() => import("./pages/admin/tickets/AdminTicketsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/orders/AdminOrdersPage"));
const AdminOwnerSubscriptionsPage = lazy(() => import("./pages/admin/owner-subscriptions/AdminOwnerSubscriptionsPage"));
const AdminOwnerSubscriptionDetail = lazy(() => import("./pages/admin/owner-subscriptions/AdminOwnerSubscriptionDetail"));
const AdminOwnerSubPlansPage = lazy(() => import("./pages/admin/owner-subscriptions/AdminOwnerSubPlansPage"));
const AdminSubPackagePage = lazy(() => import("./pages/admin/owner-subscriptions/AdminSubPackagePage"));
const AdminSubTermsPage = lazy(() => import("./pages/admin/owner-subscriptions/AdminSubTermsPage"));
const AdminPartnersPage = lazy(() => import("./pages/admin/partners/AdminPartnersPage"));
const AdminAuctionToolsPage = lazy(() => import("./pages/admin/auction-tools/AdminAuctionToolsPage"));
const AdminLegalDocsPage = lazy(() => import("./pages/admin/legal/AdminLegalDocsPage"));
const AdminLegalEditor = lazy(() => import("./pages/admin/legal/AdminLegalEditor"));
const AdminLegalDetail = lazy(() => import("./pages/admin/legal/AdminLegalDetail"));
const AdminContractsPage = lazy(() => import("./pages/admin/contracts/AdminContractsPage"));
const AdminConsignmentContractPage = lazy(() =>
  import("./pages/admin/contracts/AdminContractDetailPages").then((m) => ({ default: m.AdminConsignmentContractPage })),
);
const AdminSaleContractPage = lazy(() =>
  import("./pages/admin/contracts/AdminContractDetailPages").then((m) => ({ default: m.AdminSaleContractPage })),
);
const AdminServiceContractPage = lazy(() =>
  import("./pages/admin/contracts/AdminContractDetailPages").then((m) => ({ default: m.AdminServiceContractPage })),
);
const AdminContractTemplatesPage = lazy(() => import("./pages/admin/contract-templates/AdminContractTemplatesPage"));
const AdminContractTemplateEditor = lazy(() => import("./pages/admin/contract-templates/AdminContractTemplateEditor"));
const AdminContractTemplateDetail = lazy(() => import("./pages/admin/contract-templates/AdminContractTemplateDetail"));
const TransactionReportPage = lazy(() => import("./pages/admin/reports/TransactionReportPage"));
const RevenueReportPage = lazy(() => import("./pages/admin/reports/RevenueReportPage"));
const AccessAnalyticsReportPage = lazy(() => import("./pages/admin/reports/AccessAnalyticsReportPage"));
const ListingsReportPage = lazy(() => import("./pages/admin/reports/ListingsReportPage"));
const CpdReportPage = lazy(() => import("./pages/admin/reports/CpdReportPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/users/AdminUsersPage"));
const AdminUserDetail = lazy(() => import("./pages/admin/users/AdminUserDetail"));
const AdminAccountsPage = lazy(() => import("./pages/admin/quan-tri/AdminAccountsPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/quan-tri/AdminRolesPage"));
const AdminRoleDetail = lazy(() => import("./pages/admin/quan-tri/AdminRoleDetail"));
const AdminAccountDetail = lazy(() => import("./pages/admin/quan-tri/AdminAccountDetail"));
const CpdCatalogPage = lazy(() => import("./pages/admin/quan-tri/CpdCatalogPage"));

// Protected pages — lazy
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AssetOwnerDetail = lazy(() => import("./pages/AssetOwnerDetail"));

// Portal pages — lazy
const DashboardPage = lazy(() => import("./pages/portal/DashboardPage"));
const ThongTinChungPage = lazy(() => import("./pages/portal/nang-luc/ThongTinChungPage"));
const DauGiaVienPage = lazy(() => import("./pages/portal/nang-luc/DauGiaVienPage"));
const DauGiaVienDetailPage = lazy(() => import("./pages/portal/nang-luc/DauGiaVienDetailPage"));
const HoSoNhanSuPage = lazy(() => import("./pages/portal/nang-luc/HoSoNhanSuPage"));
const BoiDuongPage = lazy(() => import("./pages/portal/BoiDuongPage"));
const TuTaiLieuPage = lazy(() => import("./pages/portal/nang-luc/TuTaiLieuPage"));
const CoSoVatChatPage = lazy(() => import("./pages/portal/nang-luc/CoSoVatChatPage"));
const LichSuDauGiaPage = lazy(() => import("./pages/portal/nang-luc/LichSuDauGiaPage"));
const TaiChinhPage = lazy(() => import("./pages/portal/nang-luc/TaiChinhPage"));
const YeuCauKyGuiPage = lazy(() => import("./pages/portal/YeuCauKyGuiPage"));
const PhienDauGiaPage = lazy(() => import("./pages/portal/PhienDauGiaPage"));
const PhienDauGiaDetailPage = lazy(() => import("./pages/portal/PhienDauGiaDetailPage"));
const PhienDauGiaQaPreviewPage = lazy(() => import("./pages/portal/PhienDauGiaQaPreviewPage"));
const BidderCardPrintPage = lazy(() => import("./pages/portal/BidderCardPrintPage"));
const HoiDapPage = lazy(() => import("./pages/portal/HoiDapPage"));
const KhachHangPage = lazy(() => import("./pages/portal/KhachHangPage"));
const KhachHangDetailPage = lazy(() => import("./pages/portal/KhachHangDetailPage"));
const HoSoThamGiaPage = lazy(() => import("./pages/portal/HoSoThamGiaPage"));
const HopDongMuaBanPage = lazy(() => import("./pages/portal/HopDongMuaBanPage"));
const HopDongMuaBanDetailPage = lazy(() => import("./pages/portal/HopDongMuaBanDetailPage"));
const PortalCreditsPage = lazy(() => import("./pages/portal/PortalCreditsPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const ApplicationEditPage = lazy(() => import("./pages/ApplicationEditPage"));
const OrgMembersPage = lazy(() => import("./pages/portal/to-chuc/OrgMembersPage"));
const OrgRolesPage = lazy(() => import("./pages/portal/to-chuc/OrgRolesPage"));
const OrgRoleDetailPage = lazy(() => import("./pages/portal/to-chuc/OrgRoleDetailPage"));
const InviteAcceptPage = lazy(() => import("./pages/InviteAcceptPage"));
const OwnerInviteAcceptPage = lazy(() => import("./pages/OwnerInviteAcceptPage"));
const SharedOwnerReportPage = lazy(() => import("./pages/SharedOwnerReportPage"));
const TrackingLinkRedirectPage = lazy(() => import("./pages/TrackingLinkRedirectPage"));
const SharedPostingPage = lazy(() => import("./pages/SharedPostingPage"));
const SharedPostingPrintPage = lazy(() => import("./pages/SharedPostingPrintPage"));

// Secondary public pages — lazy
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const MarketReport = lazy(() => import("./pages/MarketReport"));
const MarketReportCategory = lazy(() => import("./pages/MarketReportCategory"));
const MarketReportOutcomes = lazy(() => import("./pages/MarketReportOutcomes"));
const CompanyOnboarding = lazy(() => import("./pages/CompanyOnboarding"));
const AssetOwnerOnboarding = lazy(() => import("./pages/AssetOwnerOnboarding"));
const OwnerAssetsPage = lazy(() => import("./pages/OwnerAssetsPage"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const OwnerBranchesPage = lazy(() => import("./pages/OwnerBranchesPage"));
const OwnerReportPage = lazy(() => import("./pages/OwnerReportPage"));
const OwnerCreditsPage = lazy(() => import("./pages/chu-tai-san/OwnerCreditsPage"));
const OwnerSubscriptionPage = lazy(() => import("./pages/chu-tai-san/OwnerSubscriptionPage"));
const OwnerSubscriptionPlansPage = lazy(() => import("./pages/chu-tai-san/OwnerSubscriptionPlansPage"));
const OwnerMembersPage = lazy(() => import("./pages/chu-tai-san/OwnerMembersPage"));
const OwnerRolesPage = lazy(() => import("./pages/chu-tai-san/OwnerRolesPage"));
const OwnerAuditLogPage = lazy(() => import("./pages/chu-tai-san/OwnerAuditLogPage"));
const OwnerRoleDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerRoleDetailPage"));
const OwnerLinksPage = lazy(() => import("./pages/chu-tai-san/OwnerLinksPage"));
const OwnerOutcomesPage = lazy(() => import("./pages/chu-tai-san/OwnerOutcomesPage"));
const OwnerCashFlowPage = lazy(() => import("./pages/chu-tai-san/OwnerCashFlowPage"));
const OwnerPartnersPage = lazy(() => import("./pages/chu-tai-san/OwnerPartnersPage"));
const OwnerCollectionsPage = lazy(() => import("./pages/chu-tai-san/OwnerCollectionsPage"));
const OwnerTargetsPage = lazy(() => import("./pages/chu-tai-san/OwnerTargetsPage"));
const OwnerTargetDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerTargetDetailPage"));
const OwnerTargetFormPage = lazy(() => import("./pages/chu-tai-san/OwnerTargetFormPage"));
const OwnerPeriodicReportsPage = lazy(() => import("./pages/chu-tai-san/OwnerPeriodicReportsPage"));
const OwnerPeriodicReportDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerPeriodicReportDetailPage"));
const OwnerPeriodicReportPrintPage = lazy(() => import("./pages/chu-tai-san/OwnerPeriodicReportPrintPage"));
const OwnerPostingPrintPage = lazy(() => import("./pages/chu-tai-san/OwnerPostingPrintPage"));
const OwnerSaleContractDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerSaleContractDetailPage"));
const OwnerContractsPage = lazy(() => import("./pages/chu-tai-san/OwnerContractsPage"));
const OwnerMarketingPage = lazy(() => import("./pages/chu-tai-san/OwnerMarketingPage"));
const OwnerMarketingCampaignFormPage = lazy(() => import("./pages/chu-tai-san/OwnerMarketingCampaignFormPage"));
const OwnerMarketingCampaignDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerMarketingCampaignDetailPage"));
const OwnerMarketingOrderDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerMarketingOrderDetailPage"));
const OwnerShareLinkDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerShareLinkDetailPage"));
const OwnerAdPerformancePage = lazy(() => import("./pages/chu-tai-san/OwnerAdPerformancePage"));
const OwnerMarketingDataFlowPage = lazy(() => import("./pages/chu-tai-san/OwnerMarketingDataFlowPage"));
const OwnerConsignmentContractPage = lazy(() => import("./pages/chu-tai-san/OwnerConsignmentContractPage"));
const OwnerServiceContractPage = lazy(() => import("./pages/chu-tai-san/OwnerServiceContractPage"));
const OwnerConsignmentsPage = lazy(() => import("./pages/chu-tai-san/OwnerConsignmentsPage"));
const OwnerConsignmentDetailPage = lazy(() => import("./pages/chu-tai-san/OwnerConsignmentDetailPage"));
const SaleContractPage = lazy(() => import("./pages/SaleContractPage"));
const AssetPostingWizardPage = lazy(() => import("./pages/AssetPostingWizardPage"));
const AssetPostingDetailPage = lazy(() => import("./pages/AssetPostingDetailPage"));
const Scan3dPartnerSimulator = lazy(() => import("./pages/Scan3dPartnerSimulator"));
const BuyCredits = lazy(() => import("./pages/BuyCredits"));
const VnpayCheckout = lazy(() => import("./pages/VnpayCheckout"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const PWAInstall = lazy(() => import("./pages/PWAInstall"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const OrgMatchingSpec = lazy(() => import("./pages/OrgMatchingSpec"));
const TinTucPage = lazy(() => import("./pages/TinTucPage"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const AuctionToolsPage = lazy(() => import("./pages/AuctionToolsPage"));
const CraftVillagesPage = lazy(() => import("./pages/CraftVillagesPage"));
const AuctionToolDetail = lazy(() => import("./pages/AuctionToolDetail"));
const AuctionSessions = lazy(() => import("./pages/AuctionSessions"));
const AuctionSessionDetail = lazy(() => import("./pages/AuctionSessionDetail"));
const AuctionSessionQaPage = lazy(() => import("./pages/AuctionSessionQaPage"));
const AuctionBiddingRoomPage = lazy(() => import("./pages/AuctionBiddingRoomPage"));
const BidderRegistrationPage = lazy(() => import("./pages/BidderRegistrationPage"));

function RedirectApplicationId() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/portal/ho-so-du-tuyen/${id}`} replace />
}

// Link cũ /nang-luc/ho-so-nhan-su/:id từng là chi tiết một người. Chi tiết nay
// nằm ở Hồ sơ năng lực (nơi dữ liệu sống), nên trỏ thẳng về đó thay vì đi vòng
// qua /nhan-su/:id — màn đó giờ chỉ là danh sách kết xuất.
// Menu dịch vụ cũ (4 mục riêng) đã gộp vào /admin/yeu-cau-dich-vu — giữ link/bookmark đã phát ra.
function RedirectServiceRequestId({ kind }: { kind: string }) {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/admin/yeu-cau-dich-vu/${kind}/${id}`} replace />
}

// Menu "Hợp đồng mua bán" của chủ tài sản đã gộp vào "Hợp đồng" — giữ link đã phát ra.
function RedirectOwnerSaleContractId() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/chu-tai-san/hop-dong/mua-ban/${id}`} replace />
}

// Chi tiết gói của Trạm chuyển từ /admin/goi-thue-bao/:id sang menu con "Áp dụng gói".
function RedirectOwnerSubscriptionId() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  return <Navigate to={`/admin/goi-thue-bao/ap-dung/${workspaceId}`} replace />
}

function RedirectNhanSuId() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/portal/nang-luc/dau-gia-vien/${id}`} replace />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Skeleton trong lúc chờ chunk của route. Trước đây fallback là một div trống
 * min-h-screen — về mặt thị giác không khác gì màn hình trắng, nên user không
 * biết app đang tải hay đã treo.
 */
const RouteFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto space-y-4 px-4 py-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-40" />
      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  </div>
);

const App = () => (
  // Tầng 1 — bọc NGOÀI mọi provider: lỗi trong chính provider (AuthProvider,
  // PaywallProvider) cũng phải có chỗ đỡ, nếu không vẫn là màn hình trắng.
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TermsGate />
    <TooltipProvider>
      <AuthDialogProvider>
      <Toaster />
      <Sonner />
      <AuthDialog />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PaywallProvider>
          <AnalyticsTracker />
          {/* Tầng 2 — trong Router: lỗi ở một route không kéo sập toàn app,
              và ChunkLoadError sau deploy được tự phục hồi tại đây. */}
          <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Marketplace */}
              <Route path="/" element={<Index />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/auctions/:id" element={<AuctionDetail />} />
              <Route path="/report" element={<MarketReport />} />
              <Route path="/report/:slug" element={<MarketReportCategory />} />
              <Route path="/report/deep/outcomes" element={<MarketReportOutcomes />} />
              <Route path="/install" element={<PWAInstall />} />
              <Route path="/lien-he" element={<Contact />} />
              <Route path="/gioi-thieu" element={<About />} />
              <Route path="/chinh-sach-bao-mat" element={<PrivacyPolicy />} />
              <Route path="/dieu-khoan-su-dung" element={<TermsOfUse />} />

              <Route path="/cach-cham-diem-to-chuc" element={<OrgMatchingSpec />} />
              <Route path="/dang-ky-to-chuc" element={<CompanyOnboarding />} />
              <Route path="/tro-thanh-chu-tai-san" element={<AssetOwnerOnboarding />} />
              <Route path="/tin-tuc" element={<TinTucPage />} />
              <Route path="/tin-tuc/:slug" element={<ArticleDetail />} />
              <Route path="/cong-cu-dau-gia" element={<AuctionToolsPage />} />
              <Route path="/lang-nghe" element={<CraftVillagesPage />} />
              <Route path="/cong-cu-dau-gia/:slug" element={<AuctionToolDetail />} />
              <Route path="/sessions" element={<AuctionSessions />} />
              <Route path="/sessions/:id" element={<AuctionSessionDetail />} />
              <Route path="/sessions/:id/hoi-dap" element={<AuctionSessionQaPage />} />
              <Route path="/sessions/:id/dau-gia" element={<AuctionBiddingRoomPage />} />
              {/* Đăng ký tham gia (mua hồ sơ) 4 bước — cần đăng nhập */}
              <Route path="/sessions/:id/dang-ky" element={<ProtectedRoute />}>
                <Route index element={<BidderRegistrationPage />} />
              </Route>

              {/* Credits */}
              <Route path="/buy-credits" element={<BuyCredits />} />
              <Route path="/payment/vnpay" element={<VnpayCheckout />} />
              <Route path="/payment-result" element={<PaymentResult />} />

              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/tao-mat-khau" element={<SetPassword />} />

              {/* Lời mời vào tổ chức — công khai, tự xử lý đăng nhập + kích hoạt */}
              <Route path="/loi-moi/:token" element={<InviteAcceptPage />} />
              {/* Lời mời vào không gian chủ tài sản — công khai, tự xử lý đăng nhập + kích hoạt */}
              <Route path="/loi-moi-chu-tai-san/:token" element={<OwnerInviteAcceptPage />} />
              {/* Báo cáo định kỳ chia sẻ qua link chỉ đọc — công khai, không cần đăng nhập */}
              <Route path="/r/:token" element={<SharedOwnerReportPage />} />
              {/* Link theo dõi của Truyền thông — công khai, đếm lượt mở rồi chuyển tới trang tin */}
              <Route path="/l/:code" element={<TrackingLinkRedirectPage />} />
              {/* Hồ sơ online — link công khai của hồ sơ số hoá, ngân hàng gửi khách qua kênh riêng */}
              <Route path="/hs/:code" element={<SharedPostingPage />} />
              <Route path="/hs/:code/in" element={<SharedPostingPrintPage />} />

              {/* Redirects: old ho-so-du-tuyen paths → portal */}
              <Route path="/ho-so-du-tuyen" element={<Navigate to="/portal/ho-so-du-tuyen" replace />} />
              <Route path="/ho-so-du-tuyen/new" element={<Navigate to="/portal/ho-so-du-tuyen/new" replace />} />
              <Route path="/ho-so-du-tuyen/:id" element={<RedirectApplicationId />} />

              {/* Protected: Profile */}
              <Route path="/saved-assets" element={<Navigate to="/profile?tab=saved" replace />} />
              <Route path="/profile" element={<ProtectedRoute />}>
                <Route index element={<ProfilePage />} />
              </Route>

              {/* Mô phỏng app đối tác quét 3D (mở từ deeplink "Thêm 3D") — màn đứng riêng */}
              <Route path="/doi-tac-3d/quet" element={<ProtectedRoute />}>
                <Route index element={<Scan3dPartnerSimulator />} />
              </Route>

              {/* Hợp đồng mua bán của người trúng đấu giá — KHÔNG bao giờ công khai */}
              <Route path="/hop-dong-mua-ban/:id" element={<ProtectedRoute />}>
                <Route index element={<SaleContractPage />} />
              </Route>

              {/* Protected: Asset Owner Portal — sidebar layout */}
              <Route path="/chu-tai-san" element={<ProtectedRoute />}>
                <Route element={<OwnerPortalLayout />}>
                  <Route index element={<Navigate to="/chu-tai-san/dashboard" replace />} />
                  <Route path="dashboard" element={<OwnerDashboard />} />
                  <Route path="tai-san" element={<OwnerAssetsPage />} />
                  <Route path="ket-qua" element={<OwnerOutcomesPage />} />
                  <Route path="dong-tien" element={<OwnerCashFlowPage />} />
                  <Route path="doi-tac" element={<OwnerPartnersPage />} />
                  <Route path="thu-tien" element={<OwnerCollectionsPage />} />
                  <Route path="truyen-thong" element={<OwnerMarketingPage />} />
                  <Route path="truyen-thong/du-lieu" element={<OwnerMarketingDataFlowPage />} />
                  <Route path="truyen-thong/giao-viec/:id" element={<OwnerMarketingOrderDetailPage />} />
                  <Route path="truyen-thong/link-theo-doi/:linkId" element={<OwnerShareLinkDetailPage />} />
                  <Route path="truyen-thong/chien-dich/moi" element={<OwnerMarketingCampaignFormPage />} />
                  <Route path="truyen-thong/chien-dich/:id" element={<OwnerMarketingCampaignDetailPage />} />
                  <Route path="truyen-thong/chien-dich/:id/sua" element={<OwnerMarketingCampaignFormPage />} />
                  <Route path="hieu-qua-quang-cao" element={<OwnerAdPerformancePage />} />
                  <Route path="chi-tieu" element={<OwnerTargetsPage />} />
                  <Route path="chi-tieu/moi" element={<OwnerTargetFormPage />} />
                  <Route path="chi-tieu/:id" element={<OwnerTargetDetailPage />} />
                  <Route path="chi-tieu/:id/sua" element={<OwnerTargetFormPage />} />
                  <Route path="bao-cao-dinh-ky" element={<OwnerPeriodicReportsPage />} />
                  <Route path="bao-cao-dinh-ky/:id" element={<OwnerPeriodicReportDetailPage />} />
                  {/* Cổng KYC chủ tài sản ở layout: danh sách + chi tiết hồ sơ dùng chung,
                      chuyển qua lại không kiểm lại / nháy loader. */}
                  <Route path="dang-tai-san" element={<OwnerKycGate />}>
                    <Route index element={<AssetPostingWizardPage />} />
                    <Route path=":id" element={<AssetPostingDetailPage />} />
                  </Route>
                  {/* Ký gửi đấu giá: theo dõi gửi tổ chức / báo giá / hợp đồng dịch vụ.
                      :id là id HỒ SƠ — cùng cổng KYC với khu số hoá. */}
                  <Route path="ky-gui-dau-gia" element={<OwnerKycGate />}>
                    <Route index element={<OwnerConsignmentsPage />} />
                    <Route path=":id" element={<OwnerConsignmentDetailPage />} />
                  </Route>
                  <Route path="chi-nhanh-amc" element={<OwnerBranchesPage />} />
                  <Route path="thanh-vien" element={<OwnerMembersPage />} />
                  <Route path="vai-tro" element={<OwnerRolesPage />} />
                  <Route path="vai-tro/:id" element={<OwnerRoleDetailPage />} />
                  <Route path="lien-ket" element={<OwnerLinksPage />} />
                  <Route path="nhat-ky" element={<OwnerAuditLogPage />} />
                  <Route path="bao-cao" element={<OwnerReportPage />} />
                  <Route path="goi-thue-bao" element={<OwnerSubscriptionPage />} />
                  <Route path="goi-thue-bao/cac-goi" element={<OwnerSubscriptionPlansPage />} />
                  <Route path="credits" element={<OwnerCreditsPage />} />
                  {/* Hợp đồng: ký gửi (với tổ chức) · mua bán (với người trúng — chi tiết
                      dùng CHUNG trang với bên mua, vai suy từ can_act) · dịch vụ (với sàn). */}
                  <Route path="hop-dong" element={<OwnerContractsPage />} />
                  <Route path="hop-dong/ky-gui/:id" element={<OwnerConsignmentContractPage />} />
                  <Route path="hop-dong/mua-ban/:id" element={<OwnerSaleContractDetailPage />} />
                  <Route path="hop-dong/dich-vu/:id" element={<OwnerServiceContractPage />} />
                  <Route path="hop-dong-mua-ban" element={<Navigate to="/chu-tai-san/hop-dong?loai=mua-ban" replace />} />
                  <Route path="hop-dong-mua-ban/:id" element={<RedirectOwnerSaleContractId />} />
                </Route>
                {/* Trang in A4 của báo cáo định kỳ — không sidebar / topbar */}
                <Route path="bao-cao-dinh-ky/:id/in" element={<OwnerPeriodicReportPrintPage />} />
                {/* Trang in / lưu PDF hồ sơ số hoá — không sidebar / topbar */}
                <Route path="dang-tai-san/:id/in" element={<OwnerPostingPrintPage />} />
              </Route>

              {/* Protected: Company Portal — sidebar layout */}
              <Route path="/portal" element={<ProtectedRoute />}>
                {/* Thẻ số báo danh A6 — trang in, ngoài PortalLayout (không có OrgProvider
                    nên không bọc PortalPermissionRoute): RLS abc_select_org là cổng —
                    thiếu quyền view/checkin thì query trả rỗng. */}
                <Route path="phien-dau-gia/:id/diem-danh/:contractId/the" element={<BidderCardPrintPage />} />
                <Route element={<PortalLayout />}>
                  <Route index element={<Navigate to="/portal/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />

                  {/* Hồ sơ năng lực */}
                  <Route path="nang-luc/thong-tin-chung" element={<ThongTinChungPage />} />
                  <Route path="nang-luc/dau-gia-vien" element={<DauGiaVienPage />} />
                  <Route path="nang-luc/dau-gia-vien/:id" element={<DauGiaVienDetailPage />} />
                  <Route path="nang-luc/tu-tai-lieu" element={<TuTaiLieuPage />} />
                  <Route path="nang-luc/co-so-vat-chat" element={<CoSoVatChatPage />} />
                  <Route path="nang-luc/lich-su-dau-gia" element={<LichSuDauGiaPage />} />
                  <Route path="nang-luc/tai-chinh" element={<TaiChinhPage />} />

                  {/* Hồ sơ nhân sự — mục cấp cao riêng (tách khỏi Hồ sơ năng lực) */}
                  <Route
                    path="nhan-su"
                    element={
                      <PortalPermissionRoute module="nhan-su">
                        <HoSoNhanSuPage />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Chi tiết một người nay thuộc Hồ sơ năng lực (nơi dữ liệu sống);
                      /nhan-su chỉ còn là màn kết xuất. */}
                  <Route
                    path="nhan-su/:id"
                    element={<Navigate to="/portal/nang-luc/dau-gia-vien" replace />}
                  />
                  {/* Giữ URL cũ sống: link/bookmark đã phát ra trước khi tách menu */}
                  <Route
                    path="nang-luc/ho-so-nhan-su"
                    element={<Navigate to="/portal/nhan-su" replace />}
                  />
                  <Route path="nang-luc/ho-so-nhan-su/:id" element={<RedirectNhanSuId />} />

                  {/* Bồi dưỡng chuyên môn hằng năm — TT 19/2024/TT-BTP */}
                  <Route
                    path="boi-duong"
                    element={
                      <PortalPermissionRoute module="boi-duong">
                        <BoiDuongPage />
                      </PortalPermissionRoute>
                    }
                  />

                  {/* Hồ sơ dự tuyển */}
                  <Route path="ho-so-du-tuyen" element={<ApplicationsPage />} />
                  <Route path="ho-so-du-tuyen/new" element={<ApplicationEditPage />} />
                  <Route path="ho-so-du-tuyen/:id" element={<ApplicationEditPage />} />

                  {/* Yêu cầu ký gửi tài sản từ chủ sở hữu */}
                  <Route
                    path="yeu-cau-ky-gui"
                    element={
                      <PortalPermissionRoute module="yeu-cau-ky-gui">
                        <YeuCauKyGuiPage />
                      </PortalPermissionRoute>
                    }
                  />

                  {/* Credit */}
                  <Route
                    path="phien-dau-gia"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/moi"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaDetailPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/:id"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaDetailPage />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Các tab của trang chi tiết phiên — cùng một component, tab
                      chạy trên đường dẫn. "ho-so" gác bằng module RIÊNG của hồ sơ
                      tham gia. */}
                  <Route
                    path="phien-dau-gia/:id/tai-san"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaDetailPage tab="tai-san" />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/:id/tai-lieu"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaDetailPage tab="tai-lieu" />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/:id/ho-so"
                    element={
                      <PortalPermissionRoute module="ho-so-tham-gia">
                        <PhienDauGiaDetailPage tab="ho-so" />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Điểm danh: nhân viên cửa có thể chỉ có quyền "checkin". */}
                  <Route
                    path="phien-dau-gia/:id/diem-danh"
                    element={
                      <PortalPermissionRoute module="ho-so-tham-gia" anyOf={["view", "checkin"]}>
                        <PhienDauGiaDetailPage tab="diem-danh" />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/:id/hoi-dap"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaQaPreviewPage />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Hỏi đáp & omnichat: câu hỏi người mua từ sàn + Zalo */}
                  <Route
                    path="hoi-dap"
                    element={
                      <PortalPermissionRoute module="hoi-dap">
                        <HoiDapPage />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Hồ sơ tham gia đấu giá người mua đã thanh toán */}
                  <Route
                    path="ho-so-tham-gia"
                    element={
                      <PortalPermissionRoute module="ho-so-tham-gia">
                        <HoSoThamGiaPage />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Hợp đồng mua bán — giai đoạn sau khi phiên chốt kết quả.
                      Danh sách và chi tiết cùng một mã quyền. */}
                  <Route
                    path="hop-dong-mua-ban"
                    element={
                      <PortalPermissionRoute module="hop-dong-mua-ban">
                        <HopDongMuaBanPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="hop-dong-mua-ban/:id"
                    element={
                      <PortalPermissionRoute module="hop-dong-mua-ban">
                        <HopDongMuaBanDetailPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="phien-dau-gia/:id/tiep-thi"
                    element={
                      <PortalPermissionRoute module="phien-dau-gia">
                        <PhienDauGiaDetailPage tab="tiep-thi" />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Phòng điều hành đấu giá trực tuyến — quyền RIÊNG, không phải
                      phien-dau-gia: điều hành phiên đang chạy là việc khác với sửa phiên. */}
                  <Route
                    path="phien-dau-gia/:id/dieu-hanh"
                    element={
                      <PortalPermissionRoute module="dieu-hanh-dau-gia">
                        <PhienDauGiaDetailPage tab="dieu-hanh" />
                      </PortalPermissionRoute>
                    }
                  />
                  {/* Danh bạ khách hàng riêng của tổ chức */}
                  <Route
                    path="khach-hang"
                    element={
                      <PortalPermissionRoute module="khach-hang">
                        <KhachHangPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="khach-hang/:id"
                    element={
                      <PortalPermissionRoute module="khach-hang">
                        <KhachHangDetailPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route path="credits" element={<PortalCreditsPage />} />

                  {/* Tổ chức — thành viên & vai trò */}
                  <Route path="to-chuc" element={<Navigate to="/portal/to-chuc/thanh-vien" replace />} />
                  <Route
                    path="to-chuc/thanh-vien"
                    element={
                      <PortalPermissionRoute module="thanh-vien">
                        <OrgMembersPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="to-chuc/vai-tro"
                    element={
                      <PortalPermissionRoute module="vai-tro">
                        <OrgRolesPage />
                      </PortalPermissionRoute>
                    }
                  />
                  <Route
                    path="to-chuc/vai-tro/:id"
                    element={
                      <PortalPermissionRoute module="vai-tro">
                        <OrgRoleDetailPage />
                      </PortalPermissionRoute>
                    }
                  />
                </Route>
              </Route>

              {/* Public company pages */}
              <Route path="/auction-org/:id" element={<CompanyDetail />} />
              <Route path="/asset-owner/:id" element={<ProtectedRoute />}>
                <Route index element={<AssetOwnerDetail />} />
              </Route>

              {/* Admin Portal */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="kyc" element={<AdminKYCPage />} />
                  {/* Ticket thay the han hop thu cu — giu redirect cho link/bookmark da phat ra */}
                  <Route path="ticket" element={<AdminPermissionRoute module="lien-he"><AdminTicketsPage /></AdminPermissionRoute>} />
                  <Route path="cong-viec" element={<AdminPermissionRoute module="cong-viec"><AdminTasksPage /></AdminPermissionRoute>} />
                  <Route path="lien-he-hop-tac" element={<Navigate to="/admin/ticket" replace />} />
                  <Route path="collaboration" element={<Navigate to="/admin/ticket?nguon=partnership" replace />} />
                  <Route path="contacts" element={<Navigate to="/admin/ticket" replace />} />
                  <Route path="kyc/:id" element={<AdminKYCDetail />} />
                  <Route path="chu-tai-san" element={<AdminAssetOwnerKYCPage />} />
                  <Route path="chu-tai-san/:type/:id" element={<AdminAssetOwnerKYCDetail />} />
                  <Route
                    path="tai-san"
                    element={
                      <AdminPermissionRoute module="tai-san-tu-nguyen">
                        <AdminAssetPostingsPage />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="tai-san/:id"
                    element={
                      <AdminPermissionRoute module="tai-san-tu-nguyen">
                        <AdminAssetPostingDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu"
                    element={
                      <AdminPermissionRoute anyOf={SERVICE_KIND_MODULES}>
                        <AdminServiceRequestsPage />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/vr-tour/:id"
                    element={
                      <AdminPermissionRoute module="don-vr-tour">
                        <AdminVrTourOrderDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/giam-dinh/:id"
                    element={
                      <AdminPermissionRoute module="don-giam-dinh">
                        <AdminAuthenticationOrderDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/tham-dinh/:id"
                    element={
                      <AdminPermissionRoute module="tham-dinh-gia">
                        <AdminValuationOrderDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/tu-van-phap-ly/:id"
                    element={
                      <AdminPermissionRoute module="tu-van-phap-ly">
                        <AdminLegalConsultationDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/tu-van-dau-gia/:id"
                    element={
                      <AdminPermissionRoute module="tu-van-dau-gia">
                        <AdminAuctionConsultationDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route
                    path="yeu-cau-dich-vu/truyen-thong/:id"
                    element={
                      <AdminPermissionRoute module="don-truyen-thong">
                        <AdminMarketingOrderDetail />
                      </AdminPermissionRoute>
                    }
                  />
                  <Route path="vr-tour" element={<Navigate to="/admin/yeu-cau-dich-vu?loai=vr-tour" replace />} />
                  <Route path="vr-tour/:id" element={<RedirectServiceRequestId kind="vr-tour" />} />
                  <Route path="giam-dinh" element={<Navigate to="/admin/yeu-cau-dich-vu?loai=giam-dinh" replace />} />
                  <Route path="giam-dinh/:id" element={<RedirectServiceRequestId kind="giam-dinh" />} />
                  <Route path="tu-van-phap-ly" element={<Navigate to="/admin/yeu-cau-dich-vu?loai=tu-van-phap-ly" replace />} />
                  <Route path="tu-van-phap-ly/:id" element={<RedirectServiceRequestId kind="tu-van-phap-ly" />} />
                  <Route path="tu-van-dau-gia" element={<Navigate to="/admin/yeu-cau-dich-vu?loai=tu-van-dau-gia" replace />} />
                  <Route path="tu-van-dau-gia/:id" element={<RedirectServiceRequestId kind="tu-van-dau-gia" />} />
                  <Route path="tin-tuc" element={<AdminArticlesPage />} />
                  <Route path="tin-tuc/new" element={<AdminArticleEditor />} />
                  <Route path="tin-tuc/danh-muc" element={<AdminCategoriesPage />} />
                  <Route path="tin-tuc/:id" element={<AdminArticleEditor />} />
                  <Route path="marketing/email" element={<AdminCampaignsPage />} />
                  <Route path="marketing/email/new" element={<AdminCampaignEditor />} />
                  <Route path="marketing/email/:id" element={<AdminCampaignDetail />} />
                  <Route path="marketing/email/:id/edit" element={<AdminCampaignEditor />} />
                  <Route path="marketing/quang-cao" element={<AdminAdsPage />} />
                  <Route path="marketing/quang-cao/trang" element={<AdminAdPagesPage />} />
                  <Route path="marketing/quang-cao/vi-tri" element={<AdminAdPositionsPage />} />
                  <Route path="marketing/quang-cao/new" element={<AdminAdEditor />} />
                  <Route path="marketing/quang-cao/:id" element={<AdminAdDetail />} />
                  <Route path="marketing/quang-cao/:id/edit" element={<AdminAdEditor />} />
                  <Route path="nguoi-dung" element={<AdminUsersPage />} />
                  <Route path="nguoi-dung/:id" element={<AdminUserDetail />} />
                  <Route path="khach-hang-tiem-nang" element={<AdminPermissionRoute module="khach-hang-tiem-nang"><AdminLeadsPage /></AdminPermissionRoute>} />
                  <Route path="khach-hang-tiem-nang/:id" element={<AdminPermissionRoute module="khach-hang-tiem-nang"><AdminLeadDetail /></AdminPermissionRoute>} />
                  <Route path="co-hoi" element={<AdminPermissionRoute module="co-hoi"><AdminOpportunitiesPage /></AdminPermissionRoute>} />
                  <Route path="khach-hang" element={<AdminPermissionRoute module="khach-hang"><AdminCustomersPage /></AdminPermissionRoute>} />
                  <Route path="khach-hang/:id" element={<AdminPermissionRoute module="khach-hang"><AdminCustomerDetail /></AdminPermissionRoute>} />
                  <Route path="doi-tac" element={<AdminPermissionRoute module="nha-cung-cap"><AdminSuppliersPage /></AdminPermissionRoute>} />
                  <Route path="doi-tac/:id" element={<AdminPermissionRoute module="nha-cung-cap"><AdminSupplierDetail /></AdminPermissionRoute>} />
                  <Route path="dich-vu" element={<AdminPermissionRoute module="dich-vu"><AdminServicesPage /></AdminPermissionRoute>} />
                  <Route path="don-hang" element={<AdminPermissionRoute module="don-hang"><AdminOrdersPage /></AdminPermissionRoute>} />
                  {/* Gói thuê bao — 2 menu con: Danh mục gói + Áp dụng gói (gói của từng Trạm) */}
                  <Route path="goi-thue-bao" element={<Navigate to="/admin/goi-thue-bao/ap-dung" replace />} />
                  <Route path="goi-thue-bao/danh-muc" element={<AdminPermissionRoute module="goi-thue-bao"><AdminOwnerSubPlansPage /></AdminPermissionRoute>} />
                  <Route path="goi-thue-bao/danh-muc/:packageId" element={<AdminPermissionRoute module="goi-thue-bao"><AdminSubPackagePage /></AdminPermissionRoute>} />
                  <Route path="goi-thue-bao/ky-mua" element={<AdminPermissionRoute module="goi-thue-bao"><AdminSubTermsPage /></AdminPermissionRoute>} />
                  <Route path="goi-thue-bao/ap-dung" element={<AdminPermissionRoute module="goi-thue-bao"><AdminOwnerSubscriptionsPage /></AdminPermissionRoute>} />
                  <Route path="goi-thue-bao/ap-dung/:workspaceId" element={<AdminPermissionRoute module="goi-thue-bao"><AdminOwnerSubscriptionDetail /></AdminPermissionRoute>} />
                  <Route path="goi-thue-bao/:workspaceId" element={<RedirectOwnerSubscriptionId />} />
                  <Route path="doi-tac-tren-san" element={<AdminPartnersPage />} />
                  <Route path="hien-thi-tren-san" element={<Navigate to="/admin/doi-tac-tren-san" replace />} />
                  {/* Pháp lý & Đấu giá — hợp đồng (chỉ đọc) + mẫu hợp đồng có phiên bản */}
                  <Route path="hop-dong" element={<AdminPermissionRoute module="hop-dong"><AdminContractsPage /></AdminPermissionRoute>} />
                  <Route path="hop-dong/ky-gui/:id" element={<AdminPermissionRoute module="hop-dong"><AdminConsignmentContractPage /></AdminPermissionRoute>} />
                  <Route path="hop-dong/mua-ban/:id" element={<AdminPermissionRoute module="hop-dong"><AdminSaleContractPage /></AdminPermissionRoute>} />
                  <Route path="hop-dong/dich-vu/:id" element={<AdminPermissionRoute module="hop-dong"><AdminServiceContractPage /></AdminPermissionRoute>} />
                  <Route path="mau-hop-dong" element={<AdminPermissionRoute module="mau-hop-dong"><AdminContractTemplatesPage /></AdminPermissionRoute>} />
                  <Route path="mau-hop-dong/tao" element={<AdminPermissionRoute module="mau-hop-dong" action="create"><AdminContractTemplateEditor /></AdminPermissionRoute>} />
                  <Route path="mau-hop-dong/:id" element={<AdminPermissionRoute module="mau-hop-dong"><AdminContractTemplateDetail /></AdminPermissionRoute>} />
                  <Route path="phap-ly" element={<AdminPermissionRoute module="phap-ly"><AdminLegalDocsPage /></AdminPermissionRoute>} />
                  <Route path="phap-ly/tao" element={<AdminPermissionRoute module="phap-ly" action="create"><AdminLegalEditor /></AdminPermissionRoute>} />
                  <Route path="phap-ly/:id" element={<AdminPermissionRoute module="phap-ly"><AdminLegalDetail /></AdminPermissionRoute>} />
                  <Route path="cong-cu-dau-gia" element={<AdminPermissionRoute module="cong-cu-dau-gia"><AdminAuctionToolsPage /></AdminPermissionRoute>} />
                  <Route path="bao-cao" element={<Navigate to="/admin/bao-cao/giao-dich" replace />} />
                  <Route path="bao-cao/doanh-thu" element={<AdminPermissionRoute module="doanh-thu"><RevenueReportPage /></AdminPermissionRoute>} />
                  <Route path="bao-cao/giao-dich" element={<TransactionReportPage />} />
                  <Route path="bao-cao/truy-cap" element={<AccessAnalyticsReportPage />} />
                  <Route path="bao-cao/tin-dau-gia" element={<AdminPermissionRoute module="tin-dau-gia"><ListingsReportPage /></AdminPermissionRoute>} />
                  <Route path="bao-cao/boi-duong" element={<AdminPermissionRoute module="boi-duong"><CpdReportPage /></AdminPermissionRoute>} />
                  <Route path="quan-tri" element={<Navigate to="/admin/quan-tri/tai-khoan" replace />} />
                  <Route path="quan-tri/tai-khoan" element={<AdminPermissionRoute module="tai-khoan"><AdminAccountsPage /></AdminPermissionRoute>} />
                  <Route path="quan-tri/tai-khoan/:id" element={<AdminPermissionRoute module="tai-khoan"><AdminAccountDetail /></AdminPermissionRoute>} />
                  <Route path="quan-tri/vai-tro" element={<AdminPermissionRoute module="vai-tro"><AdminRolesPage /></AdminPermissionRoute>} />
                  <Route path="quan-tri/vai-tro/:id" element={<AdminPermissionRoute module="vai-tro"><AdminRoleDetail /></AdminPermissionRoute>} />
                  {/* Danh mục bồi dưỡng — master data cho cách chấm nghĩa vụ TT 19/2024/TT-BTP */}
                  <Route path="quan-tri/boi-duong" element={<AdminPermissionRoute module="dm-boi-duong"><CpdCatalogPage /></AdminPermissionRoute>} />
                </Route>
              </Route>

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </PaywallProvider>
      </BrowserRouter>
      </AuthDialogProvider>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
