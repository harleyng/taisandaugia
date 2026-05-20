import { KYCForm } from "./M2/KYCForm";

interface M2KYCProps {
  accountEmail: string;
  onComplete: (companyId: string) => void;
}

export const M2KYC = ({ accountEmail, onComplete }: M2KYCProps) => (
  <KYCForm accountEmail={accountEmail} onSubmit={(companyId) => onComplete(companyId)} />
);
