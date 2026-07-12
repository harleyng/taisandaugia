import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useActiveLegalDoc } from "@/hooks/useLegalDocuments";
import { LegalArticleView } from "@/components/legal/LegalArticleView";
import { formatDate } from "@/lib/dateUtils";

const TermsOfUse = () => {
  const { data: doc, isLoading } = useActiveLegalDoc("terms");
  const lastUpdated = doc?.effective_date ? formatDate(doc.effective_date) : "17/05/2026";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-foreground text-background">
        <div className="container px-4 py-14 md:py-20 text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            Điều khoản sử dụng
          </h1>
          <p className="text-background/60 text-sm md:text-base leading-relaxed">
            Vui lòng đọc kỹ các điều khoản dưới đây trước khi sử dụng nền tảng TàiSảnĐấuGiá.
          </p>
          <p className="text-background/40 text-xs mt-4">Cập nhật lần cuối: {lastUpdated}</p>
        </div>
      </section>

      <div className="container px-4 py-12 md:py-16 max-w-4xl mx-auto">
        <LegalArticleView content={doc?.content} isLoading={isLoading} />
      </div>

      <Footer />
    </div>
  );
};

export default TermsOfUse;
