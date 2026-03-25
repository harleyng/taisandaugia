import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthDialogProvider } from "@/contexts/AuthDialogContext";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BrokerLayout } from "@/components/layouts/BrokerLayout";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import AuctionDetail from "./pages/AuctionDetail";
import SubmitListing from "./pages/SubmitListing";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminListings from "./pages/AdminListings";
import AdminListingDetail from "./pages/admin/AdminListingDetail";
import AdminBrokers from "./pages/admin/AdminBrokers";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import NotFound from "./pages/NotFound";
import BrokerDashboard from "./pages/portal/BrokerDashboard";
import BrokerProperties from "./pages/portal/BrokerProperties";
import BrokerPropertyDetail from "./pages/portal/BrokerPropertyDetail";
import BrokerCustomers from "./pages/portal/BrokerCustomers";
import BrokerMarketing from "./pages/portal/BrokerMarketing";
import BrokerOrganization from "./pages/portal/BrokerOrganization";
import BrokerOrganizations from "./pages/portal/BrokerOrganizations";
import BrokerProfile from "./pages/portal/BrokerProfile";
import CreateOrganization from "./pages/portal/CreateOrganization";
import InviteMember from "./pages/portal/InviteMember";
import OrganizationInvites from "./pages/portal/OrganizationInvites";
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
          
          {/* Broker Portal - All authenticated users can access */}
          <Route element={<ProtectedRoute />}>
            {/* Standalone pages without layout */}
            <Route path="/broker/properties/new" element={<SubmitListing />} />
            <Route path="/broker/properties/:id/edit" element={<SubmitListing />} />
            <Route path="/broker/properties/:id" element={<BrokerPropertyDetail />} />
            
            {/* Pages with sidebar layout */}
            <Route path="/broker" element={<BrokerLayout />}>
              <Route index element={<Navigate to="/broker/dashboard" replace />} />
              <Route path="dashboard" element={<BrokerDashboard />} />
              <Route path="properties" element={<BrokerProperties />} />
              <Route path="customers" element={<BrokerCustomers />} />
              <Route path="marketing" element={<BrokerMarketing />} />
              <Route path="organizations" element={<BrokerOrganizations />} />
              <Route path="organization" element={<BrokerOrganization />} />
              <Route path="organization/create" element={<CreateOrganization />} />
              <Route path="organization/invite" element={<InviteMember />} />
              <Route path="organization/invites" element={<OrganizationInvites />} />
              <Route path="profile" element={<BrokerProfile />} />
            </Route>
          </Route>
          
          {/* Admin Portal - Separate Authentication System */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route element={<ProtectedRoute roles={['ADMIN']} adminOnly />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="properties" element={<AdminListings />} />
              <Route path="properties/:id" element={<AdminListingDetail />} />
              <Route path="brokers" element={<AdminBrokers />} />
              <Route path="organizations" element={<AdminOrganizations />} />
              <Route path="listings" element={<AdminListings />} />
            </Route>
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
