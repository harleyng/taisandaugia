import { useCallback, useState } from "react";
import { readStoredChoice, writeStoredChoice } from "@/lib/storedChoice";

/** useState ghi nhớ qua localStorage; giá trị ngoài `allowed` rơi về `fallback`. */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [value, setValue] = useState<T>(() => readStoredChoice(key, allowed, fallback));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      writeStoredChoice(key, next);
    },
    [key],
  );
  return [value, update] as const;
}
