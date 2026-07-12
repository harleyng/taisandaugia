import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLegalDocuments } from "@/hooks/useLegalDocuments";
import { LegalDocSection } from "@/components/admin/legal/LegalDocSection";
import { LEGAL_DOC_LABELS, type LegalDocType, type LegalDocument } from "@/types/legal";

const DOC_TYPES: LegalDocType[] = ["terms", "privacy"];

export default function AdminLegalDocsPage() {
  const navigate = useNavigate();
  const { data: docs, isLoading } = useLegalDocuments();

  const byType = useMemo(() => {
    const map: Record<LegalDocType, LegalDocument[]> = { terms: [], privacy: [] };
    (docs ?? []).forEach((d) => {
      if (d.doc_type === "terms" || d.doc_type === "privacy") map[d.doc_type].push(d);
    });
    return map;
  }, [docs]);

  const goCreate = (docType: LegalDocType) => navigate(`/admin/phap-ly/tao?type=${docType}`);
  const goView = (v: LegalDocument) => navigate(`/admin/phap-ly/${v.id}`);
  const goClone = (v: LegalDocument) =>
    navigate(`/admin/phap-ly/tao?type=${v.doc_type}&from=${v.id}`);

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-xl font-bold text-foreground">Văn bản pháp lý</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Quản lý phiên bản, ngày hiệu lực &amp; nội dung của Điều khoản sử dụng và Chính sách bảo mật.
        </p>
      </div>

      <Tabs defaultValue="terms" className="w-full">
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
              docType={docType}
              versions={byType[docType]}
              isLoading={isLoading}
              onCreate={() => goCreate(docType)}
              onView={goView}
              onClone={goClone}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
