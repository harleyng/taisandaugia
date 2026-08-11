// Ảnh nhúng vào PDF: chân dung và bản chụp giấy tờ, tải sẵn về data URL trước
// khi dựng (pdfmake không tự đi lấy ảnh từ URL ký tạm của Storage).

import type { DossierBundle } from '../dossier-bundle'
import { docPathToDataUrl, urlToDataUrl } from '../pdf-assets'

export interface DossierImages {
  portrait: string | null
  /** dataURL bản chụp theo id giấy tờ; thiếu thì vẽ ô trống. */
  docScans: Record<string, string | null>
}

export async function loadDossierImages(b: DossierBundle): Promise<DossierImages> {
  const [portrait, ...scans] = await Promise.all([
    b.person.portraitUrl ? urlToDataUrl(b.person.portraitUrl) : Promise.resolve(null),
    ...b.documents.map((d) =>
      d.filePaths.length > 0 ? docPathToDataUrl(d.filePaths[0]) : Promise.resolve(null),
    ),
  ])
  const docScans: Record<string, string | null> = {}
  b.documents.forEach((d, i) => { docScans[d.id] = scans[i] ?? null })
  return { portrait, docScans }
}
