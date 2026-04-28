import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Save, CheckCircle2, Coins, ChevronsUpDown, Check, X, MapPin, Sparkles, BellRing, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuctionListings } from "@/hooks/useAuctionListings";
import { countMatches } from "@/lib/demandMatch";
import {
  BUDGET_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  SOURCE_OPTIONS,
  isIntentComplete,
  AgentInfoShape,
  BudgetRange,
  Experience,
  IntentGoal,
  SourceChannel,
  REWARD_INTENT_CREDITS,
} from "@/lib/onboardingTasks";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { notifyProfileUpdated, useOnboardingTasks } from "@/hooks/useOnboardingTasks";
import { RewardClaimDialog } from "@/components/onboarding/RewardClaimDialog";
import { cn } from "@/lib/utils";

export const ProfileIntentSection = () => {
  const { agentInfo, tasks, refresh } = useOnboardingTasks();
  const { data: allListings } = useAuctionListings();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLDivElement>(null);

  const intent = agentInfo?.intent ?? {};
  const [categories, setCategories] = useState<string[]>(intent.asset_categories ?? []);
  const [regions, setRegions] = useState<string[]>(intent.regions ?? []);
  const [budget, setBudget] = useState<BudgetRange | "">((intent.budget_range as BudgetRange) ?? "");
  const [experience, setExperience] = useState<Experience | "">((intent.experience as Experience) ?? "");
  const [goal, setGoal] = useState<IntentGoal | "">((intent.goal as IntentGoal) ?? "");
  const [source, setSource] = useState<SourceChannel | "">((intent.source as SourceChannel) ?? "");
  const [saving, setSaving] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [matchBanner, setMatchBanner] = useState<{ count: number } | null>(null);

  useEffect(() => {
    setCategories(intent.asset_categories ?? []);
    setRegions(intent.regions ?? []);
    setBudget((intent.budget_range as BudgetRange) ?? "");
    setExperience((intent.experience as Experience) ?? "");
    setGoal((intent.goal as IntentGoal) ?? "");
    setSource((intent.source as SourceChannel) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentInfo]);

  useEffect(() => {
    if (window.location.hash === "#intent" && sectionRef.current) {
      setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, []);

  const intentTask = tasks.find((t) => t.key === "intent");
  const status = intentTask?.status ?? "todo";

  const toggleCategory = (slug: string) => {
    setCategories((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };
  const toggleRegion = (name: string) => {
    setRegions((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const filledOk = Boolean(
    categories.length > 0 && regions.length > 0 && budget && experience && goal && source
  );

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
      budget_range: (budget || undefined) as BudgetRange | undefined,
      experience: (experience || undefined) as Experience | undefined,
      goal: (goal || undefined) as IntentGoal | undefined,
      source: (source || undefined) as SourceChannel | undefined,
    };

    const wasComplete = isIntentComplete(intent);
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

    if (willBeComplete) {
      // Always celebrate on save when intent is complete (test-friendly).
      // RewardClaimDialog skips re-crediting when already claimed.
      setTimeout(() => setShowClaim(true), 300);
    }

    if (willBeComplete && allListings) {
      const matches = countMatches(allListings, nextIntent);
      setMatchBanner({ count: matches });
    } else {
      setMatchBanner(null);
    }
  };

  const removeRegion = (name: string) => setRegions((prev) => prev.filter((p) => p !== name));

  return (
    <Card ref={sectionRef} id="intent" className="p-6 scroll-mt-24">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nhu cầu đấu giá</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Giúp chúng tôi gợi ý tài sản phù hợp với bạn</p>
        </div>
        {status === "claimed" ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Đã nhận thưởng
          </Badge>
        ) : status === "ready" ? (
          <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20">
            <Coins className="h-3 w-3" /> +{REWARD_INTENT_CREDITS} chờ nhận
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Coins className="h-3 w-3" /> +{REWARD_INTENT_CREDITS} sau khi hoàn thành
          </Badge>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <Label className="mb-2 block">Loại tài sản quan tâm</Label>
          <div className="flex flex-wrap gap-2">
            {ASSET_CATEGORIES.map((cat) => {
              const active = categories.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => toggleCategory(cat.slug)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  )}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Khu vực quan tâm</Label>
          <Popover open={regionsOpen} onOpenChange={setRegionsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={regionsOpen}
                className={cn(
                  "w-full justify-between font-normal h-auto min-h-10 py-2",
                  regions.length === 0 && "text-muted-foreground"
                )}
              >
                {regions.length === 0 ? (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Chọn tỉnh/thành (có thể chọn nhiều)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 items-center text-left">
                    {regions.map((name) => (
                      <Badge
                        key={name}
                        variant="secondary"
                        className="gap-1 pr-1 font-normal"
                      >
                        {name}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Bỏ ${name}`}
                          className="rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeRegion(name);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              removeRegion(name);
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Tìm tỉnh/thành..." />
                <CommandList>
                  <CommandEmpty>Không tìm thấy tỉnh/thành.</CommandEmpty>
                  <CommandGroup>
                    {vietnamProvinces.map((p) => {
                      const active = regions.includes(p.name);
                      return (
                        <CommandItem
                          key={p.name}
                          value={p.name}
                          onSelect={() => toggleRegion(p.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              active ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {regions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Đã chọn {regions.length} khu vực
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="i-budget">Ngân sách</Label>
            <Select value={budget} onValueChange={(v) => setBudget(v as BudgetRange)}>
              <SelectTrigger id="i-budget"><SelectValue placeholder="Chọn ngân sách" /></SelectTrigger>
              <SelectContent>
                {BUDGET_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="i-exp">Kinh nghiệm</Label>
            <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
              <SelectTrigger id="i-exp"><SelectValue placeholder="Chọn kinh nghiệm" /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="i-goal">Mục tiêu</Label>
            <Select value={goal} onValueChange={(v) => setGoal(v as IntentGoal)}>
              <SelectTrigger id="i-goal"><SelectValue placeholder="Chọn mục tiêu" /></SelectTrigger>
              <SelectContent>
                {GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="i-source">Bạn biết đến qua</Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceChannel)}>
              <SelectTrigger id="i-source"><SelectValue placeholder="Chọn nguồn" /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {filledOk ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Đã đủ thông tin
            </>
          ) : (
            "Điền đầy đủ để mở khóa thưởng"
          )}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Lưu nhu cầu</>}
        </Button>
      </div>

      <RewardClaimDialog open={showClaim} onOpenChange={setShowClaim} taskKey="intent" />
    </Card>
  );
};
