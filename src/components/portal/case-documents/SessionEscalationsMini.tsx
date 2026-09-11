import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InfoBox } from "@/components/shared/InfoBox";
import { useOrgCaseEscalations } from "@/hooks/useCaseEscalations";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";

/** Câu hỏi người mua mà tài liệu phiên chưa trả lời được — nhắc bổ sung ngay trên trang phiên. */
export function SessionEscalationsMini({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const canView = useHasOrgPermission("hoi-dap", "view");
  const { data = [] } = useOrgCaseEscalations("open", sessionId);
  if (!canView || data.length === 0) return null;

  return (
    <InfoBox variant="amber" className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{data.length} câu hỏi của người mua chưa có trong tài liệu phiên</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/portal/hoi-dap?tab=chuyen-tiep")}>
          Xử lý
        </Button>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        {data.slice(0, 3).map((e) => (
          <li key={e.id}>{e.question}</li>
        ))}
      </ul>
    </InfoBox>
  );
}
