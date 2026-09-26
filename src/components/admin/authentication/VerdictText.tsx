import { gdVerdictLabel } from "@/lib/authentication/status";

const VERDICT_TONE: Record<string, string> = {
  authentic: "text-success",
  inconclusive: "text-warning",
  suspected_fake: "text-destructive",
};

export function VerdictText({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-muted-foreground">—</span>;
  return <span className={`font-medium ${VERDICT_TONE[verdict] ?? ""}`}>{gdVerdictLabel(verdict)}</span>;
}
