import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AssetPaywallDialog } from "@/components/paywall/AssetPaywallDialog";
import { CompanyPaywallDialog } from "@/components/paywall/CompanyPaywallDialog";

interface PaywallContextValue {
  openAssetPaywall: (listingId: string, label?: string) => void;
  openCompanyPaywall: (orgId: string, label?: string) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export const PaywallProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetLabel, setAssetLabel] = useState<string | undefined>(undefined);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLabel, setOrgLabel] = useState<string | undefined>(undefined);
  const [assetOpen, setAssetOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  const openAssetPaywall = useCallback((id: string, label?: string) => {
    setAssetId(id);
    setAssetLabel(label);
    setAssetOpen(true);
  }, []);

  const openCompanyPaywall = useCallback((id: string, label?: string) => {
    setOrgId(id);
    setOrgLabel(label);
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
        listingLabel={assetLabel}
        returnPath={returnPath}
      />
      <CompanyPaywallDialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        orgId={orgId}
        orgLabel={orgLabel}
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
