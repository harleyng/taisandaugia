import { Gavel } from "lucide-react";
import type { OrgMatchResult } from "@/lib/orgMatching";
import { Group } from "../fields";
import type { WizardValues } from "../wizardSchema";
import { AuctionOrgGroup } from "./AuctionOrgGroup";

interface AuctionSourceGroupProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  orgResults: OrgMatchResult[];
  orgLoading: boolean;
}

/**
 * Bước 4 — Tổ chức đấu giá (chỉ khi muốn đấu giá): CHỈ chọn tổ chức qua sàn (tự chọn · nhờ sàn ·
 * để sau). Đấu giá không có lựa chọn "Đối tác riêng" như Pháp lý / Thẩm định — người dùng chốt 04/10.
 */
export function AuctionSourceGroup({ f, up, orgResults, orgLoading }: AuctionSourceGroupProps) {
  return (
    <Group icon={<Gavel className="h-4 w-4" />} title="Tổ chức đấu giá">
      <AuctionOrgGroup f={f} up={up} orgResults={orgResults} orgLoading={orgLoading} />
    </Group>
  );
}
