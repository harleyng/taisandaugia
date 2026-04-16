import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import AuctionDetail from "./pages/AuctionDetail";
import NotFound from "./pages/NotFound";
import SavedAssetsPage from "./pages/SavedAssetsPage";
import ProfilePage from "./pages/ProfilePage";
import PWAInstall from "./pages/PWAInstall";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthDialogProvider>
      <Toaster />
      <Sonner />
      <AuthDialog />
      <BrowserRouter>
        <Routes>
          {/* Public Marketplace */}
          <Route path="/" element={<Index />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/auctions/:id" element={<AuctionDetail />} />
          <Route path="/install" element={<PWAInstall />} />
          
          {/* Auth */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected: Saved Assets & Profile */}
          <Route path="/saved-assets" element={<ProtectedRoute />}>
            <Route index element={<SavedAssetsPage />} />
          </Route>
          <Route path="/profile" element={<ProtectedRoute />}>
            <Route index element={<ProfilePage />} />
          </Route>
          
          {/* 404 Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AuthDialogProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
