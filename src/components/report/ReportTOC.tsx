import { useEffect, useState } from "react";
import { ChevronRight, FileText, Mail, Download, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { tocSections } from "@/lib/mockMarketReport";

export const ReportTOC = () => {
  const [activeId, setActiveId] = useState<string>(tocSections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: 0,
      },
    );

    tocSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <aside className="sticky top-20 self-start hidden lg:block">
      <nav className="space-y-6">
        {/* Mục lục */}
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            Mục lục
          </h3>
          <ul className="space-y-1">
            {tocSections.map((s) => {
              const isActive = activeId === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={handleClick(s.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors border-l-2",
                      isActive
                        ? "text-primary font-semibold border-l-primary bg-primary/5"
                        : "text-muted-foreground border-l-transparent hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-border pt-4 space-y-1">
          <a
            href="#methodology"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Phương pháp
          </a>
          <a
            href="#subscribe"
            onClick={handleClick("subscribe")}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Đăng ký báo cáo
          </a>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Tải PDF tổng
          </button>
        </div>
      </nav>
    </aside>
  );
};
