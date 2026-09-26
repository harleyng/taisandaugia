import { AuthenticationPolicyCard } from "./AuthenticationPolicyCard";
import { SellerRestrictionsCard } from "./SellerRestrictionsCard";

/** Luật bắt buộc giám định (BR-GD-03): chính sách chung + người bán bị hạn chế. */
export function AuthenticationSettingsPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Chính sách bắt buộc giám định</h2>
        <AuthenticationPolicyCard />
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Người bán bắt buộc giám định</h2>
        <SellerRestrictionsCard />
      </section>
    </div>
  );
}
