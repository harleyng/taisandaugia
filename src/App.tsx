import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
            <Route path="/install" element={<PWAInstall />} />

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
            <Route path="/asset-owner/:id" element={<AssetOwnerDetail />} />

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
