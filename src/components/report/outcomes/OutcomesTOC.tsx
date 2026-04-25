import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { outcomesTocSections } from "@/lib/mockOutcomesReport";

export const OutcomesTOC = () => {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string>(outcomesTocSections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    outcomesTocSections.forEach((s) => {
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

  const soon = (title: string) =>
    toast({ title, description: "Tính năng sẽ sớm có trong bản cập nhật tới." });

  return (
    <aside className="sticky top-20 self-start hidden lg:block">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        <BookOpen className="h-3.5 w-3.5" />
        Nội dung báo cáo
      </h3>
      <ul className="space-y-1">
        {outcomesTocSections.map((s) => {
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

      <div className="mt-6 pt-4 border-t border-border space-y-1">
        <button
          type="button"
          onClick={() => soon("Đang chuẩn bị PDF")}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Tải PDF section này
        </button>
        <button
          type="button"
          onClick={() => soon("Yêu cầu CSV — gói Pro")}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Tải CSV (Pro)
        </button>
      </div>
    </aside>
  );
};
