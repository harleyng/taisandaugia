// Ba phong cách trình bày của bản xuất PDF.
//
// Mọi màu, cỡ chữ và biến thể bố cục của renderer gom hết vào đây; các file
// khác trong thư mục này KHÔNG được hardcode hex. Preset `FULL` chép đúng các
// hằng của bản gốc (`Ho So Nhan Su - Mau Xuat PDF.html` — Claude Design), nên
// bật đủ mục ở mẫu Năng lực phải cho ra file y hệt trước khi có tính năng chọn
// mẫu.
//
// Đây là palette của TỜ GIẤY IN, không phải giao diện app: nó không đi qua token
// HSL trong `src/index.css` và cũng không được dùng ngược lại cho UI.

import type { DossierSectionId, DossierTemplate } from '../dossier-templates'

export interface DossierTheme {
  key: DossierTemplate

  // ── Màu ──
  /** Màu nhấn chính: tiêu đề mục, gạch chân bảng, nền hero. */
  brand: string
  ink: string
  muted: string
  line: string
  line2: string
  /** Màu phụ: viền trái thẻ, nhãn mốc, vạch dưới hero. */
  accent: string
  accentSoft: string
  ok: string
  okSoft: string
  warn: string
  warnSoft: string
  danger: string
  scanBg: string
  /** Chữ trên nền hero đậm (chỉ dùng khi hero = BANNER). */
  onBrand: string
  onBrandMuted: string
  onBrandSub: string
  /** Khung ảnh chân dung khi chưa có ảnh. */
  frame: string
  frameHint: string

  // ── Chữ ──
  display: 'Lora' | 'Roboto'
  nameSize: number
  bodySize: number

  // ── Bố cục ──
  hero: 'BANNER' | 'LETTERHEAD' | 'PLAIN'
  /** Chiều cao dải nền hero — `background` vẽ theo đúng hằng này. */
  heroHeight: number
  portrait: [number, number]
  heading: 'RULE_RIGHT' | 'ROMAN_CENTERED' | 'QUIET'
  headingGap: number
  table: 'UNDERLINE' | 'BOXED'
  cards: 'ACCENT_BAR' | 'PLAIN_BOX'
  chip: 'FILLED' | 'OUTLINE'
  stats: 'STRIP' | 'INLINE'
  /** Dải chỉ số tràn ra lề trang (chỉ hợp khi phía trên là hero nền màu). */
  statsBleed: boolean
  annexCols: number
  annexShotHeight: number
  /** Nhóm trang: nhóm thứ 2 trở đi mở trang mới nếu có mục nào được chọn. */
  pageGroups: DossierSectionId[][]
}

export const PAGE_W = 595.28 // A4 pt
export const MARGIN = 40

// letter-spacing của thiết kế quy từ em sang pt theo cỡ chữ tương ứng.
export const CS = {
  heroTop: 7.5 * 0.14,
  kicker: 7.5 * 0.18,
  statLabel: 6.8 * 0.06,
  heading: 8.5 * 0.09,
  tableHead: 7.5 * 0.05,
  flag: 6.5 * 0.04,
}

const FULL: DossierTheme = {
  key: 'FULL',
  brand: '#0a3d7a',
  ink: '#101720',
  muted: '#6b7887',
  line: '#d8dfe8',
  line2: '#eef2f7',
  accent: '#c8901a',
  accentSoft: '#fbf3e0',
  ok: '#12694a',
  okSoft: '#effaf4',
  warn: '#a35a08',
  warnSoft: '#fdf0e3',
  danger: '#b3261e',
  scanBg: '#f1f4f8',
  onBrand: '#ffffff',
  onBrandMuted: '#b9cbe2',
  onBrandSub: '#9fb6d1',
  frame: '#4a6f9e',
  frameHint: '#8ba6c6',
  display: 'Lora',
  nameSize: 28,
  bodySize: 9,
  hero: 'BANNER',
  heroHeight: 196,
  // Ảnh 118×157px trong trang 794px của thiết kế ⇒ 88×118pt trên A4.
  portrait: [88, 118],
  heading: 'RULE_RIGHT',
  headingGap: 18,
  table: 'UNDERLINE',
  cards: 'ACCENT_BAR',
  chip: 'FILLED',
  stats: 'STRIP',
  statsBleed: true,
  annexCols: 3,
  annexShotHeight: 138,
  pageGroups: [
    ['strengths', 'education', 'notable'],
    ['cpd', 'rewards', 'identity', 'practice'],
    ['annex'],
  ],
}

// Bản hành chính: chỉ hai sắc xám đậm/nhạt, không khối nền lớn, không chip tô
// nền — máy in đen trắng vẫn giữ nguyên độ tương phản và không nuốt chữ trắng.
const FORMAL: DossierTheme = {
  key: 'FORMAL',
  brand: '#1f2933',
  ink: '#111418',
  muted: '#5b6672',
  line: '#b9c0c8',
  line2: '#dde1e6',
  accent: '#1f2933',
  accentSoft: '#f1f3f5',
  ok: '#1f5140',
  okSoft: '#f1f3f5',
  warn: '#7a4406',
  warnSoft: '#f1f3f5',
  danger: '#8c1d17',
  scanBg: '#f4f5f7',
  onBrand: '#ffffff',
  onBrandMuted: '#c9ced4',
  onBrandSub: '#aab2ba',
  frame: '#9aa3ad',
  frameHint: '#8b949e',
  display: 'Lora',
  nameSize: 20,
  bodySize: 9,
  hero: 'LETTERHEAD',
  heroHeight: 0,
  portrait: [84, 112],
  heading: 'ROMAN_CENTERED',
  headingGap: 16,
  table: 'BOXED',
  cards: 'PLAIN_BOX',
  chip: 'OUTLINE',
  stats: 'STRIP',
  statsBleed: false,
  annexCols: 3,
  annexShotHeight: 132,
  pageGroups: [
    ['strengths', 'education', 'notable', 'cpd', 'rewards', 'identity', 'practice'],
    ['annex'],
  ],
}

const COMPACT: DossierTheme = {
  key: 'COMPACT',
  brand: '#243447',
  ink: '#101720',
  muted: '#6b7887',
  line: '#d8dfe8',
  line2: '#eef2f7',
  accent: '#334155',
  accentSoft: '#eef1f5',
  ok: '#12694a',
  okSoft: '#effaf4',
  warn: '#a35a08',
  warnSoft: '#fdf0e3',
  danger: '#b3261e',
  scanBg: '#f1f4f8',
  onBrand: '#ffffff',
  onBrandMuted: '#c2cbd6',
  onBrandSub: '#9aa6b4',
  frame: '#c3ccd8',
  frameHint: '#93a1b1',
  display: 'Lora',
  nameSize: 22,
  bodySize: 8.5,
  hero: 'PLAIN',
  heroHeight: 0,
  portrait: [64, 85],
  heading: 'QUIET',
  headingGap: 14,
  table: 'UNDERLINE',
  cards: 'PLAIN_BOX',
  chip: 'FILLED',
  stats: 'INLINE',
  statsBleed: false,
  annexCols: 4,
  annexShotHeight: 108,
  pageGroups: [
    ['strengths', 'education', 'notable', 'cpd', 'rewards', 'identity', 'practice'],
    ['annex'],
  ],
}

export const THEMES: Record<DossierTemplate, DossierTheme> = { FULL, FORMAL, COMPACT }

export const themeOf = (t: DossierTemplate): DossierTheme => THEMES[t] ?? FULL
