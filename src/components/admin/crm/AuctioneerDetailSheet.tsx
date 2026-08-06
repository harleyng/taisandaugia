import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { Auctioneer } from "@/types/auctioneer";
import {
  CONTRACT_TYPE_LABELS, POSITION_LABELS, computePracticeYears, computeDaysUntilExpiry,
} from "@/types/auctioneer";
import type { CpdExemption, DossierEvent } from "@/types/personnel";
import {
  EVENT_TYPE_LABELS,
} from "@/types/personnel";
import { evaluatePerson, selectableYears } from "@/lib/personnel/cpd";
import { creditedHoursOf, formLabel } from "@/lib/personnel/cpd-catalog";
import { useCpdCatalog } from "@/hooks/useCpdCatalog";
import { CpdProofBadge, CpdStatusBadge } from "@/components/cpd/CpdStatusBadge";

interface Props {
  person: Auctioneer | null;
  events: DossierEvent[];
  exemptions: CpdExemption[];
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString("vi-VN") : "—");

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

/**
 * CHỈ ĐỌC — admin không sửa hồ sơ của tổ chức.
 *
 * CỐ Ý KHÔNG hiện số CCCD/hộ chiếu, ngày và nơi cấp, dù policy `*_admin_all` cho
 * đọc: màn CRM không có nhu cầu nghiệp vụ với dữ liệu định danh, và che ở tầng
 * UI rẻ hơn nhiều so với sửa policy. File đính kèm cũng không hiện — bucket
 * personnel-docs gate bằng can_manage_org_auctioneers (không có nhánh ADMIN)
 * nên admin không mint được signed URL.
 */
export default function AuctioneerDetailSheet({
  person, events, exemptions, onOpenChange,
}: Props) {
  // Hook phải đứng TRƯỚC early-return bên dưới — rules-of-hooks.
  const { index, resolve } = useCpdCatalog();
  const labelOf = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? index.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? index.roleById.get(e.cpdActivityRoleId) : undefined,
  );

  if (!person) return null;

  const work = events.filter((e) => e.eventType === "WORK");
  const rewards = events.filter((e) => e.eventType === "REWARD" || e.eventType === "DISCIPLINE");
  const daysLeft = computeDaysUntilExpiry(person.licenseExpiryDate);

  // Lịch sử bồi dưỡng theo TỪNG NĂM, không chỉ năm hiện tại — admin tra cứu là
  // để xem quá trình, không phải chỉ trạng thái hôm nay.
  const years = selectableYears().filter((y) => {
    const ev = evaluatePerson(person.id, events, y, resolve);
    return ev.records.length > 0 || exemptions.some((x) => x.year === y) || y === new Date().getFullYear();
  });

  return (
    <Sheet open={!!person} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{person.fullName}</SheetTitle>
          <SheetDescription className="text-xs">
            {[
              POSITION_LABELS[person.position],
              CONTRACT_TYPE_LABELS[person.contractType],
              person.isActive ? "Đang hành nghề" : "Đã nghỉ",
            ].join(" · ")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pt-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Hành nghề
            </h3>
            <Row label="Số thẻ đấu giá viên" value={person.licenseNumber || "—"} />
            <Row label="Ngày cấp thẻ" value={fmtDate(person.licenseIssuedDate)} />
            <Row
              label="Ngày hết hạn thẻ"
              value={
                person.licenseExpiryDate
                  ? `${fmtDate(person.licenseExpiryDate)}${
                      daysLeft !== undefined && daysLeft < 60
                        ? daysLeft < 0 ? " (đã hết hạn)" : ` (còn ${daysLeft} ngày)`
                        : ""
                    }`
                  : "Không thời hạn"
              }
            />
            <Row label="Số CCHN" value={person.professionalCertNumber || "—"} />
            <Row label="Ngày cấp CCHN" value={fmtDate(person.professionalCertIssuedDate)} />
            <Row
              label="Bắt đầu hành nghề"
              value={fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)}
            />
            <Row label="Số năm hành nghề" value={`${computePracticeYears(person)} năm`} />
            <Row label="Công tác tại tổ chức từ" value={fmtDate(person.joinedDate)} />
            <Row label="Trình độ" value={person.educationLevel || "—"} />
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Bồi dưỡng chuyên môn theo năm
            </h3>
            <div className="space-y-3">
              {years.map((y) => {
                const x = exemptions.find((e) => e.year === y);
                const ev = evaluatePerson(
                  person.id, events, y, resolve,
                  x ? { reasonName: index.reasonById.get(x.reasonId)?.name } : undefined,
                  labelOf,
                );
                return (
                  <div key={y} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">Năm {y}</span>
                      <CpdStatusBadge ev={ev} />
                      <CpdProofBadge ev={ev} />
                      {!ev.isExempt && !ev.hasFullYearForm && (
                        <span className="text-xs text-muted-foreground">
                          {ev.hours}/{ev.required} giờ
                        </span>
                      )}
                    </div>
                    {x && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Được miễn — {index.reasonById.get(x.reasonId)?.name ?? "không rõ lý do"}
                        {x.filedAt ? ` · nộp Sở Tư pháp ${fmtDate(x.filedAt)}` : ""}
                      </p>
                    )}
                    {ev.records.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ev.records.map((r) => (
                          <li key={r.id} className="text-xs text-muted-foreground">
                            · {labelOf(r) ? `[${labelOf(r)}] ` : ""}
                            {r.title}
                            {r.organizationName ? ` — ${r.organizationName}` : ""}
                            {(() => {
                              const rule = resolve(r);
                              return rule?.mode === "HOURS"
                                ? ` (${creditedHoursOf(r, rule)} giờ)`
                                : "";
                            })()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Quá trình công tác
            </h3>
            {work.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa khai báo.</p>
            ) : (
              <ul className="space-y-2">
                {work.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium">{e.organizationName || e.title}</span>
                    {e.isStateAuctionCenter && (
                      <Badge variant="secondary" className="ml-2 text-xs font-normal">
                        Trung tâm DVĐG
                      </Badge>
                    )}
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {fmtDate(e.startedOn)} – {e.endedOn ? fmtDate(e.endedOn) : "nay"}
                      {e.role ? ` · ${e.role}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {rewards.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Khen thưởng / Kỷ luật
              </h3>
              <ul className="space-y-2">
                {rewards.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium">{e.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {EVENT_TYPE_LABELS[e.eventType]} · {fmtDate(e.startedOn)}
                      {e.organizationName ? ` · ${e.organizationName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
