// Khối mở đầu hồ sơ — ba biến thể theo mẫu. LUÔN in, không tắt được: bỏ nó thì
// file không còn cho biết đây là hồ sơ của ai.

import type { Content } from 'pdfmake/interfaces'
import type { DossierBundle } from '../dossier-bundle'
import { POSITION_LABELS, computePracticeYears } from '@/types/auctioneer'
import { CS, type DossierTheme } from './theme'
import { fmtDate } from './primitives'
import type { DossierImages } from './images'

function portraitBlock(t: DossierTheme, img: DossierImages): Content {
  const [w, h] = t.portrait
  if (img.portrait) return { image: img.portrait, width: w, height: h }
  // Không có ảnh thì giữ đúng khung 3×4 để bố cục không xô lệch.
  return {
    table: {
      widths: [w], heights: [h],
      body: [[{
        text: 'ảnh chân dung 3×4', fontSize: 6.5, color: t.frameHint,
        alignment: 'center', margin: [0, Math.max(8, h - 18), 0, 6],
      }]],
    },
    layout: {
      hLineColor: () => t.frame, vLineColor: () => t.frame,
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
    },
  }
}

/** Nền màu tràn lề + ảnh 3×4 + tên chữ lớn — mẫu Năng lực. */
function banner(b: DossierBundle, t: DossierTheme, orgName: string, refNo: string, img: DossierImages): Content {
  const { person } = b
  const years = computePracticeYears(person)
  const role = person.publicTitle?.trim() || POSITION_LABELS[person.position]
  const [, portraitH] = t.portrait

  // `.heroMain{align-items:flex-end}` — ảnh và khối chữ BẰNG ĐÁY. pdfmake
  // không canh dọc được trong `columns`, nên tính chiều cao khối chữ rồi đẩy
  // xuống đúng phần chênh. Bản trước đẩy bằng một số đoán tay nên chữ tụt quá
  // đáy ảnh.
  const LH = 1.35
  const textH =
    7.5 * LH +                    // kicker
    (t.nameSize * LH + 5 + 4) +   // tên + margin trên/dưới
    10 * LH +                     // chức vụ
    (8.5 * LH + 1.5)              // dòng mốc hành nghề
  // Tên dài xuống 2 dòng thì khối chữ cao hơn ảnh ⇒ kẹp về 0, ảnh canh trên.
  const textTop = Math.max(0, portraitH - textH)

  // Nền do `background` của trang vẽ tràn lề — fillColor trên bảng bị pdfmake
  // đặt lệch xuống so với nội dung khi có margin âm.
  return {
    margin: [0, -18, 0, 0],
    stack: [
      {
        columns: [
          { text: orgName.toUpperCase(), fontSize: 7.5, color: t.onBrandMuted, characterSpacing: CS.heroTop, width: '*' },
          { text: `Hồ sơ năng lực · ${refNo}`, fontSize: 7.5, color: t.onBrandMuted, characterSpacing: CS.heroTop, alignment: 'right', width: 'auto' },
        ],
      },
      {
        margin: [0, 20, 0, 0],
        columns: [
          { width: 84, stack: [portraitBlock(t, img)] },
          {
            width: '*',
            margin: [20, textTop, 0, 0],
            stack: [
              { text: `ĐẤU GIÁ VIÊN · THẺ SỐ ${person.licenseNumber}`, fontSize: 7.5, color: t.accent, characterSpacing: CS.kicker },
              // Thiết kế để tên ở dạng hoa/thường như nhập, KHÔNG in hoa toàn bộ.
              { text: person.fullName, font: t.display, fontSize: t.nameSize, bold: true, color: t.onBrand, margin: [0, 5, 0, 4] },
              { text: `${role} — ${years} năm hành nghề đấu giá`, fontSize: 10, bold: true, color: t.onBrand },
              {
                text: [
                  `Hành nghề từ ${fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)}`,
                  person.managementStartDate ? ` · Giữ chức quản lý từ ${fmtDate(person.managementStartDate)}` : '',
                ].join(''),
                fontSize: 8.5, color: t.onBrandSub, margin: [0, 1.5, 0, 0],
              },
            ],
          },
        ],
      },
    ],
  }
}

/** Măng-sét văn bản hành chính: tên tổ chức → kẻ đôi → tên hồ sơ → khối định danh. */
function letterhead(b: DossierBundle, t: DossierTheme, orgName: string, refNo: string, img: DossierImages): Content {
  const { person } = b
  const years = computePracticeYears(person)
  const role = person.publicTitle?.trim() || POSITION_LABELS[person.position]
  const [portraitW] = t.portrait

  const rule = (w: number, thickness: number): Content => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: w, y2: 0, lineWidth: thickness, lineColor: t.brand }],
    alignment: 'center',
    margin: [0, 3, 0, 0],
  })

  return {
    stack: [
      { text: orgName.toUpperCase(), fontSize: 9, bold: true, color: t.brand, alignment: 'center', characterSpacing: CS.heroTop },
      rule(140, 0.8),
      { text: 'HỒ SƠ ĐẤU GIÁ VIÊN', font: t.display, fontSize: 17, bold: true, color: t.brand, alignment: 'center', margin: [0, 16, 0, 0] },
      { text: `Số ${refNo}`, fontSize: 8, color: t.muted, alignment: 'center', margin: [0, 4, 0, 0] },
      rule(180, 0.6),
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: '*',
            margin: [0, 4, 12, 0],
            stack: [
              { text: person.fullName, font: t.display, fontSize: t.nameSize, bold: true, color: t.ink },
              { text: `${role} — ${years} năm hành nghề đấu giá`, fontSize: 9.5, bold: true, margin: [0, 4, 0, 0] },
              { text: `Thẻ đấu giá viên số ${person.licenseNumber}`, fontSize: 8.5, color: t.muted, margin: [0, 3, 0, 0] },
              {
                text: [
                  `Hành nghề từ ${fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)}`,
                  person.managementStartDate ? ` · Giữ chức quản lý từ ${fmtDate(person.managementStartDate)}` : '',
                ].join(''),
                fontSize: 8.5, color: t.muted, margin: [0, 2, 0, 0],
              },
            ],
          },
          { width: portraitW, stack: [portraitBlock(t, img)] },
        ],
      },
    ],
  }
}

/** Không nền, không khung — tên lớn, một dòng vai trò, kẻ mảnh. */
function plain(b: DossierBundle, t: DossierTheme, orgName: string, refNo: string, img: DossierImages): Content {
  const { person } = b
  const years = computePracticeYears(person)
  const role = person.publicTitle?.trim() || POSITION_LABELS[person.position]
  const [portraitW] = t.portrait

  return {
    stack: [
      {
        columns: [
          { text: orgName.toUpperCase(), fontSize: 7, color: t.muted, characterSpacing: CS.heroTop, width: '*' },
          { text: refNo, fontSize: 7, color: t.muted, characterSpacing: CS.heroTop, alignment: 'right', width: 'auto' },
        ],
      },
      {
        margin: [0, 12, 0, 0],
        columns: [
          {
            width: '*',
            margin: [0, 0, 12, 0],
            stack: [
              { text: `ĐẤU GIÁ VIÊN · THẺ SỐ ${person.licenseNumber}`, fontSize: 7, color: t.accent, characterSpacing: CS.kicker },
              { text: person.fullName, font: t.display, fontSize: t.nameSize, bold: true, color: t.ink, margin: [0, 4, 0, 3] },
              { text: `${role} — ${years} năm hành nghề đấu giá`, fontSize: 9, bold: true },
              {
                text: [
                  `Hành nghề từ ${fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)}`,
                  person.managementStartDate ? ` · Giữ chức quản lý từ ${fmtDate(person.managementStartDate)}` : '',
                ].join(''),
                fontSize: 8, color: t.muted, margin: [0, 2, 0, 0],
              },
            ],
          },
          { width: portraitW, stack: [portraitBlock(t, img)] },
        ],
      },
    ],
  }
}

export function heroBlock(
  b: DossierBundle,
  t: DossierTheme,
  orgName: string,
  refNo: string,
  img: DossierImages,
): Content {
  if (t.hero === 'LETTERHEAD') return letterhead(b, t, orgName, refNo, img)
  if (t.hero === 'PLAIN') return plain(b, t, orgName, refNo, img)
  return banner(b, t, orgName, refNo, img)
}
