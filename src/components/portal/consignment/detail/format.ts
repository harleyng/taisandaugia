import { format, parseISO } from 'date-fns'

/** "08/10/2026" từ yyyy-MM-dd hoặc ISO đầy đủ. */
export const fmtDate = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy')
