import { useAuthenticationRules, usePostingAuthenticationState } from "@/hooks/useAuthenticationOrders";
import { PostingAuthenticationCard } from "./PostingAuthenticationCard";

interface PostingAuthenticationSectionProps {
  postingId: string;
  reviewStatus: string | null;
  mode: "owner" | "admin";
  locked?: boolean;
}

/** Thẻ giám định của hồ sơ ĐÃ LƯU — lý do bắt buộc lấy từ server (posting_authentication_state). */
export function PostingAuthenticationSection({ postingId, reviewStatus, mode, locked }: PostingAuthenticationSectionProps) {
  const { data: state } = usePostingAuthenticationState(postingId);
  const { data: rules } = useAuthenticationRules(mode === "owner" ? postingId : null);

  return (
    <PostingAuthenticationCard
      postingId={postingId}
      reviewStatus={reviewStatus}
      mode={mode}
      locked={locked}
      requiredReasons={state?.reasons ?? []}
      lotReason={rules?.lotReason ?? null}
    />
  );
}
