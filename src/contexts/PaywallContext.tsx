import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AssetPaywallDialog } from "@/components/paywall/AssetPaywallDialog";
import { CompanyPaywallDialog } from "@/components/paywall/CompanyPaywallDialog";

interface PaywallContextValue {
  openAssetPaywall: (listingId: string) => void;
  openCompanyPaywall: (orgId: string) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export const PaywallProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [assetId, setAssetId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [assetOpen, setAssetOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  const openAssetPaywall = useCallback((id: string) => {
    setAssetId(id);
    setAssetOpen(true);
  }, []);

  const openCompanyPaywall = useCallback((id: string) => {
    setOrgId(id);
    setCompanyOpen(true);
  }, []);

  const returnPath = `${location.pathname}${location.search}`;

  return (
    <PaywallContext.Provider value={{ openAssetPaywall, openCompanyPaywall }}>
      {children}
      <AssetPaywallDialog
        open={assetOpen}
        onOpenChange={setAssetOpen}
        listingId={assetId}
        returnPath={returnPath}
      />
      <CompanyPaywallDialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        orgId={orgId}
        returnPath={returnPath}
      />
    </PaywallContext.Provider>
  );
};

export const usePaywall = () => {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within PaywallProvider");
  return ctx;
};
