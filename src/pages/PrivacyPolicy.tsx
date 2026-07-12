import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useActiveLegalDoc } from "@/hooks/useLegalDocuments";
import { LegalArticleView } from "@/components/legal/LegalArticleView";
import { formatDate } from "@/lib/dateUtils";

const PrivacyPolicy = () => {
  const { data: doc, isLoading } = useActiveLegalDoc("privacy");
  const lastUpdated = doc?.effective_date ? formatDate(doc.effective_date) : "17/05/2026";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page header */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-14 md:py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Chính sách bảo mật</h1>
          <p className="text-background/60 text-sm md:text-base">
            Cập nhật lần cuối: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container px-4 py-10 md:py-16 flex-1">
        <div className="max-w-4xl mx-auto">
          <LegalArticleView content={doc?.content} isLoading={isLoading} />
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
