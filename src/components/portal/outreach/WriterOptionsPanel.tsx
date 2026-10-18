import type { ReactNode } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import {
  AUD_OPTS,
  EXTRA_OPTS,
  HIGHLIGHT_OPTS,
  LEN_OPTS,
  TONE_OPTS,
  type WriteOptions,
} from "@/lib/outreach/aiWriter";
import { cn } from "@/lib/utils";
import { DButton } from "./ui";

function Group({ label, multi, children }: { label: string; multi?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <b className="text-[13px] font-semibold text-foreground">
        {label}
        {multi && <small className="ml-1.5 text-xs font-medium text-muted-foreground">chọn nhiều</small>}
      </b>
      {children}
    </div>
  );
}

function Select<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 w-full cursor-pointer appearance-none rounded-[10px] border-0 bg-card pl-3 pr-[34px] text-[13.5px] font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:shadow-[inset_0_0_0_1px_hsl(var(--muted-foreground))] focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-primary"
      >
        {options.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" strokeWidth={2.5} />
    </div>
  );
}

function Toggles<T extends string>({ value, options, onToggle }: { value: T[]; options: [T, string][]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([k, l]) => {
        const on = value.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onToggle(k)}
            className={cn(
              "inline-flex h-8 items-center gap-[5px] rounded-full px-3 text-[13px] font-semibold",
              on
                ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]"
                : "bg-card text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] hover:text-foreground",
            )}
          >
            {on && <Check className="h-[13px] w-[13px]" />}
            {l}
          </button>
        );
      })}
    </div>
  );
}

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** "Tuỳ chọn bài viết" + nút "Viết bằng AI" (design pdg-mvp3.js `m3Panel`). */
export function WriterOptionsPanel({
  title,
  draft,
  onChange,
  onRun,
  onCancel,
  rewrite,
}: {
  title: string;
  draft: WriteOptions;
  onChange: (o: WriteOptions) => void;
  onRun: () => void;
  /** Có bài rồi ⇒ cho huỷ để quay lại bài cũ. */
  onCancel?: () => void;
  rewrite: boolean;
}) {
  return (
    <>
      <div className="px-[22px] pb-1 pt-[18px]">
        <h3 className="text-[14.5px] font-semibold">{title}</h3>
        <p className="mt-[3px] text-[13px] text-muted-foreground">Chọn cách viết, AI dùng thông tin tài sản có sẵn trong hồ sơ phiên.</p>
      </div>
      <div className="flex flex-col gap-[18px] px-[22px] pb-5 pt-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-x-4 gap-y-3">
          <Group label="Giọng văn">
            <Select value={draft.tone} options={TONE_OPTS} onChange={(tone) => onChange({ ...draft, tone })} />
          </Group>
          <Group label="Độ dài">
            <Select value={draft.len} options={LEN_OPTS} onChange={(len) => onChange({ ...draft, len })} />
          </Group>
          <Group label="Đối tượng">
            <Select value={draft.aud} options={AUD_OPTS} onChange={(aud) => onChange({ ...draft, aud })} />
          </Group>
        </div>
        <Group label="Nhấn mạnh" multi>
          <Toggles value={draft.hl} options={HIGHLIGHT_OPTS} onToggle={(v) => onChange({ ...draft, hl: flip(draft.hl, v) })} />
        </Group>
        <Group label="Thêm vào bài" multi>
          <Toggles value={draft.x} options={EXTRA_OPTS} onToggle={(v) => onChange({ ...draft, x: flip(draft.x, v) })} />
        </Group>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5 px-[22px] pb-[26px] pt-1">
        <button
          type="button"
          onClick={onRun}
          className="inline-flex h-12 min-w-[260px] items-center justify-center gap-2.5 rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary)),color-mix(in_oklch,hsl(var(--primary))_70%,hsl(var(--tier-info))))] px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.15),0_6px_18px_-6px_hsl(var(--primary)/0.6)] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.15),0_10px_24px_-8px_hsl(var(--primary)/0.7)]"
        >
          <Sparkles className="h-[18px] w-[18px]" />
          {rewrite ? "Viết lại bằng AI" : "Viết bằng AI"}
        </button>
        {onCancel && (
          <DButton variant="ghost" className="order-2" onClick={onCancel}>
            Huỷ
          </DButton>
        )}
      </div>
    </>
  );
}
