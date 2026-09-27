// Tóm tắt báo cáo định kỳ cho trang chi tiết / danh sách (/chu-tai-san/bao-cao-dinh-ky,
// design "Bao Cao Dinh Ky Chu Tai San") — THUẦN. Mọi số đã do server tính trong payload;
// ở đây chỉ chọn, cộng theo chi nhánh và diễn đạt thành câu, không đổi luật tính nào.

import { formatMoneyShort } from "@/utils/money";
import { REPORT_PAYMENT_LABEL, primaryReportTarget, formatReportDay, type ReportPayload } from "./ownerPeriodicReport";
import { TARGET_PERIOD_LABEL, periodEndOf, periodLabel, type TargetPeriodType } from "./ownerTargets";

// ─── Hạn chốt ────────────────────────────────────────────────────────────────

/** Hạn chốt mặc định: ngày 05 của tháng liền sau kỳ (chưa có "Lịch gửi" tuỳ chỉnh). */
export const REPORT_DUE_DAY = 5;

/** "2026-07-01" (quý) → "2026-10-05". */
export function reportDueDate(type: TargetPeriodType, start: string): string {
  const end = periodEndOf(type, start);
  const [y, m] = end.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(REPORT_DUE_DAY).padStart(2, "0")}`;
}

/** "01/07 – 30/09/2026" — cùng năm thì bỏ năm ở ngày đầu. */
export function reportRangeLabel(type: TargetPeriodType, start: string): string {
  const end = periodEndOf(type, start);
  const from = formatReportDay(start);
  return `${start.slice(0, 4) === end.slice(0, 4) ? from.slice(0, 5) : from} – ${formatReportDay(end)}`;
}

// ─── Số chính ────────────────────────────────────────────────────────────────

export interface ReportFigures {
  /** Tổng giá trúng trong kỳ. */
  soldValue: number;
  /** "Đã thu" (ghi nhận + tạm tính) — luật của Chỉ tiêu. */
  collected: number;
  /** % chỉ tiêu tiền của đúng phạm vi; null khi không đặt chỉ tiêu. */
  targetPct: number | null;
}

export function reportFigures(payload: ReportPayload): ReportFigures {
  return {
    soldValue: payload.results.totals.soldValue,
    collected: payload.money.collected,
    targetPct: primaryReportTarget(payload.targets, payload.meta.scope.kind)?.amountPct ?? null,
  };
}

export interface ReportDelta {
  /** Làm tròn tới 1%; null khi kỳ trước bằng 0 (không so được). */
  pct: number | null;
  dir: "up" | "down" | "flat";
}

export function reportDelta(current: number, previous: number | null | undefined): ReportDelta | null {
  if (previous === null || previous === undefined) return null;
  if (previous <= 0) return current > 0 ? { pct: null, dir: "up" } : { pct: 0, dir: "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** "+18% so quý II/2026" · "Mới phát sinh so quý II/2026" · "Bằng quý II/2026". */
export function deltaLabel(delta: ReportDelta, previousLabel: string): string {
  if (delta.pct === null) return `Mới phát sinh so ${previousLabel}`;
  if (delta.dir === "flat") return `Bằng ${previousLabel}`;
  return `${delta.pct > 0 ? "+" : ""}${delta.pct}% so ${previousLabel}`;
}

// ─── Kết luận kỳ ─────────────────────────────────────────────────────────────

export interface ReportProgressBar {
  target: number;
  collected: number;
  /** Đã trúng, chưa thu — chưa tính vào chỉ tiêu. */
  awaiting: number;
  /** Phần chỉ tiêu chưa có nguồn nào (sau cả chờ thu). */
  uncovered: number;
  /** Tỷ lệ bề rộng 0–100 của 3 đoạn, trên mẫu = max(chỉ tiêu, đã thu + chờ thu). */
  widths: [number, number, number];
}

export interface ReportConclusion {
  headline: string;
  /** null khi kỳ không có chỉ tiêu tiền. */
  bar: ReportProgressBar | null;
}

export function reportConclusion(payload: ReportPayload): ReportConclusion {
  const { meta, money } = payload;
  const word = TARGET_PERIOD_LABEL[meta.period.type].toLowerCase();
  const target = primaryReportTarget(payload.targets, meta.scope.kind);
  if (!target || target.targetAmount === null) {
    return {
      headline: `Đã thu ${formatMoneyShort(money.collected)} trong ${periodLabel(meta.period.type, meta.period.start)} — kỳ này chưa đặt chỉ tiêu thu hồi`,
      bar: null,
    };
  }
  const goal = target.targetAmount;
  const remaining = target.amountRemaining ?? Math.max(0, goal - target.collected);
  const headline =
    remaining > 0
      ? `Đạt ${target.amountPct ?? 0}% chỉ tiêu ${word} — còn thiếu ${formatMoneyShort(remaining)} để đạt mục tiêu ${formatMoneyShort(goal)}`
      : `Đạt ${target.amountPct ?? 0}% chỉ tiêu ${word} — đã vượt mục tiêu ${formatMoneyShort(goal)}`;
  const awaiting = target.awaiting;
  const uncovered = Math.max(0, remaining - awaiting);
  const base = Math.max(goal, target.collected + awaiting) || 1;
  const pct = (n: number) => Math.max(0, Math.min(100, (n / base) * 100));
  return {
    headline,
    bar: {
      target: goal,
      collected: target.collected,
      awaiting,
      uncovered,
      widths: [pct(target.collected), pct(awaiting), pct(uncovered)],
    },
  };
}

/** Một đoạn của câu tóm tắt; `strong` in đậm như design. */
export interface SummaryPart {
  text: string;
  strong?: boolean;
}

const unique = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];

function joinVi(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} và ${xs[xs.length - 1]}`;
}

/** Câu tóm tắt dưới tiêu đề kết luận — ghép từ số của payload, không có nhận định chủ quan. */
export function reportSummary(payload: ReportPayload): SummaryPart[] {
  const { meta, results, money, stuck, plan } = payload;
  const t = results.totals;
  const period = periodLabel(meta.period.type, meta.period.start);
  const parts: SummaryPart[] = [];
  const say = (text: string, strong = false) => parts.push(strong ? { text, strong } : { text });

  if (t.total === 0) {
    say(`${period.charAt(0).toUpperCase()}${period.slice(1)} chưa có tài sản nào có kết quả phiên.`);
  } else {
    say(`${period.charAt(0).toUpperCase()}${period.slice(1)} ghi nhận `);
    say(`${t.sold} tài sản đấu thành / ${t.total} tài sản`, true);
    // Chênh giá trúng so giá khởi điểm — chỉ trên các tài sản có đủ cả hai giá.
    let price = 0;
    let start = 0;
    for (const i of results.items) {
      if (i.outcome === "sold" && i.price && i.startingPrice) {
        price += i.price;
        start += i.startingPrice;
      }
    }
    const premium = start > 0 ? Math.round(((price - start) / start) * 100) : null;
    if (premium !== null && premium !== 0) {
      say(", giá trúng bình quân ");
      say(`${premium > 0 ? "vượt" : "thấp hơn"} ${Math.abs(premium)}% giá khởi điểm`, true);
    }
    say(".");
  }

  const target = primaryReportTarget(payload.targets, meta.scope.kind);
  if (target && target.targetAmount !== null) {
    const remaining = target.amountRemaining ?? 0;
    say(` Tiến độ chỉ tiêu đạt ${target.amountPct ?? 0}%`);
    if (remaining > 0) {
      say(", cần thêm ");
      say(formatMoneyShort(remaining), true);
      if (plan.nextPeriod) say(` trong ${periodLabel(plan.nextPeriod.type, plan.nextPeriod.start)}`);
    }
    say(".");
  }

  const pending = money.items.filter((i) => i.paymentStatus !== "defaulted" && i.awaiting > 0);
  const risks: SummaryPart[] = [];
  if (pending.length) {
    const where = joinVi(unique(pending.map((i) => i.branchName)));
    risks.push({ text: `${pending.length} khoản chờ thu ${formatMoneyShort(money.awaiting)}`, strong: true });
    if (where && meta.scope.kind === "unit") risks.push({ text: ` tại ${where}` });
  }
  if (money.defaulted.count) {
    if (risks.length) risks.push({ text: ", " });
    risks.push({ text: `${money.defaulted.count} tài sản người trúng bỏ cọc`, strong: true });
  }
  if (stuck.count) {
    if (risks.length) risks.push({ text: ", " });
    risks.push({ text: `${stuck.count} tài sản tồn đọng`, strong: true });
  }
  if (risks.length) {
    say(" Cần theo dõi: ");
    parts.push(...risks);
    say(".");
  }
  return parts;
}

// ─── Cần lãnh đạo lưu ý ──────────────────────────────────────────────────────

export interface AttentionItem {
  key: string;
  title: string;
  branchName: string | null;
  issue: string;
  /** Số tiền đi kèm vấn đề (giá trúng / còn chờ thu / giá khởi điểm); null khi không rõ. */
  amount: number | null;
  tone: "destructive" | "warning" | "muted";
}

/**
 * Bỏ cọc → chờ thu (lớn trước) → tồn đọng. Cùng nguồn với các phần 3–4 của báo cáo,
 * chỉ gom lại thành một danh sách để người đọc thấy việc cần làm trước.
 */
export function reportAttentionItems(payload: ReportPayload): AttentionItem[] {
  const out: AttentionItem[] = [];
  payload.money.items.forEach((i, idx) => {
    if (i.paymentStatus === "defaulted") {
      out.push({
        key: `d-${idx}`,
        title: i.title,
        branchName: i.branchName,
        issue: REPORT_PAYMENT_LABEL.defaulted,
        amount: i.price,
        tone: "destructive",
      });
    }
  });
  payload.money.items.forEach((i, idx) => {
    if (i.paymentStatus !== "defaulted" && i.awaiting > 0) {
      out.push({
        key: `a-${idx}`,
        title: i.title,
        branchName: i.branchName,
        issue: i.paymentStatus === "partial" ? "Thu một phần — còn chờ thu" : "Chờ thu tiền",
        amount: i.awaiting,
        tone: "warning",
      });
    }
  });
  payload.stuck.items.forEach((i, idx) => {
    const age = i.ageDays !== null ? ` · ${i.ageDays} ngày` : "";
    out.push({
      key: `s-${idx}`,
      title: i.title,
      branchName: i.branchName,
      issue: `Tồn đọng — ${i.rounds} lượt${age}${i.nextDate ? "" : ", chưa có lịch phiên"}`,
      amount: i.startingPrice,
      tone: "muted",
    });
  });
  return out;
}

// ─── Theo chi nhánh ──────────────────────────────────────────────────────────

export const NO_BRANCH_LABEL = "Chưa gán chi nhánh";

export interface BranchRow {
  branchName: string;
  soldValue: number;
  sold: number;
  total: number;
  /** Đã thu / giá trúng (không tính tài sản bỏ cọc); null khi chưa có tài sản thành. */
  collectRate: number | null;
}

/**
 * Cộng kết quả phiên theo chi nhánh — chỉ cho báo cáo cả đơn vị có ít nhất một chi nhánh.
 * Tỷ lệ thu = (giá trúng − còn chờ thu) / giá trúng, cùng luật "Đã thu" của Chỉ tiêu.
 */
export function reportBranchRows(payload: ReportPayload): BranchRow[] {
  if (payload.meta.scope.kind !== "unit") return [];
  const rows = new Map<string, BranchRow & { counted: number; awaiting: number }>();
  const row = (name: string | null) => {
    const key = name ?? NO_BRANCH_LABEL;
    let r = rows.get(key);
    if (!r) {
      r = { branchName: key, soldValue: 0, sold: 0, total: 0, collectRate: null, counted: 0, awaiting: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const i of payload.results.items) {
    const r = row(i.branchName);
    r.total += 1;
    if (i.outcome === "sold") {
      r.sold += 1;
      r.soldValue += i.price ?? 0;
      if (i.paymentStatus !== "defaulted") r.counted += i.price ?? 0;
    }
  }
  for (const i of payload.money.items) {
    if (i.paymentStatus !== "defaulted") row(i.branchName).awaiting += i.awaiting;
  }
  const list = [...rows.values()];
  if (!list.some((r) => r.branchName !== NO_BRANCH_LABEL)) return [];
  return list
    .map(({ counted, awaiting, ...r }) => ({
      ...r,
      collectRate: counted > 0 ? Math.max(0, Math.round(((counted - awaiting) / counted) * 100)) : null,
    }))
    .sort((a, b) =>
      a.branchName === NO_BRANCH_LABEL ? 1 : b.branchName === NO_BRANCH_LABEL ? -1 : b.soldValue - a.soldValue,
    );
}
