import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatSettingsTab } from "@/components/portal/case-chat/ChatSettingsTab";
import { EscalationsTab } from "@/components/portal/case-chat/EscalationsTab";
import { InboxTab } from "@/components/portal/case-chat/InboxTab";
import { SimulateZaloDialog } from "@/components/portal/case-chat/SimulateZaloDialog";
import { useChatAttentionCounts } from "@/hooks/useOrgChat";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";

const TABS = ["hop-thu", "chuyen-tiep", "cai-dat"] as const;
type Tab = (typeof TABS)[number];

/** /portal/hoi-dap — hộp thư hỏi đáp đa kênh (sàn + Zalo) của tổ chức đấu giá. */
export default function HoiDapPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "hop-thu";
  const counts = useChatAttentionCounts();
  const canUpdate = useHasOrgPermission("hoi-dap", "update");
  const [simulating, setSimulating] = useState(false);

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    if (value !== "hop-thu") next.delete("c");
    setParams(next, { replace: true });
  };

  const openConversation = (conversationId: string) =>
    setParams(new URLSearchParams({ tab: "hop-thu", loc: "all", c: conversationId }));

  const stats = [
    { label: "Câu hỏi chờ trả lời", value: counts.awaitingReply },
    { label: "Nháp AI chờ duyệt", value: counts.drafts },
    { label: "Câu hỏi chuyển tiếp", value: counts.openEscalations },
  ];

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Hỏi đáp &amp; Omnichat</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Câu hỏi của người mua từ sàn và Zalo trong một hộp thư. AI chỉ trả lời bằng trích dẫn tài liệu phiên; điều gì
            tài liệu chưa nêu sẽ chuyển cho chuyên viên.
          </p>
        </div>
        {canUpdate && (
          <Button className="gap-1.5" onClick={() => setSimulating(true)}>
            <MessageSquarePlus className="h-4 w-4" />
            Giả lập tin Zalo
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hop-thu">Hộp thư</TabsTrigger>
          <TabsTrigger value="chuyen-tiep">Chuyển tiếp ({counts.openEscalations})</TabsTrigger>
          <TabsTrigger value="cai-dat">Cài đặt</TabsTrigger>
        </TabsList>
        <TabsContent value="hop-thu" className="mt-4">
          <InboxTab />
        </TabsContent>
        <TabsContent value="chuyen-tiep" className="mt-4">
          <EscalationsTab />
        </TabsContent>
        <TabsContent value="cai-dat" className="mt-4">
          <ChatSettingsTab />
        </TabsContent>
      </Tabs>

      {simulating && <SimulateZaloDialog onClose={() => setSimulating(false)} onSent={openConversation} />}
    </div>
  );
}
