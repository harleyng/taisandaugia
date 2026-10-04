// Lớp CSS ô nhập dùng chung của wizard số hoá (fields.tsx + dossier/fields).

export const INPUT_BASE =
  "w-full bg-background border-[1.5px] rounded-[10px] px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-[3px] focus:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed";

export const borderClass = (err?: string, ok?: boolean) =>
  err ? "border-destructive bg-destructive/5" : ok ? "border-success/50" : "border-input";
