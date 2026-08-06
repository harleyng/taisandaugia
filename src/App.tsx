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
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalPermissionRoute } from "@/components/portal/PortalPermissionRoute";
import { OwnerPortalLayout } from "@/components/owner-portal/OwnerPortalLayout";
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
const AdminLeadsPage = lazy(() => import("./pages/admin/leads/AdminLeadsPage"));
const AdminLeadDetail = lazy(() => import("./pages/admin/leads/AdminLeadDetail"));
const AdminOpportunitiesPage = lazy(() => import("./pages/admin/opportunities/AdminOpportunitiesPage"));
const AdminTasksPage = lazy(() => import("./pages/admin/tasks/AdminTasksPage"));
const AdminTicketsPage = lazy(() => import("./pages/admin/tickets/AdminTicketsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/orders/AdminOrdersPage"));
const AdminPartnersPage = lazy(() => import("./pages/admin/partners/AdminPartnersPage"));
const AdminAuctionToolsPage = lazy(() => import("./pages/admin/auction-tools/AdminAuctionToolsPage"));
const AdminLegalDocsPage = lazy(() => import("./pages/admin/legal/AdminLegalDocsPage"));
const AdminLegalEditor = lazy(() => import("./pages/admin/legal/AdminLegalEditor"));
const AdminLegalDetail = lazy(() => import("./pages/admin/legal/AdminLegalDetail"));
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
const PortalCreditsPage = lazy(() => import("./pages/portal/PortalCreditsPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const ApplicationEditPage = lazy(() => import("./pages/ApplicationEditPage"));
const OrgMembersPage = lazy(() => import("./pages/portal/to-chuc/OrgMembersPage"));
const OrgRolesPage = lazy(() => import("./pages/portal/to-chuc/OrgRolesPage"));
const OrgRoleDetailPage = lazy(() => import("./pages/portal/to-chuc/OrgRoleDetailPage"));
const InviteAcceptPage = lazy(() => import("./pages/InviteAcceptPage"));

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
const AssetPostingWizardPage = lazy(() => import("./pages/AssetPostingWizardPage"));
const BuyCredits = lazy(() => import("./pages/BuyCredits"));
const VnpayCheckout = lazy(() => import("./pages/VnpayCheckout"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const PWAInstall = lazy(() => import("./pages/PWAInstall"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const TinTucPage = lazy(() => import("./pages/TinTucPage"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const AuctionToolsPage = lazy(() => import("./pages/AuctionToolsPage"));
const AuctionToolDetail = lazy(() => import("./pages/AuctionToolDetail"));

function RedirectApplicationId() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/portal/ho-so-du-tuyen/${id}`} replace />
}

// Link cũ /nang-luc/ho-so-nhan-su/:id từng là chi tiết một người. Chi tiết nay
// nằm ở Hồ sơ năng lực (nơi dữ liệu sống), nên trỏ thẳng về đó thay vì đi vòng
// qua /nhan-su/:id — màn đó giờ chỉ là danh sách kết xuất.
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
              <Route path="/dang-ky-to-chuc" element={<CompanyOnboarding />} />
              <Route path="/tro-thanh-chu-tai-san" element={<AssetOwnerOnboarding />} />
              <Route path="/tin-tuc" element={<TinTucPage />} />
              <Route path="/tin-tuc/:slug" element={<ArticleDetail />} />
              <Route path="/cong-cu-dau-gia" element={<AuctionToolsPage />} />
              <Route path="/cong-cu-dau-gia/:slug" element={<AuctionToolDetail />} />

              {/* Credits */}
              <Route path="/buy-credits" element={<BuyCredits />} />
              <Route path="/payment/vnpay" element={<VnpayCheckout />} />
              <Route path="/payment-result" element={<PaymentResult />} />

              {/* Auth */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/tao-mat-khau" element={<SetPassword />} />

              {/* Lời mời vào tổ chức — công khai, tự xử lý đăng nhập + kích hoạt */}
              <Route path="/loi-moi/:token" element={<InviteAcceptPage />} />

              {/* Redirects: old ho-so-du-tuyen paths → portal */}
              <Route path="/ho-so-du-tuyen" element={<Navigate to="/portal/ho-so-du-tuyen" replace />} />
              <Route path="/ho-so-du-tuyen/new" element={<Navigate to="/portal/ho-so-du-tuyen/new" replace />} />
              <Route path="/ho-so-du-tuyen/:id" element={<RedirectApplicationId />} />

              {/* Protected: Profile */}
              <Route path="/saved-assets" element={<Navigate to="/profile?tab=saved" replace />} />
              <Route path="/profile" element={<ProtectedRoute />}>
                <Route index element={<ProfilePage />} />
              </Route>

              {/* Protected: Asset Owner Portal — sidebar layout */}
              <Route path="/chu-tai-san" element={<ProtectedRoute />}>
                <Route element={<OwnerPortalLayout />}>
                  <Route index element={<Navigate to="/chu-tai-san/dashboard" replace />} />
                  <Route path="dashboard" element={<OwnerDashboard />} />
                  <Route path="tai-san" element={<OwnerAssetsPage />} />
                  <Route path="dang-tai-san" element={<AssetPostingWizardPage />} />
                  <Route path="chi-nhanh-amc" element={<OwnerBranchesPage />} />
                  <Route path="bao-cao" element={<OwnerReportPage />} />
                  <Route path="credits" element={<OwnerCreditsPage />} />
                </Route>
              </Route>

              {/* Protected: Company Portal — sidebar layout */}
              <Route path="/portal" element={<ProtectedRoute />}>
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

                  {/* Credit */}
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
                  <Route path="dich-vu" element={<AdminPermissionRoute module="dich-vu"><AdminServicesPage /></AdminPermissionRoute>} />
                  <Route path="don-hang" element={<AdminPermissionRoute module="don-hang"><AdminOrdersPage /></AdminPermissionRoute>} />
                  <Route path="doi-tac-tren-san" element={<AdminPartnersPage />} />
                  <Route path="hien-thi-tren-san" element={<Navigate to="/admin/doi-tac-tren-san" replace />} />
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
