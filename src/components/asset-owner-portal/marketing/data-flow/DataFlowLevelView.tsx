import { CheckCircle2, Database, LogIn, Phone, Scale, ShieldOff, Workflow, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import type { OwnerTone } from "@/components/asset-owner-portal/ui/IconTile";
import { HOTLINES } from "@/constants/hotlines";
import { BRAND } from "@/lib/brand";
import type { DataFlowLevel } from "@/lib/ownerMarketing/dataFlow";
import { DataFlowDiagram } from "./DataFlowDiagram";

function FactList({ items, icon: Icon, iconClass }: { items: string[]; icon: LucideIcon; iconClass: string }) {
  return (
    <ul className="space-y-2.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-sm leading-relaxed text-foreground">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} strokeWidth={1.75} aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function FactCard(props: { title: string; icon: LucideIcon; tone: OwnerTone; items: string[]; itemIcon: LucideIcon; itemClass: string }) {
  return (
    <SectionCard title={props.title} icon={props.icon} tone={props.tone}>
      <FactList items={props.items} icon={props.itemIcon} iconClass={props.itemClass} />
    </SectionCard>
  );
}

/** Nội dung một mức triển khai: sơ đồ + vào sàn / không bao giờ vào / lưu ở đâu (+ điều kiện). */
export function DataFlowLevelView({ level }: { level: DataFlowLevel }) {
  return (
    <div className="space-y-5">
      <SectionCard title={`${level.code} · ${level.short}`} icon={Workflow}>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{level.name}</p>
            <Badge variant={level.available ? "secondary" : "outline"}>{level.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Phù hợp: </span>
            {level.fit}
          </p>
        </div>
        <DataFlowDiagram level={level} />
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <FactCard
          title={`Đi vào ${BRAND.platformName}`}
          icon={LogIn}
          tone="primary"
          items={level.enters}
          itemIcon={CheckCircle2}
          itemClass="text-primary"
        />
        <FactCard
          title="Không bao giờ vào sàn"
          icon={ShieldOff}
          tone="success"
          items={level.never}
          itemIcon={XCircle}
          itemClass="text-success"
        />
        <FactCard
          title="Lưu ở đâu"
          icon={Database}
          tone="muted"
          items={level.storage}
          itemIcon={Database}
          itemClass="text-muted-foreground"
        />
      </div>

      {level.conditions && (
        <FactCard
          title="Điều kiện trước khi mở"
          icon={Scale}
          tone="warning"
          items={level.conditions}
          itemIcon={Scale}
          itemClass="text-warning"
        />
      )}

      <SectionCard title="Cần bản nhãn trắng?" icon={Phone} tone="muted">
        <p className="text-sm text-muted-foreground">
          Bản nhãn trắng (mức L2) được triển khai theo dự án cho từng ngân hàng. Liên hệ đội {BRAND.platformName} để
          trao đổi yêu cầu an toàn thông tin và phương án triển khai.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
          {HOTLINES.map((h) => (
            <a key={h.tel} href={`tel:${h.tel}`} className="text-primary hover:underline">
              {h.label}
            </a>
          ))}
          <span className="text-muted-foreground">{BRAND.domain}</span>
        </div>
      </SectionCard>
    </div>
  );
}
