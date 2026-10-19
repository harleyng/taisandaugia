import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLegalDocuments } from "@/hooks/useLegalDocuments";
import { LegalDocSection } from "@/components/admin/legal/LegalDocSection";
import {
  adminLegalCreatePath,
  adminLegalListPath,
  parseLegalPlatform,
} from "@/components/admin/legal/legalAdminPaths";
import {
  LEGAL_DOC_LABELS,
  LEGAL_PLATFORM_LABELS,
  LEGAL_PLATFORMS,
  type LegalDocType,
  type LegalDocument,
  type LegalPlatform,
} from "@/types/legal";

const DOC_TYPES: LegalDocType[] = ["terms", "privacy"];

export default function AdminLegalDocsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const platform = parseLegalPlatform(params.get("platform"));
  const { data: docs, isLoading } = useLegalDocuments(platform);

  const byType = useMemo(() => {
    const map: Record<LegalDocType, LegalDocument[]> = { terms: [], privacy: [] };
    (docs ?? []).forEach((d) => {
      if (d.doc_type === "terms" || d.doc_type === "privacy") map[d.doc_type].push(d);
    });
    return map;
  }, [docs]);

  const goView = (v: LegalDocument) => navigate(`/admin/phap-ly/${v.id}`);
  const goClone = (v: LegalDocument) => navigate(adminLegalCreatePath(v.platform, v.doc_type, v.id));

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Văn bản pháp lý</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quản lý phiên bản, ngày hiệu lực &amp; nội dung của Điều khoản sử dụng và Chính sách bảo mật.
            Mỗi nền tảng có bộ văn bản và ghi nhận đồng ý riêng.
          </p>
        </div>
        <Tabs
          value={platform}
          onValueChange={(v) => navigate(adminLegalListPath(v as LegalPlatform), { replace: true })}
        >
          <TabsList>
            {LEGAL_PLATFORMS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {LEGAL_PLATFORM_LABELS[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs key={platform} defaultValue="terms" className="w-full">
        <TabsList>
          {DOC_TYPES.map((t) => (
            <TabsTrigger key={t} value={t}>
              {LEGAL_DOC_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        {DOC_TYPES.map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4">
            <LegalDocSection
              platform={platform}
              docType={docType}
              versions={byType[docType]}
              isLoading={isLoading}
              onCreate={() => navigate(adminLegalCreatePath(platform, docType))}
              onView={goView}
              onClone={goClone}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
