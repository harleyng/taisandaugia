import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { OwnerPortalLayout } from "@/components/owner-portal/OwnerPortalLayout";
import { PaywallProvider } from "@/contexts/PaywallContext";

// Critical path — eager
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
const AdminCollaborationPage = lazy(() => import("./pages/admin/AdminCollaborationPage"));
const AdminContactsPage = lazy(() => import("./pages/admin/AdminContactsPage"));
const AdminArticlesPage = lazy(() => import("./pages/admin/AdminArticlesPage"));
const AdminArticleEditor = lazy(() => import("./pages/admin/AdminArticleEditor"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));

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
    <TooltipProvider>
      <AuthDialogProvider>
      <Toaster />
      <Sonner />
      <AuthDialog />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PaywallProvider>
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

              {/* Credits */}
              <Route path="/buy-credits" element={<BuyCredits />} />
              <Route path="/payment/vnpay" element={<VnpayCheckout />} />
              <Route path="/payment-result" element={<PaymentResult />} />

              {/* Auth */}
              <Route path="/auth" element={<Auth />} />

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
                  <Route path="collaboration" element={<AdminCollaborationPage />} />
                  <Route path="kyc/:id" element={<AdminKYCDetail />} />
                  <Route path="chu-tai-san" element={<AdminAssetOwnerKYCPage />} />
                  <Route path="chu-tai-san/:type/:id" element={<AdminAssetOwnerKYCDetail />} />
                  <Route path="contacts" element={<AdminContactsPage />} />
                  <Route path="tin-tuc" element={<AdminArticlesPage />} />
                  <Route path="tin-tuc/new" element={<AdminArticleEditor />} />
                  <Route path="tin-tuc/danh-muc" element={<AdminCategoriesPage />} />
                  <Route path="tin-tuc/:id" element={<AdminArticleEditor />} />
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
