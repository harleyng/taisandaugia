// Hình thu nhỏ mô phỏng trang 1 của từng mẫu hồ sơ.
//
// Vẽ tay bằng SVG, KHÔNG render PDF thật: dựng thật phải nạp pdfmake + font +
// ảnh (~2MB) và chờ vài giây cho mỗi mẫu, chỉ để xem bố cục.
//
// Màu lấy thẳng từ theme của bản in (`dossier-pdf/theme.ts`) chứ không dùng
// token Tailwind: đây là ảnh mô phỏng TỜ GIẤY sẽ in ra, tô bằng màu giao diện
// thì ô preview không còn nói lên mẫu trông thế nào. Phần khung/nhãn/viền chọn
// của thẻ bên ngoài vẫn dùng token như mọi chỗ khác.

import { themeOf } from '@/lib/personnel/dossier-pdf/theme'
import type { DossierTemplate } from '@/lib/personnel/dossier-templates'

const W = 84
const H = 118

/** Vệt chữ giả. */
function Ln({ x, y, w, h = 1.6, fill, o = 1 }: {
  x: number; y: number; w: number; h?: number; fill: string; o?: number
}) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} opacity={o} />
}

export function DossierTemplateThumb({ template }: { template: DossierTemplate }) {
  const t = themeOf(template)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="presentation"
      aria-hidden="true"
    >
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />

      {template === 'FULL' && (
        <>
          {/* Hero nền màu tràn lề + vạch nhấn */}
          <rect x={0} y={0} width={W} height={30} fill={t.brand} />
          <rect x={0} y={30} width={W} height={1.6} fill={t.accent} />
          <Ln x={6} y={4} w={26} h={1.2} fill={t.onBrandMuted} />
          <rect x={6} y={9} width={13} height={17} fill="none" stroke={t.frame} strokeWidth={0.6} />
          <Ln x={23} y={10} w={16} h={1.2} fill={t.accent} />
          <Ln x={23} y={14} w={40} h={4} fill={t.onBrand} />
          <Ln x={23} y={21} w={30} h={1.6} fill={t.onBrand} o={0.85} />
          <Ln x={23} y={24.5} w={22} h={1.2} fill={t.onBrandSub} />

          {/* Dải 4 chỉ số */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Ln x={5 + i * 19} y={37} w={9} h={3.4} fill={t.brand} />
              <Ln x={5 + i * 19} y={42} w={13} h={1.1} fill={t.muted} o={0.65} />
              {i > 0 && <rect x={i * 19} y={35} width={0.5} height={10} fill={t.line} />}
            </g>
          ))}
          <rect x={0} y={48} width={W} height={0.5} fill={t.line} />

          {/* Mục + thẻ viền trái */}
          <Ln x={6} y={54} w={20} h={1.8} fill={t.brand} />
          <rect x={31} y={54.6} width={47} height={0.5} fill={t.line} />
          {[0, 1].map((i) => (
            <g key={i}>
              <rect x={6 + i * 37} y={59} width={35} height={12} fill="none" stroke={t.line} strokeWidth={0.5} />
              <rect x={6 + i * 37} y={59} width={1.6} height={12} fill={t.accent} />
              <Ln x={10 + i * 37} y={62} w={20} h={1.6} fill={t.ink} />
              <Ln x={10 + i * 37} y={66} w={14} h={1.1} fill={t.muted} o={0.7} />
            </g>
          ))}

          {/* Bảng gạch chân */}
          <Ln x={6} y={78} w={24} h={1.8} fill={t.brand} />
          <rect x={6} y={84} width={72} height={0.8} fill={t.brand} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Ln x={6} y={89 + i * 7} w={44} h={1.3} fill={t.ink} o={0.7} />
              <Ln x={58} y={89 + i * 7} w={20} h={1.3} fill={t.ink} o={0.45} />
              <rect x={6} y={93.5 + i * 7} width={72} height={0.4} fill={t.line2} />
            </g>
          ))}
        </>
      )}

      {template === 'FORMAL' && (
        <>
          {/* Măng-sét căn giữa + kẻ đôi */}
          <Ln x={26} y={8} w={32} h={1.5} fill={t.brand} />
          <rect x={28} y={12} width={28} height={0.7} fill={t.brand} />
          <Ln x={22} y={19} w={40} h={4} fill={t.brand} />
          <Ln x={33} y={26} w={18} h={1.1} fill={t.muted} o={0.7} />
          <rect x={20} y={30} width={44} height={0.5} fill={t.brand} opacity={0.6} />

          {/* Khối định danh: chữ trái, ảnh phải */}
          <Ln x={6} y={36} w={34} h={3.4} fill={t.ink} />
          <Ln x={6} y={42} w={26} h={1.4} fill={t.ink} o={0.75} />
          <Ln x={6} y={46} w={20} h={1.2} fill={t.muted} o={0.7} />
          <rect x={64} y={35} width={14} height={18} fill="none" stroke={t.frame} strokeWidth={0.6} />

          {/* Dải chỉ số không màu */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Ln x={7 + i * 18} y={57} w={7} h={2.6} fill={t.brand} />
              <Ln x={7 + i * 18} y={61} w={12} h={1} fill={t.muted} o={0.65} />
              {i > 0 && <rect x={4 + i * 18} y={55} width={0.4} height={9} fill={t.line} />}
            </g>
          ))}
          <rect x={6} y={66} width={72} height={0.4} fill={t.line} />

          {/* Mục đánh số La Mã, căn giữa */}
          <Ln x={28} y={72} w={28} h={1.8} fill={t.brand} />

          {/* Bảng kẻ viền kín */}
          <rect x={6} y={78} width={72} height={19.5} fill="none" stroke={t.line} strokeWidth={0.5} />
          {[1, 2].map((i) => (
            <rect key={i} x={6} y={78 + i * 6.5} width={72} height={0.5} fill={t.line} />
          ))}
          {[1, 2].map((i) => (
            <rect key={i} x={6 + i * 24} y={78} width={0.5} height={19.5} fill={t.line} />
          ))}
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
            <Ln key={`${r}-${c}`} x={9 + c * 24} y={80.5 + r * 6.5} w={16} h={1.2} fill={t.ink} o={r === 0 ? 0.85 : 0.55} />
          )))}

          <Ln x={28} y={104} w={28} h={1.8} fill={t.brand} />
          <rect x={6} y={109} width={72} height={6} fill="none" stroke={t.line} strokeWidth={0.5} />
          <Ln x={9} y={111.5} w={40} h={1.2} fill={t.ink} o={0.6} />
        </>
      )}

      {template === 'COMPACT' && (
        <>
          <Ln x={6} y={7} w={22} h={1} fill={t.muted} o={0.6} />
          <Ln x={62} y={7} w={16} h={1} fill={t.muted} o={0.6} />

          <Ln x={6} y={14} w={14} h={1.1} fill={t.accent} />
          <Ln x={6} y={19} w={40} h={4.5} fill={t.ink} />
          <Ln x={6} y={26} w={28} h={1.5} fill={t.ink} o={0.8} />
          <Ln x={6} y={30} w={22} h={1.1} fill={t.muted} o={0.7} />
          <rect x={64} y={14} width={14} height={18} fill="none" stroke={t.frame} strokeWidth={0.6} />

          {/* Chỉ số dồn một dòng */}
          <Ln x={6} y={39} w={66} h={1.4} fill={t.ink} o={0.7} />
          <rect x={6} y={44} width={72} height={0.5} fill={t.line} />

          {/* Tiêu đề nhỏ, không kẻ */}
          {[0, 1, 2].map((g) => (
            <g key={g}>
              <Ln x={6} y={51 + g * 22} w={16} h={1.3} fill={t.muted} />
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <Ln x={6} y={56 + g * 22 + i * 5} w={42} h={1.2} fill={t.ink} o={0.65} />
                  <Ln x={56} y={56 + g * 22 + i * 5} w={22} h={1.2} fill={t.ink} o={0.4} />
                </g>
              ))}
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
