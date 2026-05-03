import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Save,
  CheckCircle2,
  Coins,
  X,
  MapPin,
  Sparkles,
  BellRing,
  ArrowRight,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuctionListings } from "@/hooks/useAuctionListings";
import { countMatches } from "@/lib/demandMatch";
import {
  isIntentComplete,
  AgentInfoShape,
  IntentRegion,
  LegalCategoryKey,
  SessionStatusKey,
  DEFAULT_SESSION_STATUSES,
  REWARD_INTENT_CREDITS,
} from "@/lib/onboardingTasks";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { LEGAL_CATEGORIES, STATUS_OPTIONS } from "@/types/auction-filters.types";
import { notifyProfileUpdated, useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { RewardClaimDialog } from "@/components/onboarding/RewardClaimDialog";
import { cn } from "@/lib/utils";

const categoryNameOf = (slug: string): string => {
  for (const c of ASSET_CATEGORIES) {
    if (c.slug === slug) return c.name;
    const child = c.children.find((ch) => ch.slug === slug);
    if (child) return child.name;
  }
  return slug;
};

const legalLabelOf = (key: string) =>
  LEGAL_CATEGORIES.find((l) => l.value === key)?.label ?? key;
const statusLabelOf = (key: string) =>
  STATUS_OPTIONS.find((s) => s.value === key)?.label ?? key;

const fmtVnd = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("vi-VN").format(n);

const parseVnd = (v: string): number | null => {
  const cleaned = v.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const ProfileIntentSection = () => {
  const { agentInfo, tasks, refresh } = useOnboardingTasks();
  const { data: allListings } = useAuctionListings();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);

  const intent = agentInfo?.intent ?? {};
  const [mode, setMode] = useState<"view" | "edit">("view");

  const [categories, setCategories] = useState<string[]>(intent.asset_categories ?? []);
  const [regions, setRegions] = useState<IntentRegion[]>(intent.regions ?? []);
  const [mergedAddress, setMergedAddress] = useState<boolean>(intent.merged_address ?? false);
  const [priceMin, setPriceMin] = useState<string>(
    intent.price_min != null ? String(intent.price_min) : ""
  );
  const [priceMax, setPriceMax] = useState<string>(
    intent.price_max != null ? String(intent.price_max) : ""
  );
  const [depositMin, setDepositMin] = useState<string>(
    intent.deposit_min != null ? String(intent.deposit_min) : ""
  );
  const [depositMax, setDepositMax] = useState<string>(
    intent.deposit_max != null ? String(intent.deposit_max) : ""
  );
  const [legalCategories, setLegalCategories] = useState<LegalCategoryKey[]>(
    intent.legal_categories ?? []
  );
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatusKey[]>(
    intent.session_statuses ?? DEFAULT_SESSION_STATUSES
  );

  const [saving, setSaving] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [matchBanner, setMatchBanner] = useState<{ count: number } | null>(null);

  // UI helpers
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [expandedProv, setExpandedProv] = useState<string | null>(null);

  const resetFromSnapshot = () => {
    setCategories(intent.asset_categories ?? []);
    setRegions(intent.regions ?? []);
    setMergedAddress(intent.merged_address ?? false);
    setPriceMin(intent.price_min != null ? String(intent.price_min) : "");
    setPriceMax(intent.price_max != null ? String(intent.price_max) : "");
    setDepositMin(intent.deposit_min != null ? String(intent.deposit_min) : "");
    setDepositMax(intent.deposit_max != null ? String(intent.deposit_max) : "");
    setLegalCategories(intent.legal_categories ?? []);
    setSessionStatuses(intent.session_statuses ?? DEFAULT_SESSION_STATUSES);
  };

  useEffect(() => {
    resetFromSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentInfo]);

  useEffect(() => {
    if (window.location.hash === "#intent" && sectionRef.current) {
      setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  const intentTask = tasks.find((t) => t.key === "intent");
  const status = intentTask?.status ?? "todo";

  // Category toggles (parent or child)
  const toggleCategory = (slug: string) => {
    setCategories((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  // Region toggles
  const toggleProvince = (name: string) => {
    setRegions((prev) => {
      const exists = prev.find((r) => r.province === name);
      if (exists) return prev.filter((r) => r.province !== name);
      return [...prev, { province: name, districts: [] }];
    });
  };
  const toggleDistrict = (province: string, district: string) => {
    setRegions((prev) => {
      const exists = prev.find((r) => r.province === province);
      if (!exists) return [...prev, { province, districts: [district] }];
      return prev.map((r) => {
        if (r.province !== province) return r;
        const ds = r.districts ?? [];
        const next = ds.includes(district) ? ds.filter((d) => d !== district) : [...ds, district];
        return { ...r, districts: next };
      });
    });
  };

  const toggleLegal = (key: LegalCategoryKey) => {
    setLegalCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const toggleStatus = (key: SessionStatusKey) => {
    setSessionStatuses((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filledOk = categories.length > 0 && regions.length > 0;

  const handleCancel = () => {
    resetFromSnapshot();
    setMode("view");
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      toast.error("Bạn cần đăng nhập");
      return;
    }

    const nextIntent = {
      asset_categories: categories,
      regions,
      merged_address: mergedAddress,
      price_min: priceMin ? Number(priceMin) : null,
      price_max: priceMax ? Number(priceMax) : null,
      deposit_min: depositMin ? Number(depositMin) : null,
      deposit_max: depositMax ? Number(depositMax) : null,
      legal_categories: legalCategories,
      session_statuses: sessionStatuses,
    };

    const willBeComplete = isIntentComplete(nextIntent);

    const nextAgentInfo: AgentInfoShape = {
      ...(agentInfo ?? {}),
      intent: nextIntent,
      rewards: {
        ...(agentInfo?.rewards ?? {}),
        intent_completed_at: willBeComplete
          ? agentInfo?.rewards?.intent_completed_at ?? Date.now()
          : agentInfo?.rewards?.intent_completed_at ?? null,
      },
    };

    const { error } = await supabase
      .from("profiles")
      .update({ agent_info: nextAgentInfo as never })
      .eq("id", session.user.id);

    setSaving(false);

    if (error) {
      toast.error("Không thể lưu nhu cầu");
      return;
    }

    toast.success("Đã lưu nhu cầu");
    notifyProfileUpdated();
    await refresh();
    setMode("view");

    if (willBeComplete) {
      setTimeout(() => setShowClaim(true), 300);
    }

    if (allListings) {
      const matches = countMatches(allListings, nextIntent);
      setMatchBanner({ count: matches });
    } else {
      setMatchBanner(null);
    }
  };

  const renderBadge = () => {
    if (status === "claimed") {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Đã nhận thưởng
        </Badge>
      );
    }
    if (status === "ready") {
      return (
        <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
          <Coins className="h-3 w-3" /> +{REWARD_INTENT_CREDITS} chờ nhận
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Coins className="h-3 w-3" /> +{REWARD_INTENT_CREDITS} sau khi hoàn thành
      </Badge>
    );
  };

  const ViewField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );

  const empty = <span className="text-muted-foreground italic">Chưa cập nhật</span>;

  const savedCategories = intent.asset_categories ?? [];
  const savedRegions: IntentRegion[] = intent.regions ?? [];
  const savedLegal = intent.legal_categories ?? [];
  const savedStatuses = intent.session_statuses ?? [];

  const renderPriceRange = (min?: number | null, max?: number | null) => {
    if (min == null && max == null) return empty;
    const a = min != null ? `${fmtVnd(min)}đ` : "0đ";
    const b = max != null ? `${fmtVnd(max)}đ` : "Không giới hạn";
    return <>{a} – {b}</>;
  };

  return (
    <Card ref={sectionRef} id="intent" className="p-6 scroll-mt-24">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nhu cầu đấu giá</h2>
          <p className="text-xs text-muted-foreground mt-0.5">7 tiêu chí khớp 1-1 với bộ lọc tài sản đấu giá</p>
        </div>
        <div className="flex items-center gap-2">
          {renderBadge()}
          {mode === "view" && (
            <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
              <Pencil className="h-4 w-4" /> Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      {mode === "view" ? (
        <div className="space-y-5">
          <ViewField label="Loại tài sản quan tâm">
            {savedCategories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {savedCategories.map((slug) => (
                  <Badge key={slug} variant="secondary" className="font-normal">
                    {categoryNameOf(slug)}
                  </Badge>
                ))}
              </div>
            ) : empty}
          </ViewField>

          <ViewField label="Khu vực quan tâm">
            {savedRegions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {savedRegions.map((r) => (
                  <Badge key={r.province} variant="secondary" className="gap-1 font-normal">
                    <MapPin className="h-3 w-3" />
                    {r.province}
                    {r.districts && r.districts.length > 0 && (
                      <span className="text-muted-foreground">· {r.districts.length} Q/H</span>
                    )}
                  </Badge>
                ))}
              </div>
            ) : empty}
          </ViewField>

          <div className="grid gap-5 md:grid-cols-2">
            <ViewField label="Địa chỉ sau sáp nhập">
              {intent.merged_address ? "Bật" : "Tắt"}
            </ViewField>
            <ViewField label="Giá khởi điểm">
              {renderPriceRange(intent.price_min, intent.price_max)}
            </ViewField>
            <ViewField label="Tiền đặt trước">
              {renderPriceRange(intent.deposit_min, intent.deposit_max)}
            </ViewField>
            <ViewField label="Danh mục pháp lý">
              {savedLegal.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {savedLegal.map((k) => (
                    <Badge key={k} variant="secondary" className="font-normal">{legalLabelOf(k)}</Badge>
                  ))}
                </div>
              ) : empty}
            </ViewField>
            <ViewField label="Trạng thái phiên">
              {savedStatuses.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {savedStatuses.map((k) => (
                    <Badge key={k} variant="secondary" className="font-normal">{statusLabelOf(k)}</Badge>
                  ))}
                </div>
              ) : empty}
            </ViewField>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Loại tài sản 2 cấp */}
          <div>
            <Label className="mb-2 block">Loại tài sản quan tâm</Label>
            <div className="border rounded-md p-2 space-y-0.5 max-h-72 overflow-auto">
              {ASSET_CATEGORIES.map((cat) => {
                const isExpanded = expandedCat === cat.slug;
                const parentChecked = categories.includes(cat.slug);
                return (
                  <div key={cat.slug}>
                    <div className="flex items-center gap-2 px-1 py-1">
                      <Checkbox
                        id={`cat-${cat.slug}`}
                        checked={parentChecked}
                        onCheckedChange={() => toggleCategory(cat.slug)}
                      />
                      <Label htmlFor={`cat-${cat.slug}`} className="text-sm cursor-pointer flex-1 inline-flex items-center gap-1.5">
                        <cat.icon className="h-3.5 w-3.5" />
                        {cat.name}
                      </Label>
                      {cat.children.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedCat(isExpanded ? null : cat.slug)}
                          className="p-1 hover:bg-muted rounded"
                          aria-label="Mở rộng"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                    {isExpanded && cat.children.length > 0 && (
                      <div className="ml-7 space-y-0.5 pb-1">
                        {cat.children.map((child) => (
                          <div key={child.slug} className="flex items-center gap-2 px-1 py-0.5">
                            <Checkbox
                              id={`cat-${child.slug}`}
                              checked={categories.includes(child.slug)}
                              onCheckedChange={() => toggleCategory(child.slug)}
                            />
                            <Label htmlFor={`cat-${child.slug}`} className="text-sm cursor-pointer text-muted-foreground">
                              {child.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {categories.map((slug) => (
                  <Badge key={slug} variant="secondary" className="gap-1 font-normal">
                    {categoryNameOf(slug)}
                    <button
                      type="button"
                      onClick={() => toggleCategory(slug)}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 2. Khu vực 2 cấp */}
          <div>
            <Label className="mb-2 block">Khu vực quan tâm</Label>
            <div className="border rounded-md">
              <ScrollArea className="h-72">
                <div className="p-2 space-y-0.5">
                  {vietnamProvinces.map((p) => {
                    const isExpanded = expandedProv === p.name;
                    const selected = regions.find((r) => r.province === p.name);
                    return (
                      <div key={p.name}>
                        <div className="flex items-center gap-2 px-1 py-1">
                          <Checkbox
                            id={`prov-${p.name}`}
                            checked={!!selected}
                            onCheckedChange={() => toggleProvince(p.name)}
                          />
                          <Label htmlFor={`prov-${p.name}`} className="text-sm cursor-pointer flex-1">
                            {p.name}
                            {selected?.districts && selected.districts.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({selected.districts.length} Q/H)
                              </span>
                            )}
                          </Label>
                          {p.districts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedProv(isExpanded ? null : p.name)}
                              className="p-1 hover:bg-muted rounded"
                              aria-label="Mở rộng"
                            >
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                        {isExpanded && p.districts.length > 0 && (
                          <div className="ml-7 space-y-0.5 pb-1">
                            {p.districts.map((d) => {
                              const checked = selected?.districts?.includes(d.name) ?? false;
                              return (
                                <div key={d.name} className="flex items-center gap-2 px-1 py-0.5">
                                  <Checkbox
                                    id={`dist-${p.name}-${d.name}`}
                                    checked={checked}
                                    onCheckedChange={() => toggleDistrict(p.name, d.name)}
                                  />
                                  <Label
                                    htmlFor={`dist-${p.name}-${d.name}`}
                                    className="text-sm cursor-pointer text-muted-foreground"
                                  >
                                    {d.name}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
            {regions.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">Đã chọn {regions.length} tỉnh/thành</p>
            )}
          </div>

          {/* 3. Địa chỉ sau sáp nhập */}
          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <Label htmlFor="merged-addr" className="cursor-pointer">Địa chỉ sau sáp nhập</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Áp dụng đơn vị hành chính mới sau sáp nhập</p>
            </div>
            <Switch id="merged-addr" checked={mergedAddress} onCheckedChange={setMergedAddress} />
          </div>

          {/* 4. Giá khởi điểm */}
          <div>
            <Label className="mb-2 block">Giá khởi điểm (VNĐ)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                placeholder="Từ"
                value={priceMin ? fmtVnd(Number(priceMin)) : ""}
                onChange={(e) => {
                  const n = parseVnd(e.target.value);
                  setPriceMin(n != null ? String(n) : "");
                }}
              />
              <Input
                inputMode="numeric"
                placeholder="Đến"
                value={priceMax ? fmtVnd(Number(priceMax)) : ""}
                onChange={(e) => {
                  const n = parseVnd(e.target.value);
                  setPriceMax(n != null ? String(n) : "");
                }}
              />
            </div>
          </div>

          {/* 5. Tiền đặt trước */}
          <div>
            <Label className="mb-2 block">Tiền đặt trước (VNĐ)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                inputMode="numeric"
                placeholder="Từ"
                value={depositMin ? fmtVnd(Number(depositMin)) : ""}
                onChange={(e) => {
                  const n = parseVnd(e.target.value);
                  setDepositMin(n != null ? String(n) : "");
                }}
              />
              <Input
                inputMode="numeric"
                placeholder="Đến"
                value={depositMax ? fmtVnd(Number(depositMax)) : ""}
                onChange={(e) => {
                  const n = parseVnd(e.target.value);
                  setDepositMax(n != null ? String(n) : "");
                }}
              />
            </div>
          </div>

          {/* 6. Danh mục pháp lý */}
          <div>
            <Label className="mb-2 block">Danh mục pháp lý</Label>
            <div className="grid grid-cols-2 gap-2">
              {LEGAL_CATEGORIES.map((opt) => {
                const checked = legalCategories.includes(opt.value as LegalCategoryKey);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm",
                      checked && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleLegal(opt.value as LegalCategoryKey)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 7. Trạng thái phiên */}
          <div>
            <Label className="mb-2 block">Trạng thái phiên</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_OPTIONS.filter((o) =>
                ["registration_open", "upcoming", "ongoing"].includes(o.value)
              ).map((opt) => {
                const checked = sessionStatuses.includes(opt.value as SessionStatusKey);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm",
                      checked && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleStatus(opt.value as SessionStatusKey)}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {matchBanner && (
        matchBanner.count > 0 ? (
          <div className="mt-5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  Có <span className="text-primary">{matchBanner.count}</span> tài sản đang diễn ra phù hợp với nhu cầu của bạn
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Khám phá ngay để không bỏ lỡ cơ hội đấu giá phù hợp.
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/listings")} className="shrink-0 w-full sm:w-auto">
              Khám phá <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <BellRing className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  Chưa có tài sản đang diễn ra phù hợp với nhu cầu
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đăng ký nhận thông báo để được báo ngay khi có tài sản mới phù hợp.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/profile?tab=notifications")}
              className="shrink-0 w-full sm:w-auto"
            >
              <BellRing className="h-4 w-4" /> Đăng ký nhận thông báo
            </Button>
          </div>
        )
      )}

      {mode === "edit" && (
        <div className="flex items-center justify-between mt-6 gap-3">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            {filledOk ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Đã đủ thông tin
              </>
            ) : (
              "Chọn ít nhất 1 loại tài sản và 1 khu vực để mở khóa thưởng"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleCancel} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Lưu nhu cầu</>}
            </Button>
          </div>
        </div>
      )}

      <RewardClaimDialog open={showClaim} onOpenChange={setShowClaim} taskKey="intent" />
    </Card>
  );
};
