import { useState } from "react";
import { UserPlus, Users, Filter, ListChecks, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CriteriaBuilder } from "../audience/CriteriaBuilder";
import { AddRecipientsDialog } from "../audience/AddRecipientsDialog";
import { AudienceSummary } from "../audience/AudienceSummary";
import {
  SelectedRecipientsTable,
  type RecipientItem,
} from "../audience/SelectedRecipientsTable";
import { DEFAULT_CRITERIA, modesForKind } from "@/lib/marketing/audienceCriteria";
import { useUserLabels, type UserLabel } from "@/hooks/useUserLabels";
import { useEmailAccountStatus } from "@/hooks/useEmailAccountStatus";
import type {
  AudienceCriteria,
  AudienceKind,
  AudienceSpec,
} from "@/types/marketing";

interface Props {
  spec: AudienceSpec;
  onChange: (spec: AudienceSpec) => void;
  count?: number;
  isFetching: boolean;
  isError: boolean;
}

const TYPE_OPTIONS: {
  kind: Exclude<AudienceKind, "none">;
  title: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    kind: "all",
    title: "Tất cả",
    description: "Gửi tới tất cả người dùng",
    icon: Users,
  },
  {
    kind: "criteria",
    title: "Theo tiêu chí",
    description: "Gửi tới nhóm người dùng theo tiêu chí tuỳ chọn",
    icon: Filter,
  },
  {
    kind: "list",
    title: "Danh sách cụ thể",
    description: "Gửi tới người dùng cụ thể",
    icon: ListChecks,
  },
];

function TypeCard({
  title,
  description,
  icon: Icon,
  active,
  onSelect,
}: {
  title: string;
  description: string;
  icon: typeof Users;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}

export function AudienceSection({ spec, onChange, count, isFetching, isError }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { labels, seed } = useUserLabels(spec.userIds);
  // Email import khớp tài khoản hay không — để gắn badge "Chưa có tài khoản".
  const emailAccount = useEmailAccountStatus(spec.emails);

  const selectKind = (kind: Exclude<AudienceKind, "none">) => {
    if (kind === spec.kind) return;
    if (kind === "all") {
      // "Tất cả" cần tiêu chí rỗng để RPC khớp toàn bộ; dọn sạch dữ liệu loại khác.
      onChange({
        ...spec,
        kind,
        modes: modesForKind(kind),
        criteria: DEFAULT_CRITERIA,
        userIds: [],
        emails: [],
      });
      return;
    }
    onChange({ ...spec, kind, modes: modesForKind(kind) });
  };

  const setCriteria = (criteria: AudienceCriteria) => onChange({ ...spec, criteria });

  const addUser = (u: UserLabel) => {
    seed(u);
    if (!spec.userIds.includes(u.id)) onChange({ ...spec, userIds: [...spec.userIds, u.id] });
  };

  // Gộp "chọn thủ công" + "import" thành 1 danh sách; ẩn email import trùng với
  // email của user đã chọn thủ công (khi đã nạp được nhãn).
  const manualEmails = new Set(
    spec.userIds
      .map((id) => labels[id]?.email?.toLowerCase())
      .filter(Boolean) as string[],
  );

  // Email đã có trong danh sách (user + import) — để phát hiện trùng khi import.
  const existingEmails = Array.from(
    new Set([...manualEmails, ...spec.emails.map((e) => e.toLowerCase())]),
  );

  const addEmails = (incoming: string[]) => {
    const lower = incoming.map((e) => e.toLowerCase());
    const existing = new Set(existingEmails);
    const fresh = lower.filter((e) => !existing.has(e));
    onChange({ ...spec, emails: Array.from(new Set([...spec.emails, ...lower])) });
    setToast(`Đã thêm ${fresh.length.toLocaleString("vi-VN")} email từ file`);
    window.setTimeout(() => setToast(null), 3000);
  };
  const items: RecipientItem[] = [
    ...spec.userIds.map((id) => ({
      key: `u:${id}`,
      primary: labels[id]?.email ?? `${id.slice(0, 8)}…`,
      secondary: labels[id]?.name ?? null,
    })),
    ...spec.emails
      .filter((e) => !manualEmails.has(e.toLowerCase()))
      .map((e) => ({
        key: `e:${e}`,
        primary: e,
        secondary: null as string | null,
        // undefined khi chưa tra xong → chưa gắn badge (tránh nhầm lúc đang tải).
        noAccount: emailAccount[e.toLowerCase()] === false,
      })),
  ];

  const removeByKey = (key: string) => {
    if (key.startsWith("u:")) {
      const id = key.slice(2);
      onChange({ ...spec, userIds: spec.userIds.filter((x) => x !== id) });
    } else {
      const email = key.slice(2);
      onChange({ ...spec, emails: spec.emails.filter((x) => x !== email) });
    }
  };

  const clearAll = () => onChange({ ...spec, userIds: [], emails: [] });

  return (
    <div className="space-y-3">
      {/* Chọn 1 trong 3 loại đối tượng */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TYPE_OPTIONS.map((opt) => (
          <TypeCard
            key={opt.kind}
            title={opt.title}
            description={opt.description}
            icon={opt.icon}
            active={spec.kind === opt.kind}
            onSelect={() => selectKind(opt.kind)}
          />
        ))}
      </div>

      {spec.kind === "all" && (
        <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Gửi tới tất cả người dùng đã cho phép gửi email.
        </p>
      )}

      {spec.kind === "criteria" && (
        <>
          <CriteriaBuilder criteria={spec.criteria} onChange={setCriteria} />
          <AudienceSummary spec={spec} count={count} isFetching={isFetching} isError={isError} />
        </>
      )}

      {spec.kind === "list" && (
        <div className="space-y-3 rounded-xl border border-border p-3.5">
          {/* Header gộp: chỉ đếm số + nút thêm (không lặp tiêu đề "Người nhận"). */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {items.length.toLocaleString("vi-VN")} người nhận
              </p>
              {isError && (
                <p className="text-xs text-destructive">Không kiểm tra được số thực nhận</p>
              )}
            </div>
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Thêm người nhận
            </Button>
          </div>

          {toast && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {toast}
            </div>
          )}

          <SelectedRecipientsTable items={items} onRemove={removeByKey} onClearAll={clearAll} />
        </div>
      )}

      <AddRecipientsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        selectedIds={spec.userIds}
        existingEmails={existingEmails}
        onAddUser={addUser}
        onAddEmails={addEmails}
      />
    </div>
  );
}
