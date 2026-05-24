export interface CapacityProfile {
  companyName?: string

  // Mục I: Listed in Ministry of Justice registry
  onMinistryList: boolean

  // Mục II: Infrastructure /19
  scoreII: number

  // Mục IV.1-4: Auction history /21
  scoreIV1to4: number
  auctionsCompleted: number
  auctionsMissingPrice: number

  // Mục IV.5: Years of operation /5
  scoreIV5: number
  yearsActive: number

  // Mục IV.6-8: Auctioneers /13
  scoreIV6to8: number
  auctioneerCount: number

  // Mục IV.9: Previous year tax /6
  scoreIV9: number
  taxPaidPreviousYear: number // triệu VND

  totalCapacityScore: number // /76
  warnings: string[]
}
