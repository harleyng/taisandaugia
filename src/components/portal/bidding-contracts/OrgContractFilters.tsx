import { useState } from "react";
import { Search } from "lucide-react";
import { FilterDropdown, FilterOption } from "@/components/portal/auction-sessions/list/FilterDropdown";
import type { DepositFilter } from "@/lib/biddingContracts/contractDetail";
import { depositChoiceLabel, type OrgListFilters } from "@/lib/biddingContracts/orgContractList";
import type { ContractSessionRef } from "@/types/bidding-contract";

interface Props {
  values: OrgListFilters;
  sessions: ContractSessionRef[];
  deposits: DepositFilter[];
  onChange: (patch: Partial<OrgListFilters>) => void;
}

const sessionLabel = (s: ContractSessionRef) => (s.code ? `${s.code} · ${s.title}` : s.title);

/** Hàng lọc của danh sách hồ sơ: tìm · phiên · tiền đặt trước (design `.lfb`). */
export function OrgContractFilters({ values, sessions, deposits, onChange }: Props) {
  const [open, setOpen] = useState<"session" | "deposit" | null>(null);
  const toggle = (key: "session" | "deposit") => (next: boolean) => setOpen(next ? key : null);
  const pick = (patch: Partial<OrgListFilters>) => {
    setOpen(null);
    onChange(patch);
  };
  const current = sessions.find((s) => s.id === values.sessionId);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3.5 sm:px-[22px]">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          aria-label="Tìm hồ sơ"
          placeholder="Tìm theo tên, mã hồ sơ, mã phiên"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          className="h-[34px] w-full rounded-lg border-0 bg-card pl-8 pr-2.5 text-[13px] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-primary"
        />
      </div>

      <FilterDropdown
        aria-label="Lọc theo phiên"
        label={current ? sessionLabel(current) : "Mọi phiên"}
        open={open === "session"}
        onOpenChange={toggle("session")}
        className="sm:max-w-[320px]"
      >
        <div className="flex max-h-[320px] flex-col overflow-y-auto">
          <FilterOption selected={!values.sessionId} onSelect={() => pick({ sessionId: "" })}>
            Mọi phiên
          </FilterOption>
          {sessions.map((s) => (
            <FilterOption key={s.id} selected={values.sessionId === s.id} onSelect={() => pick({ sessionId: s.id })}>
              <span className="block truncate">{sessionLabel(s)}</span>
            </FilterOption>
          ))}
        </div>
      </FilterDropdown>

      <FilterDropdown
        aria-label="Lọc theo tiền đặt trước"
        label={depositChoiceLabel(values.deposit)}
        open={open === "deposit"}
        onOpenChange={toggle("deposit")}
        className="sm:w-[230px]"
      >
        {(["all", ...deposits] as DepositFilter[]).map((k) => (
          <FilterOption key={k} selected={values.deposit === k} onSelect={() => pick({ deposit: k })}>
            {depositChoiceLabel(k)}
          </FilterOption>
        ))}
      </FilterDropdown>
    </div>
  );
}
