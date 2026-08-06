// Font và ảnh nhúng vào PDF hồ sơ.
//
// Font Lora tải như asset của Vite (?url) rồi nạp vào virtual file system của
// pdfmake, thay vì nhét base64 ~350KB thẳng vào mã nguồn. Chỉ nạp khi thật sự
// xuất PDF — module này đi cùng chunk lazy của pdfmake.

import LoraRegularUrl from '@/assets/fonts/Lora-Regular.ttf?url'
import LoraSemiBoldUrl from '@/assets/fonts/Lora-SemiBold.ttf?url'
import { supabase } from '@/integrations/supabase/client'
import { DOCS_BUCKET } from './storage'

function bytesToBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  let s = ''
  // Cắt khúc: spread cả mảng vào String.fromCharCode sẽ tràn call stack với
  // file cỡ trăm KB.
  const CHUNK = 0x8000
  for (let i = 0; i < b.length; i += CHUNK) {
    s += String.fromCharCode(...b.subarray(i, i + CHUNK))
  }
  return btoa(s)
}

let loraCache: Record<string, string> | null = null

/** Hai file Lora dưới dạng base64, khoá theo tên dùng trong pdfmake. */
export async function loadLoraFonts(): Promise<Record<string, string>> {
  if (loraCache) return loraCache
  const [reg, semi] = await Promise.all([
    fetch(LoraRegularUrl).then((r) => r.arrayBuffer()),
    fetch(LoraSemiBoldUrl).then((r) => r.arrayBuffer()),
  ])
  loraCache = {
    'Lora-Regular.ttf': bytesToBase64(reg),
    'Lora-SemiBold.ttf': bytesToBase64(semi),
  }
  return loraCache
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Tải một file trong bucket riêng tư về dạng data URL để nhúng vào PDF.
 *
 * pdfmake chỉ nhận data URL, không nhận URL từ xa — và bucket giấy tờ là
 * private nên URL trực tiếp cũng không đọc được.
 * PDF không hiển thị được, nên bỏ qua file đó thay vì làm hỏng cả bản xuất.
 */
export async function docPathToDataUrl(path: string): Promise<string | null> {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return null // pdfmake không nhúng được PDF lồng nhau
  const mime = MIME_BY_EXT[ext]
  if (!mime) return null

  try {
    const { data, error } = await supabase.storage.from(DOCS_BUCKET).download(path)
    if (error || !data) return null
    return `data:${mime};base64,${bytesToBase64(await data.arrayBuffer())}`
  } catch {
    return null
  }
}

/** Ảnh chân dung nằm ở bucket public nên tải thẳng qua URL. */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const mime = blob.type || 'image/jpeg'
    return `data:${mime};base64,${bytesToBase64(await blob.arrayBuffer())}`
  } catch {
    return null
  }
}
