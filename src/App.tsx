import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminKYCPage from "@/pages/AdminKYCPage";
import AdminKYCDetail from "@/pages/admin/AdminKYCDetail";
import AdminCollaborationPage from "@/pages/admin/AdminCollaborationPage";
import AdminContactsPage from "@/pages/admin/AdminContactsPage";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import AuctionDetail from "./pages/AuctionDetail";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import PWAInstall from "./pages/PWAInstall";
import CompanyDetail from "./pages/CompanyDetail";
import AssetOwnerDetail from "./pages/AssetOwnerDetail";
import BuyCredits from "./pages/BuyCredits";
import PaymentResult from "./pages/PaymentResult";
import VnpayCheckout from "./pages/VnpayCheckout";
import MarketReport from "./pages/MarketReport";
import MarketReportCategory from "./pages/MarketReportCategory";
import MarketReportOutcomes from "./pages/MarketReportOutcomes";
import Contact from "./pages/Contact";
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import CompanyOnboarding from "./pages/CompanyOnboarding";
import { PaywallProvider } from "@/contexts/PaywallContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthDialogProvider>
      <Toaster />
      <Sonner />
      <AuthDialog />
      <BrowserRouter>
        <PaywallProvider>
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

            {/* Credits */}
            <Route path="/buy-credits" element={<BuyCredits />} />
            <Route path="/payment/vnpay" element={<VnpayCheckout />} />
            <Route path="/payment-result" element={<PaymentResult />} />

            {/* Auth */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected: Saved Assets & Profile */}
            <Route path="/saved-assets" element={<Navigate to="/profile?tab=saved" replace />} />
            <Route path="/profile" element={<ProtectedRoute />}>
              <Route index element={<ProfilePage />} />
            </Route>
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
                <Route path="contacts" element={<AdminContactsPage />} />
              </Route>
            </Route>

            {/* 404 Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PaywallProvider>
      </BrowserRouter>
      </AuthDialogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
