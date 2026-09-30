import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Glasses, MapPinned, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CraftVillageMap } from "@/components/craft-villages/CraftVillageMap";
import { CraftVillageList } from "@/components/craft-villages/CraftVillageList";
import { CraftVillageDialog } from "@/components/craft-villages/CraftVillageDialog";
import { usePublicCraftVillages } from "@/hooks/useCraftVillages";
import { matchesVillage, type PublicCraftVillage } from "@/lib/craftVillages";

/** /lang-nghe — bản đồ các hồ sơ làng nghề được chủ tài sản công khai (đã duyệt). `?ho-so=<id>` mở thẳng VR. */
export default function CraftVillagesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: villages = [], isLoading, isError } = usePublicCraftVillages();
  const [query, setQuery] = useState("");

  const openId = params.get("ho-so");
  const open = useMemo(() => villages.find((v) => v.posting_id === openId) ?? null, [villages, openId]);
  const filtered = useMemo(() => villages.filter((v) => matchesVillage(v, query)), [villages, query]);
  const withVr = useMemo(() => villages.filter((v) => v.vr_url).length, [villages]);

  const select = (v: PublicCraftVillage) => {
    const next = new URLSearchParams(params);
    next.set("ho-so", v.posting_id);
    setParams(next, { replace: true });
  };
  const close = (isOpen: boolean) => {
    if (isOpen) return;
    const next = new URLSearchParams(params);
    next.delete("ho-so");
    setParams(next, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
          <div className="container px-4 py-10 text-center">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <MapPinned className="h-4 w-4" /> Bản đồ làng nghề
            </p>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Khám phá làng nghề Việt Nam</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Hồ sơ số hoá do chính các làng nghề công khai. Bấm vào ảnh sản phẩm trên bản đồ để tham quan
              làng bằng VR tour 360°.
            </p>
            {!isLoading && villages.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{villages.length}</span> làng nghề ·{" "}
                <span className="inline-flex items-center gap-1">
                  <Glasses className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{withVr}</span> có VR tour
                </span>
              </p>
            )}
          </div>
        </section>

        <div className="container px-4 py-8">
          {isError ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Không tải được bản đồ làng nghề. Vui lòng thử lại sau.
            </p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <CraftVillageMap
                villages={filtered}
                selectedId={openId}
                onSelect={select}
                className="h-[420px] md:h-[560px]"
              />
              <aside className="flex min-h-0 flex-col gap-3 rounded-2xl bg-card p-3 shadow-card lg:h-[560px]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm làng, sản phẩm, tỉnh…"
                    className="pl-8"
                    aria-label="Tìm làng nghề"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {isLoading ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                    </div>
                  ) : villages.length === 0 ? (
                    <div className="space-y-3 px-2 py-8 text-center text-sm text-muted-foreground">
                      <p>Chưa có làng nghề nào công khai hồ sơ.</p>
                    </div>
                  ) : (
                    <CraftVillageList villages={filtered} selectedId={openId} onSelect={select} />
                  )}
                </div>
              </aside>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="font-semibold text-foreground">Bạn đại diện một làng nghề?</p>
              <p className="text-sm text-muted-foreground">
                Đăng ký chủ tài sản loại “Làng nghề”, số hoá sản phẩm, đặt VR tour và công khai lên bản đồ.
              </p>
            </div>
            <Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Đăng ký làng nghề</Button>
          </div>
        </div>
      </main>
      <Footer />
      <CraftVillageDialog village={open} onOpenChange={close} />
    </div>
  );
}
