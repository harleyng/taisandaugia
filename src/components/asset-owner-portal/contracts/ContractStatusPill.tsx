import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CONTRACT_TONE_CLASS, type ContractTone } from "@/lib/contracts/rows";

/** Viên trạng thái có chấm màu — bảng và trang chi tiết menu "Hợp đồng". */
export function ContractStatusPill({ tone, children }: { tone: ContractTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        "before:h-1.5 before:w-1.5 before:rounded-full before:bg-current",
        CONTRACT_TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}
