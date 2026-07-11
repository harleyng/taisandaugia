import { EmailPreview } from "../EmailPreview";
import type { Campaign } from "@/types/marketing";

export function ContentTab({ campaign }: { campaign: Campaign }) {
  return (
    <EmailPreview
      subject={campaign.subject}
      previewText={campaign.preview_text}
      contentHtml={campaign.content_html}
    />
  );
}
