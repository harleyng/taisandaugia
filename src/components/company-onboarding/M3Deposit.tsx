import { DepositCard } from "./DepositCard";

interface M3DepositProps {
  onComplete: () => void;
}

export const M3Deposit = ({ onComplete }: M3DepositProps) => (
  <DepositCard context="company" onComplete={onComplete} />
);
