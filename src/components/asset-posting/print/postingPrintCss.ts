// CSS của bản in "Hồ sơ số hoá tài sản" — chép từ thiết kế "Ho So So Hoa - PDF.html"
// (Claude Design, project 979d4c55) và bó trong `.hsp` để không lọt ra ngoài trang in.
// Đây là palette của TỜ GIẤY IN (khớp token app: --pri = --primary), không dùng lại cho UI.
//
// Vỏ trang thay cho <doc-page> của thiết kế: trên màn hình là tờ A4 trên nền "bàn";
// khi in, @page margin 0 + đầu/chân trang position:fixed lặp mỗi trang, còn thead/tfoot
// của bảng khung làm khoảng đệm để nội dung không chui xuống dưới chúng.

export const PRINT_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";

const MARGIN = "0.6in";

export const POSTING_PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: none !important; height: auto !important; overflow: visible !important; }
}

.hsp{--pri:hsl(152 60% 26%);--pri-d:hsl(152 58% 16%);--pri-50:hsl(152 40% 96%);--pri-100:hsl(152 35% 88%);--acc:hsl(43 90% 52%);--acc-50:hsl(43 90% 95%);--blu:hsl(215 60% 42%);--blu-50:hsl(215 70% 96%);--ink:hsl(222 47% 11%);--ink2:hsl(220 14% 32%);--ink3:hsl(220 9% 46%);--bd:hsl(220 13% 88%);--bd2:hsl(220 13% 80%);--bg:hsl(220 20% 97%);--me:hsl(32 90% 34%);--me-50:hsl(40 90% 95%);--err:hsl(0 66% 42%);--err-50:hsl(0 80% 97%);--ok:hsl(152 60% 28%)}
.hsp, .hsp *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
.hsp h1,.hsp h2{text-wrap:balance}
.hsp p{text-wrap:pretty;orphans:3;widows:3}

/* ── vỏ trang (thay <doc-page size="a4" margin="0.6in">) ── */
.hsp.desk{background:#f5f5f4;padding:48px 24px;min-height:100vh}
.hsp .sheet{width:210mm;max-width:100%;margin:0 auto;background:#fff;box-shadow:0 2px 10px rgba(20,20,19,.12);border-radius:7px;padding:${MARGIN}}
.hsp .frame{width:100%;border-collapse:collapse;table-layout:fixed}
.hsp .frame td,.hsp .frame th{padding:0;text-align:left;font-weight:inherit}
@media print{
  .hsp.desk{background:none;padding:0;min-height:0}
  .hsp .sheet{width:auto;max-width:none;margin:0;box-shadow:none;border-radius:0;padding:0 ${MARGIN}}
  .hsp .hdr-space,.hsp .ftr-space{height:0.66in}
  .hsp .hdr-space .hd{position:fixed;top:0;left:0;right:0;margin:0;padding:calc(${MARGIN} * .45) ${MARGIN} 8pt}
  .hsp .ftr-space .ft{position:fixed;bottom:0;left:0;right:0;margin:0;padding:8pt ${MARGIN} calc(${MARGIN} * .45)}
  .hsp .hdr-space .hd::after{content:"";position:absolute;left:${MARGIN};right:${MARGIN};bottom:0;border-bottom:1px solid var(--bd)}
  .hsp .ftr-space .ft::before{content:"";position:absolute;left:${MARGIN};right:${MARGIN};top:0;border-top:1px solid var(--bd)}
  .hsp .hdr-space .hd,.hsp .ftr-space .ft{border:0;background:#fff}
}

/* ── thiết kế ── */
.hsp a{color:var(--pri)}
.hsp .doc{padding:18pt 0;font-family:"Be Vietnam Pro",system-ui,sans-serif;color:var(--ink);font-size:10.5pt;line-height:1.5;-webkit-font-smoothing:antialiased}
.hsp .mono{font-family:"IBM Plex Mono",monospace}
.hsp .one{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0}
.hsp .hd{display:flex;justify-content:space-between;align-items:center;font-size:9pt;color:var(--ink3);padding-bottom:8pt;border-bottom:1px solid var(--bd);font-family:"Be Vietnam Pro",sans-serif}
.hsp .hd .br{display:flex;align-items:center;gap:7pt;font-weight:700;color:var(--ink);font-size:10pt}
.hsp .hd .br i{width:14pt;height:14pt;border-radius:4pt;background:var(--pri);display:block;position:relative}
.hsp .hd .br i::after{content:"";position:absolute;inset:4pt;border-radius:99px;background:var(--acc)}
.hsp .ft{display:flex;justify-content:space-between;font-size:8.5pt;color:var(--ink3);padding-top:8pt;border-top:1px solid var(--bd);font-family:"Be Vietnam Pro",sans-serif}
.hsp .slot{position:relative;border-radius:6pt;overflow:hidden;background:repeating-linear-gradient(135deg,hsl(220 16% 94%),hsl(220 16% 94%) 5px,hsl(220 16% 90%) 5px,hsl(220 16% 90%) 10px)}
.hsp .slot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.hsp .slot .ph{position:absolute;inset:0;display:grid;place-items:center;font-size:8.5pt;font-weight:500;color:hsl(220 9% 46% / .8)}
.hsp .band{border-radius:8pt;padding:9pt 14pt;margin-bottom:14pt;display:flex;gap:10pt;align-items:center;font-size:10pt;break-inside:avoid}
.hsp .band b{font-size:10.5pt;white-space:nowrap}
.hsp .band span{min-width:0}
.hsp .band.draft{background:var(--acc-50);border:1px solid hsl(43 80% 82%);color:var(--ink2)}
.hsp .band.draft .dot{background:var(--acc)}
.hsp .band.err{background:var(--err-50);border:1px solid hsl(0 70% 88%);color:var(--ink2)}
.hsp .band.err b{color:var(--err)}.hsp .band.err .dot{background:var(--err)}
.hsp .band .dot{width:8pt;height:8pt;border-radius:99px;flex:none}
/* cover */
.hsp .cov{position:relative;overflow:hidden;border-radius:14pt;background:var(--pri-d);color:#fff;padding:22pt 22pt 22pt 24pt;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20pt;align-items:center;break-inside:avoid}
.hsp .cov::before{content:"";position:absolute;inset:0;background-image:radial-gradient(hsl(152 40% 60% / .22) 1px,transparent 1.2px);background-size:12px 12px;-webkit-mask-image:linear-gradient(100deg,#000 0%,transparent 55%);mask-image:linear-gradient(100deg,#000 0%,transparent 55%)}
.hsp .cov::after{content:"";position:absolute;width:260pt;height:260pt;border-radius:50%;right:-80pt;top:-120pt;background:radial-gradient(circle,hsl(152 50% 40% / .55),transparent 65%)}
.hsp .cov>*{position:relative;z-index:1}
.hsp .cov .eb{display:inline-flex;align-items:center;gap:6pt;font-size:8.5pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--pri-d);background:var(--acc);border-radius:99px;padding:3pt 10pt}
.hsp .cov h1{margin:10pt 0 14pt;font-size:20pt;line-height:1.22;letter-spacing:-.02em;font-weight:700;color:#fff}
.hsp .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8pt;margin:0}
.hsp .facts div{background:hsl(152 40% 100% / .08);border:1px solid hsl(152 40% 100% / .14);border-radius:7pt;padding:6pt 9pt;min-width:0}
.hsp .facts small{display:block;font-size:8pt;letter-spacing:.05em;text-transform:uppercase;color:hsl(152 30% 78%)}
.hsp .facts b{font-size:10pt;font-weight:600}
.hsp .cov .pic{display:grid;gap:6pt}
.hsp .cov .main{aspect-ratio:4/3;border:3pt solid #fff;border-radius:9pt;box-shadow:0 10pt 24pt hsl(152 60% 5% / .35)}
.hsp .cov .th{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:6pt}
.hsp .cov .th.n1{--n:1}.hsp .cov .th.n2{--n:2}.hsp .cov .th.n3{--n:3}.hsp .cov .th.n4{--n:4}
.hsp .cov .th .slot{aspect-ratio:4/3;border:2pt solid hsl(0 0% 100% / .85)}
.hsp .cov .th.n1 .slot{aspect-ratio:2/1}
/* key numbers */
.hsp .kn{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8pt;margin:14pt 0 4pt;break-inside:avoid}
.hsp .kn>div{border-radius:9pt;padding:9pt 12pt;background:var(--bg);min-width:0;display:flex;flex-direction:column;gap:3pt}
.hsp .kn>div:first-child{background:var(--pri-50)}
.hsp .kn small{font-size:8pt;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.hsp .kn b{font-size:11pt;font-weight:700;font-variant-numeric:tabular-nums}
.hsp .kn>div:first-child b{font-size:14pt;color:var(--pri)}
.hsp .kn b.one{white-space:normal;overflow:visible}
.hsp .kn b.mu{color:var(--ink3)!important;font-weight:500;font-size:11pt!important}
.hsp .kn.e{display:block}
/* sections */
.hsp .sec{margin-top:22pt}
.hsp .sh{display:flex;align-items:center;gap:10pt;margin-bottom:10pt;break-after:avoid}
.hsp .sh .n{width:22pt;height:22pt;border-radius:7pt;background:var(--pri);color:#fff;display:grid;place-items:center;font:600 9pt/1 "IBM Plex Mono",monospace;flex:none}
.hsp .sh h2{margin:0;font-size:13pt;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.hsp .sh .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--bd2),transparent)}
.hsp .sh .aux{font-size:9pt;color:var(--ink3);white-space:nowrap}
.hsp .desc{margin:0 0 10pt;color:var(--ink2);max-width:64ch;padding-left:12pt;position:relative;white-space:pre-line}
.hsp .desc::before{content:"";position:absolute;left:0;top:3pt;width:4pt;height:4pt;border-radius:99px;background:var(--acc);box-shadow:0 8pt 0 var(--pri-100),0 16pt 0 var(--pri-100)}
.hsp .specs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6pt}
.hsp .specs div{padding:6pt 10pt;border-radius:7pt;background:var(--bg);break-inside:avoid;min-width:0}
.hsp .specs small{font-size:8.5pt;color:var(--ink3)}
.hsp .specs b{font-weight:600;font-size:10.5pt}
.hsp .tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:10pt;border:1px solid var(--bd);border-radius:9pt;overflow:hidden}
.hsp .tbl th{text-align:left;font-size:8.5pt;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;padding:6pt 10pt;background:var(--bg);border-bottom:1px solid var(--bd);white-space:nowrap}
.hsp .tbl td{padding:7pt 10pt;border-bottom:1px solid var(--bd);vertical-align:middle}
.hsp .tbl tr:last-child td{border-bottom:0}
.hsp .tbl tr{break-inside:avoid}
.hsp .tbl td.k{font-weight:600;width:34%}
.hsp .tbl td.n{color:var(--ink2)}
.hsp .tbl td .note{display:block;font-size:8.5pt;color:var(--ink3)}
.hsp .vt{display:inline-flex;align-items:center;gap:4pt;font-size:8.5pt;font-weight:600;white-space:nowrap;padding:2pt 8pt;border-radius:99px}
.hsp .vt.ok{color:var(--ok);background:var(--pri-50)}.hsp .vt.me{color:var(--me);background:var(--me-50)}.hsp .vt.err{color:var(--err);background:var(--err-50)}.hsp .vt.mu{color:var(--ink3);background:var(--bg)}
.hsp .concl{display:flex;flex-wrap:wrap;gap:4pt 16pt;margin-top:8pt;font-size:9.5pt;color:var(--ink2)}
.hsp .decl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6pt;margin-bottom:8pt;break-inside:avoid}
.hsp .decl div{border:1px solid var(--bd);border-radius:7pt;padding:6pt 9pt;display:flex;align-items:center;gap:7pt;min-width:0}
.hsp .decl i{width:14pt;height:14pt;border-radius:99px;background:var(--pri-50);color:var(--ok);display:grid;place-items:center;font-style:normal;font-size:8pt;font-weight:700;flex:none}
.hsp .decl i.err{background:var(--err-50);color:var(--err)}.hsp .decl i.mu{background:var(--bg);color:var(--ink3)}
.hsp .decl span{min-width:0}
.hsp .decl small{font-size:8.5pt;color:var(--ink3)}
.hsp .decl b{font-size:10pt}
.hsp .sig{display:flex;gap:10pt;align-items:center;background:var(--pri-50);border-radius:7pt;padding:7pt 12pt;font-size:9.5pt;color:var(--ink2);margin-bottom:12pt;white-space:nowrap;overflow:hidden}
.hsp .sig i{width:16pt;height:16pt;border-radius:99px;background:var(--pri);color:#fff;display:grid;place-items:center;font-style:normal;font-size:9pt;flex:none}
.hsp .sig b{color:var(--pri-d)}
.hsp .sub{font-size:8.5pt;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin:0 0 6pt}
/* nhãn "Giấy tờ đính kèm" không được mồ côi ở cuối trang */
.hsp .docs{break-inside:avoid}
.hsp .files{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6pt}
.hsp .file{display:flex;gap:9pt;align-items:center;border:1px solid var(--bd);border-radius:7pt;padding:6pt 9pt;break-inside:avoid;min-width:0}
.hsp .file .fi{width:22pt;height:26pt;border-radius:3pt 7pt 3pt 3pt;background:var(--err-50);color:var(--err);font:600 6.5pt/1 "IBM Plex Mono",monospace;display:grid;place-items:end center;padding-bottom:4pt;flex:none}
.hsp .file>div{min-width:0}
.hsp .file .fn{font-size:9.5pt;font-weight:600}.hsp .file .fs{font-size:8.5pt;color:var(--ink3)}
.hsp .gal{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6pt}
.hsp .gal .slot{aspect-ratio:4/3}
.hsp .gal .slot.big{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}
.hsp .gal .miss{aspect-ratio:4/3;border:1px dashed var(--bd2);border-radius:6pt;display:grid;place-items:center;font-size:8.5pt;color:var(--ink3);text-align:center;background:var(--bg)}
.hsp .media{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8pt;margin-top:10pt}
.hsp .md{border-radius:9pt;overflow:hidden;border:1px solid var(--bd);break-inside:avoid;min-width:0}
.hsp .md .top{height:34pt;position:relative;background:var(--bg)}
.hsp .md .top::before{content:"";position:absolute;inset:0;background-image:radial-gradient(hsl(220 10% 60% / .25) 1px,transparent 1.2px);background-size:9px 9px}
.hsp .md.has.k3D .top{background:var(--pri-50)}.hsp .md.has.kVR .top{background:var(--blu-50)}.hsp .md.has.kGD .top{background:var(--acc-50)}
.hsp .md .badge{position:absolute;left:10pt;bottom:-12pt;width:26pt;height:26pt;border-radius:8pt;background:#fff;border:1px solid var(--bd);display:grid;place-items:center;font:600 8pt/1 "IBM Plex Mono",monospace;color:var(--ink3)}
.hsp .md.has.k3D .badge{background:var(--pri);color:#fff;border:0}.hsp .md.has.kVR .badge{background:var(--blu);color:#fff;border:0}.hsp .md.has.kGD .badge{background:var(--acc);color:var(--ink);border:0}
.hsp .md .qr{position:absolute;right:8pt;top:6pt;width:40pt;height:40pt;border-radius:4pt;background:#fff;border:1px solid var(--bd);display:grid;place-items:center;padding:3pt}
.hsp .md .bd{padding:16pt 10pt 8pt;min-width:0}
.hsp .md b{font-size:10pt}
.hsp .md span{font-size:8.5pt;color:var(--ink3)}
.hsp .md.has span{color:var(--ok)}
.hsp .qr svg{display:block;width:100%;height:100%}
/* empty in print */
.hsp .emp{border:1px dashed var(--bd2);border-radius:9pt;padding:12pt 14pt;display:flex;gap:12pt;align-items:center;color:var(--ink3);font-size:9.5pt;break-inside:avoid;background:linear-gradient(90deg,var(--bg),#fff 70%)}
.hsp .emp .ico{width:30pt;height:30pt;border-radius:99px;background:#fff;border:1px solid var(--bd);box-shadow:0 0 0 4pt var(--bg),0 0 0 5pt var(--bd);display:grid;place-items:center;flex:none;font:600 10pt/1 "IBM Plex Mono",monospace;color:var(--ink3);margin:0 4pt}
.hsp .emp>div{min-width:0}
.hsp .emp b{display:block;color:var(--ink);font-size:10.5pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* verify */
.hsp .ver{margin-top:24pt;position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16pt;align-items:center;background:var(--pri-50);border-radius:12pt;padding:14pt 16pt;break-inside:avoid}
.hsp .ver::before{content:"";position:absolute;right:0;top:0;bottom:0;width:50%;background-image:radial-gradient(hsl(152 40% 40% / .15) 1px,transparent 1.2px);background-size:10px 10px;-webkit-mask-image:linear-gradient(90deg,transparent,#000);mask-image:linear-gradient(90deg,transparent,#000)}
.hsp .ver>*{position:relative}
.hsp .ver p{margin:0 0 4pt;font-size:9pt;color:var(--ink2)}
.hsp .ver .code{font:600 10.5pt/1.4 "IBM Plex Mono",monospace;color:var(--pri-d)}
.hsp .ver .qr{width:58pt;height:58pt;border-radius:6pt;background:#fff;border:1px solid var(--pri-100);display:grid;place-items:center;padding:4pt}
`;
