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
import { OwnerPortalLayout } from "@/components/owner-portal/OwnerPortalLayout";
import { PaywallProvider } from "@/contexts/PaywallContext";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";

// Critical path — eager
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SetPassword from "./pages/SetPassword";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import AuctionDetail from "./pages/AuctionDetail";
import NotFound from "./pages/NotFound";

// Admin pages — lazy
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
const AdminUsersPage = lazy(() => import("./pages/admin/users/AdminUsersPage"));
const AdminUserDetail = lazy(() => import("./pages/admin/users/AdminUserDetail"));
const AdminAccountsPage = lazy(() => import("./pages/admin/quan-tri/AdminAccountsPage"));
const AdminRolesPage = lazy(() => import("./pages/admin/quan-tri/AdminRolesPage"));
const AdminRoleDetail = lazy(() => import("./pages/admin/quan-tri/AdminRoleDetail"));
const AdminAccountDetail = lazy(() => import("./pages/admin/quan-tri/AdminAccountDetail"));

// Protected pages — lazy
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AssetOwnerDetail = lazy(() => import("./pages/AssetOwnerDetail"));

// Portal pages — lazy
const DashboardPage = lazy(() => import("./pages/portal/DashboardPage"));
const ThongTinChungPage = lazy(() => import("./pages/portal/nang-luc/ThongTinChungPage"));
const DauGiaVienPage = lazy(() => import("./pages/portal/nang-luc/DauGiaVienPage"));
const CoSoVatChatPage = lazy(() => import("./pages/portal/nang-luc/CoSoVatChatPage"));
const LichSuDauGiaPage = lazy(() => import("./pages/portal/nang-luc/LichSuDauGiaPage"));
const TaiChinhPage = lazy(() => import("./pages/portal/nang-luc/TaiChinhPage"));
const PortalCreditsPage = lazy(() => import("./pages/portal/PortalCreditsPage"));
const ApplicationsPage = lazy(() => import("./pages/ApplicationsPage"));
const ApplicationEditPage = lazy(() => import("./pages/ApplicationEditPage"));

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

const App = () => (
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
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
                  <Route path="nang-luc/co-so-vat-chat" element={<CoSoVatChatPage />} />
                  <Route path="nang-luc/lich-su-dau-gia" element={<LichSuDauGiaPage />} />
                  <Route path="nang-luc/tai-chinh" element={<TaiChinhPage />} />

                  {/* Hồ sơ dự tuyển */}
                  <Route path="ho-so-du-tuyen" element={<ApplicationsPage />} />
                  <Route path="ho-so-du-tuyen/new" element={<ApplicationEditPage />} />
                  <Route path="ho-so-du-tuyen/:id" element={<ApplicationEditPage />} />

                  {/* Credit */}
                  <Route path="credits" element={<PortalCreditsPage />} />
                </Route>
              </Route>

              {/* Public company pages */}
              <Route path="/auction-org/:id" element={<CompanyDetail />} />
              <Route path="/asset-owner/:id" element={<ProtectedRoute />}>
                <Route index element={<AssetOwnerDetail />} />
              </Route>

              {/* Admin Portal */}
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
                  <Route path="co-hoi" element={<AdminPermissionRoute module="co-hoi"><AdminOpportunitiesPage /></AdminPermissionRoute>} />
                  <Route path="khach-hang" element={<AdminCustomersPage />} />
                  <Route path="khach-hang/:id" element={<AdminCustomerDetail />} />
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
                  <Route path="quan-tri" element={<Navigate to="/admin/quan-tri/tai-khoan" replace />} />
                  <Route path="quan-tri/tai-khoan" element={<AdminPermissionRoute module="tai-khoan"><AdminAccountsPage /></AdminPermissionRoute>} />
                  <Route path="quan-tri/tai-khoan/:id" element={<AdminPermissionRoute module="tai-khoan"><AdminAccountDetail /></AdminPermissionRoute>} />
                  <Route path="quan-tri/vai-tro" element={<AdminPermissionRoute module="vai-tro"><AdminRolesPage /></AdminPermissionRoute>} />
                  <Route path="quan-tri/vai-tro/:id" element={<AdminPermissionRoute module="vai-tro"><AdminRoleDetail /></AdminPermissionRoute>} />
                </Route>
              </Route>

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PaywallProvider>
      </BrowserRouter>
      </AuthDialogProvider>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
