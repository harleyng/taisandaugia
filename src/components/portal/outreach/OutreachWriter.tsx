import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { OutreachWorkspace } from "@/hooks/useOutreachWorkspace";
import { useUpdateChannel } from "@/hooks/useOutreachChannels";
import { useSavePost, useWriterContext, writePost } from "@/hooks/useOutreachWriter";
import { optionsSummary, parseOptions, WRITABLE_KINDS, type WriteOptions } from "@/lib/outreach/aiWriter";
import { CHANNEL_LIMITS, type OutreachChannel } from "@/lib/outreach/channels";
import { copyText } from "@/lib/outreach/labels";
import { groupNumber } from "@/lib/advertising/slug";
import { cn } from "@/lib/utils";
import { useAutosave } from "./useAutosave";
import { WriterOptionsPanel } from "./WriterOptionsPanel";
import { WriterTabs, type BadgeKind } from "./WriterTabs";
import { Card, DButton } from "./ui";

const SHARED = "chung";
const pad = (n: number) => String(n).padStart(2, "0");
const hm = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Busy() {
  return (
    <div className="px-[22px] pb-5 pt-[18px]">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-[hsl(var(--tier-info))]">
        <i className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[hsl(var(--tier-info-bg))] border-t-[hsl(var(--tier-info))]" />
        AI đang viết từ hồ sơ…
      </div>
      <div className="flex flex-col gap-2.5 rounded-[10px] p-4 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        {["100%", "100%", "80%", "100%", "100%", "55%"].map((w, i) => (
          <i key={i} className="h-3 animate-pulse rounded-md bg-muted" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Tab Tiếp thị bản MVP (design pdg-mvp3.js): chọn tuỳ chọn → AI viết MỘT bài chung
 * cho mọi tài sản; mỗi kênh dùng bài chung hoặc viết riêng. Sao chép để tự đăng.
 */
export function OutreachWriter({ ws }: { ws: OutreachWorkspace }) {
  const ctx = useWriterContext(ws);
  const savePost = useSavePost(ws.session.id);
  const updateChannel = useUpdateChannel(ws.session.id);
  const autosave = useAutosave();
  const ro = !ws.canEdit;
  const pack = ws.pack!;
  const channels = ws.channels.filter((c) => WRITABLE_KINDS.includes(c.kind));
  const sharedOpts = parseOptions(pack.post_options);

  const [sel, setSel] = useState(SHARED);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ open: boolean; target: string; draft: WriteOptions }>({
    open: !pack.post_text,
    target: SHARED,
    draft: sharedOpts,
  });
  // Bản đang gõ (tự lưu); đổi tab / server trả bản mới ⇒ đồng bộ lại.
  const [local, setLocal] = useState<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);

  const channel = channels.find((c) => c.id === sel) ?? null;
  const key = channel ? channel.id : SHARED;
  const sharedText = local[SHARED] ?? pack.post_text;
  const textOf = (c: OutreachChannel | null) => (c ? (c.own_content ? (local[c.id] ?? c.custom_body) : sharedText) : sharedText);
  const text = textOf(channel);
  const isBusy = busy.has(key) || (!!channel && busy.has(SHARED));
  const lim = channel ? CHANNEL_LIMITS[channel.kind] : undefined;
  const hasShared = !!sharedText.trim();

  useEffect(() => {
    if (sel !== SHARED && !channel) setSel(SHARED);
  }, [sel, channel]);

  // Chưa có bài chung ⇒ luôn mở bảng tuỳ chọn, viết cho tab đang chọn (design outreachTab).
  const target = hasShared ? panel.target : key;
  const showPanel = !ro && !isBusy && (panel.open || !hasShared) && target === key;

  useLayoutEffect(() => {
    const t = taRef.current;
    if (t) {
      t.style.height = "auto";
      t.style.height = `${t.scrollHeight + 4}px`;
    }
  }, [text, sel, showPanel, isBusy]);

  const mark = (k: string, on: boolean) =>
    setBusy((b) => {
      const n = new Set(b);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  const select = (k: string) => {
    autosave.flush();
    setSel(k);
    if (panel.open && hasShared) setPanel((p) => ({ ...p, open: false }));
    if (!hasShared) setPanel({ open: true, target: k, draft: sharedOpts });
  };

  const openPanel = (target: string) => {
    const c = channels.find((x) => x.id === target);
    setPanel({ open: true, target, draft: c?.post_options ? parseOptions(c.post_options) : sharedOpts });
  };

  const writeShared = async (o: WriteOptions) => {
    mark(SHARED, true);
    try {
      const t = await writePost(ctx, null, o);
      await savePost.mutateAsync({ packId: pack.id, text: t, options: o, generated: true });
      setLocal((l) => ({ ...l, [SHARED]: t }));
    } finally {
      mark(SHARED, false);
    }
  };

  const run = async () => {
    const { draft } = panel;
    setPanel((p) => ({ ...p, open: false }));
    if (target === SHARED) return writeShared(draft);
    const c = channels.find((x) => x.id === target);
    if (!c) return;
    if (!hasShared) await writeShared(draft);
    mark(c.id, true);
    try {
      const t = await writePost(ctx, c.kind, draft);
      await updateChannel.mutateAsync({ channelId: c.id, patch: { own_content: true, custom_body: t, post_options: draft } });
      setLocal((l) => ({ ...l, [c.id]: t }));
    } finally {
      mark(c.id, false);
    }
  };

  const resetChannel = (c: OutreachChannel) => {
    setLocal((l) => {
      const n = { ...l };
      delete n[c.id];
      return n;
    });
    updateChannel.mutate({ channelId: c.id, patch: { own_content: false, custom_body: "", post_options: null } });
  };

  const edit = (v: string) => {
    setLocal((l) => ({ ...l, [key]: v }));
    if (channel) autosave.schedule(() => updateChannel.mutateAsync({ channelId: channel.id, patch: { custom_body: v } }));
    else autosave.schedule(() => savePost.mutateAsync({ packId: pack.id, text: v }));
  };

  const copy = async () => {
    if (await copyText(text)) toast.success("Đã sao chép nội dung");
    else toast.error("Trình duyệt chặn sao chép — hãy chọn nội dung và sao chép thủ công.");
  };

  const sharedBadge: [BadgeKind, string] = busy.has(SHARED) ? ["busy", "Đang viết"] : hasShared ? ["ok", "Đã viết"] : ["none", "Chưa có"];
  const channelBadge = (c: OutreachChannel): [BadgeKind, string] =>
    busy.has(c.id) ? ["busy", "Đang viết"] : c.own_content ? ["own", "Bài riêng"] : hasShared ? ["shared", "Theo bài chung"] : ["none", "Chưa có"];

  const own = !!channel?.own_content;
  const optSummary = optionsSummary(channel?.post_options ? parseOptions(channel.post_options) : sharedOpts);
  const info = channel
    ? own
      ? `Bài viết riêng · ${optSummary}`
      : "Đang dùng bài chung"
    : pack.post_edited
      ? "Đã chỉnh sửa"
      : pack.post_written_at
        ? `AI viết lúc ${hm(pack.post_written_at)} · ${optSummary}`
        : "";

  const actions =
    ro || !hasShared ? null : channel ? (
      own ? (
        <>
          <DButton variant="ghost" onClick={() => resetChannel(channel)}>
            Dùng lại bài chung
          </DButton>
          <DButton onClick={() => openPanel(channel.id)}>
            <Sparkles />
            Viết lại
          </DButton>
        </>
      ) : (
        <DButton onClick={() => openPanel(channel.id)}>
          <Sparkles />
          Viết riêng cho {channel.name}
        </DButton>
      )
    ) : (
      <DButton onClick={() => openPanel(SHARED)}>
        <Sparkles />
        Viết lại
      </DButton>
    );

  const panelChannel = channels.find((c) => c.id === target);
  const panelHas = panelChannel ? panelChannel.own_content : hasShared;

  return (
    <>
      <WriterTabs channels={channels} sel={key} onSelect={select} sharedBadge={sharedBadge} channelBadge={channelBadge} />
      <Card>
        {showPanel && (
          <WriterOptionsPanel
            title={panelChannel ? `Tuỳ chọn cho ${panelChannel.name}` : "Tuỳ chọn bài viết"}
            draft={panel.draft}
            onChange={(draft) => setPanel((p) => ({ ...p, draft }))}
            onRun={() => void run()}
            onCancel={hasShared ? () => setPanel((p) => ({ ...p, open: false })) : undefined}
            rewrite={panelHas}
          />
        )}
        {isBusy ? (
          <Busy />
        ) : !hasShared ? (
          !showPanel && <div className="px-[22px] py-7 text-center text-[13.5px] text-muted-foreground">Chưa có bài viết.</div>
        ) : (
          !showPanel && (
            <div className="px-[22px] pb-5 pt-[18px]">
              <div className="mb-2 flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
                <span>{info}</span>
                <span className="flex-1" />
                <span className={cn("text-xs tabular-nums", lim && text.length > lim ? "text-destructive" : "text-muted-foreground")}>
                  {text.length}
                  {lim ? ` / ${groupNumber(lim)}` : ""} ký tự
                </span>
              </div>
              <textarea
                ref={taRef}
                value={text}
                readOnly={ro || (!!channel && !own)}
                onChange={(e) => edit(e.target.value)}
                className="min-h-[200px] w-full resize-y rounded-lg border-0 bg-card px-3.5 py-3 text-[13.5px] leading-[1.6] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] outline-none focus:shadow-[inset_0_0_0_1px_hsl(var(--primary)),0_0_0_3px_hsl(var(--primary)/0.1)] read-only:bg-muted/40"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="flex-1" />
                {actions}
                <DButton variant="primary" onClick={() => void copy()}>
                  Sao chép
                </DButton>
              </div>
            </div>
          )
        )}
      </Card>
    </>
  );
}
