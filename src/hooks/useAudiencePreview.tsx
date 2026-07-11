import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAudienceCount } from "@/hooks/useCampaigns";
import { hasAnyAudience } from "@/lib/marketing/audienceCriteria";
import type { AudienceSpec } from "@/types/marketing";

/**
 * Live "eligible count" for the audience builder. Debounces spec changes (400ms)
 * and calls the count_campaign_audience RPC (always opt-in-respecting). Disabled
 * when no audience source is active, so we don't scan the whole user base for an
 * empty spec.
 */
export function useAudiencePreview(spec: AudienceSpec) {
  const specKey = JSON.stringify(spec);
  const [debouncedKey, setDebouncedKey] = useState(specKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(specKey), 400);
    return () => clearTimeout(t);
  }, [specKey]);

  const debouncedSpec = JSON.parse(debouncedKey) as AudienceSpec;
  const active = hasAnyAudience(debouncedSpec);

  return useQuery<number>({
    queryKey: ["campaign_audience_count", debouncedKey],
    queryFn: () => fetchAudienceCount(debouncedSpec, true),
    enabled: active,
    staleTime: 30_000,
  });
}
