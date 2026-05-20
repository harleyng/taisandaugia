import { KYCForm, KYCSubmitData } from "./M2/KYCForm";

interface M2KYCProps {
  accountEmail: string;
  onComplete: (data: KYCSubmitData) => void;
}

export const M2KYC = ({ accountEmail, onComplete }: M2KYCProps) => (
  <KYCForm accountEmail={accountEmail} onSubmit={onComplete} />
);
