import { useEffect } from "react";
import { BadgeCheck } from "lucide-react";
import { PostingAuthenticationCard } from "@/components/authentication/PostingAuthenticationCard";
import { isExternalComplete } from "@/lib/dossier/draft";
import { SOURCE_LABEL } from "@/lib/dossier/types";
import type { AuthenticationRequiredReason } from "@/types/authentication";
import { Group, Pill } from "../fields";
import { sourcePatch } from "../dossier/dossierWizard";
import { AuthenticationFields } from "../dossier/fields/AuthenticationFields";
import { IncompletePartnerNote, ServiceSourceChoice } from "../service/ServiceSourceChoice";
import type { WizardValues } from "../wizardSchema";

interface AuthenticationGroupProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  postingId: string | null;
  ensurePostingId: () => Promise<string | null>;
  /** Lý do bắt buộc giám định (BR-GD-03) — có ⇒ chỉ còn "Dịch vụ của sàn". */
  gdReasons: AuthenticationRequiredReason[];
  gdLotReason: string | null;
}

const GD_REQUIRED = "Loại tài sản này bắt buộc chứng thư giám định qua sàn trước khi nộp hồ sơ.";

/**
 * Bước 4 — Giám định: đối tác riêng (kết luận + chứng thư, chỉ tham khảo) hoặc đặt giám định
 * qua sàn. Bắt buộc giám định ⇒ chỉ chứng thư của sàn được tính, khoá đối tác riêng.
 */
export function AuthenticationGroup({ f, up, postingId, ensurePostingId, gdReasons, gdLotReason }: AuthenticationGroupProps) {
  const d = f.dossier;
  const required = gdReasons.length > 0;
  const source = d.authentication.source;

  // Bắt buộc giám định ⇒ đối tác riêng không thay được chứng thư của sàn (server chặn nộp).
  useEffect(() => {
    if (required && source !== "marketplace") up(sourcePatch(f, "authentication", "marketplace"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required, source]);

  return (
    <Group
      icon={<BadgeCheck className="h-4 w-4" />}
      title="Giám định"
      desc="Chứng thư giám định độc lập xác thực tài sản và tăng mức xác minh của lô."
      right={
        required ? (
          <Pill tone="req">Bắt buộc</Pill>
        ) : source === "external_partner" || source === "marketplace" ? (
          <Pill tone="ok">{SOURCE_LABEL[source]}</Pill>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <ServiceSourceChoice
          kind="authentication"
          value={source}
          onChange={(v) => up(sourcePatch(f, "authentication", v))}
          externalLockedReason={required ? GD_REQUIRED : null}
        />
        {source === "external_partner" && !required && (
          <>
            <AuthenticationFields
              value={d.authentication}
              onChange={(p) => up({ dossier: { ...d, authentication: { ...d.authentication, ...p } } })}
              postingId={postingId}
              resolvePostingId={ensurePostingId}
            />
            {!isExternalComplete(d, "authentication") && <IncompletePartnerNote />}
          </>
        )}
        {source === "marketplace" && (
          <PostingAuthenticationCard
            variant="banner"
            postingId={postingId}
            mode="owner"
            resolvePostingId={ensurePostingId}
            requiredReasons={gdReasons}
            lotReason={gdLotReason}
          />
        )}
      </div>
    </Group>
  );
}
