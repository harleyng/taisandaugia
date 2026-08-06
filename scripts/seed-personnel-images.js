/**
 * SEED ảnh cho hồ sơ nhân sự — sinh bản chụp giấy tờ + ảnh chân dung demo.
 *
 * VÌ SAO PHẢI CHẠY TRONG TRÌNH DUYỆT: Supabase Storage chỉ nhận upload qua API
 * kèm phiên đăng nhập (RLS theo tổ chức). Migration SQL không đẩy được bytes,
 * nên phần này không tự động hoá bằng `db push` được.
 *
 * Ảnh sinh bằng canvas ngay tại chỗ — không tải gì từ ngoài, không phụ thuộc
 * mạng, và trông như một bản scan có tiêu đề/số hiệu thật.
 *
 * CÁCH DÙNG: mở app, đăng nhập harleyngx@gmail.com, vào /portal/nhan-su,
 * mở DevTools Console, dán toàn bộ file này rồi Enter. Chạy xong tải lại trang.
 *
 * Idempotent: giấy tờ đã có file_paths thì bỏ qua.
 */
(async function seedPersonnelImages() {
  const sb = window.__supabase ?? window.supabase;
  if (!sb) {
    console.error(
      '%cKhông tìm thấy Supabase client trên window.',
      'color:#b3261e;font-weight:bold',
      '\nDán đoạn này trước rồi chạy lại:\n' +
      "  const m = await import('/src/integrations/supabase/client.ts'); window.__supabase = m.supabase;",
    );
    return;
  }

  const NAVY = '#0a3d7a';
  const AMBER = '#c8901a';

  /** Vẽ một "bản scan" A4 dọc hoặc ngang, trả về Blob PNG. */
  function makeScan({ title, number, issuer, date, landscape }) {
    const W = landscape ? 1000 : 720;
    const H = landscape ? 720 : 1000;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    // Nền giấy hơi ngà + viền
    x.fillStyle = '#fbfcfe'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#d8dfe8'; x.lineWidth = 2; x.strokeRect(6, 6, W - 12, H - 12);

    // Dải tiêu đề
    x.fillStyle = NAVY; x.fillRect(6, 6, W - 12, 96);
    x.fillStyle = AMBER; x.fillRect(6, 98, W - 12, 5);

    x.fillStyle = '#ffffff';
    x.font = '600 15px "Be Vietnam Pro", system-ui, sans-serif';
    x.fillText('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', 34, 44);
    x.font = '400 12px system-ui, sans-serif';
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.fillText('Độc lập — Tự do — Hạnh phúc', 34, 70);

    // Tiêu đề giấy tờ
    x.fillStyle = '#101720';
    x.font = '600 26px Georgia, serif';
    wrap(x, title.toUpperCase(), 34, 168, W - 68, 34);

    // Khối thông tin
    x.font = '400 14px system-ui, sans-serif';
    let y = 268;
    for (const [k, v] of [['Số hiệu', number], ['Nơi cấp', issuer], ['Ngày cấp', date]]) {
      if (!v || v === '—') continue;
      x.fillStyle = '#6b7887'; x.fillText(k, 34, y);
      x.fillStyle = '#101720'; x.font = '500 14px system-ui, sans-serif';
      x.fillText(String(v), 180, y);
      x.font = '400 14px system-ui, sans-serif';
      x.strokeStyle = '#eef2f7'; x.beginPath();
      x.moveTo(34, y + 12); x.lineTo(W - 34, y + 12); x.stroke();
      y += 44;
    }

    // Vài dòng "chữ" giả cho ra dáng văn bản
    x.fillStyle = '#dde4ec';
    for (let i = 0; i < 9; i++) {
      const w = (W - 90) * (0.55 + Math.abs(Math.sin(i * 1.7)) * 0.42);
      x.fillRect(34, y + 22 + i * 26, w, 8);
    }

    // Dấu tròn mờ góc dưới phải
    x.strokeStyle = 'rgba(200,144,26,.5)'; x.lineWidth = 4;
    x.beginPath(); x.arc(W - 150, H - 150, 78, 0, Math.PI * 2); x.stroke();
    x.fillStyle = 'rgba(200,144,26,.5)';
    x.font = '600 13px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText('ĐÃ KÝ', W - 150, H - 145);
    x.textAlign = 'left';

    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  function wrap(ctx, text, x0, y0, maxW, lh) {
    const words = String(text).split(' ');
    let line = '', y = y0;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x0, y); line = w; y += lh; }
      else line = t;
    }
    if (line) ctx.fillText(line, x0, y);
  }

  /** Ảnh chân dung 3×4 dạng silhouette trên nền chuyển sắc. */
  function makePortrait(fullName) {
    const W = 600, H = 800;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#e8eef6'); g.addColorStop(1, '#cfdae8');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    x.fillStyle = '#8ea6c2';
    x.beginPath(); x.arc(W / 2, H * 0.36, 118, 0, Math.PI * 2); x.fill();
    x.beginPath();
    x.ellipse(W / 2, H * 0.92, 208, 196, 0, Math.PI, 0);
    x.fill();

    const initials = fullName.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
    x.fillStyle = '#ffffff';
    x.font = '600 84px Georgia, serif';
    x.textAlign = 'center';
    x.fillText(initials, W / 2, H * 0.40);
    x.textAlign = 'left';

    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  const uid = () => crypto.randomUUID();

  // ─── Lấy dữ liệu cần nạp ảnh ───────────────────────────────────────────────
  const { data: people, error: pe } = await sb
    .from('org_auctioneers')
    .select('id, organization_id, full_name, portrait_url');
  if (pe) { console.error('Không đọc được đấu giá viên:', pe.message); return; }
  if (!people?.length) { console.warn('Không có đấu giá viên nào.'); return; }

  const { data: docs, error: de } = await sb
    .from('org_auctioneer_documents')
    .select('id, auctioneer_id, organization_id, doc_type, title, doc_number, issuer, issued_date, file_paths');
  if (de) { console.error('Không đọc được giấy tờ:', de.message); return; }

  const LABELS = {
    DGV_CARD: 'Thẻ đấu giá viên', CCHN: 'Chứng chỉ hành nghề đấu giá',
    DEGREE: 'Bằng cấp', TRAINING_CERT: 'Chứng chỉ đào tạo nghề đấu giá',
    CRIMINAL_RECORD: 'Phiếu lý lịch tư pháp số 1', LABOR_CONTRACT: 'Hợp đồng lao động',
    PORTRAIT: 'Ảnh chân dung', OTHER: 'Giấy tờ khác',
  };
  const LANDSCAPE = new Set(['DGV_CARD', 'LABOR_CONTRACT']);

  let nDocs = 0, nPortraits = 0, skipped = 0;

  // ─── Ảnh chân dung ─────────────────────────────────────────────────────────
  for (const p of people) {
    if (p.portrait_url) { skipped++; continue; }
    const blob = await makePortrait(p.full_name);
    const path = `${p.organization_id}/${p.id}/${uid()}.png`;
    const { error } = await sb.storage.from('personnel-portraits').upload(path, blob, {
      contentType: 'image/png', upsert: true,
    });
    if (error) { console.warn('Chân dung lỗi', p.full_name, error.message); continue; }
    const url = sb.storage.from('personnel-portraits').getPublicUrl(path).data.publicUrl;
    await sb.from('org_auctioneers').update({ portrait_url: url }).eq('id', p.id);
    nPortraits++;
  }

  // ─── Bản chụp giấy tờ ──────────────────────────────────────────────────────
  for (const d of docs ?? []) {
    if (d.file_paths?.length) { skipped++; continue; }
    const blob = await makeScan({
      title: d.title || LABELS[d.doc_type] || 'Giấy tờ',
      number: d.doc_number,
      issuer: d.issuer,
      date: d.issued_date ? new Date(d.issued_date).toLocaleDateString('vi-VN') : '',
      landscape: LANDSCAPE.has(d.doc_type),
    });
    const path = `${d.organization_id}/${d.auctioneer_id}/${uid()}.png`;
    const { error } = await sb.storage.from('personnel-docs').upload(path, blob, {
      contentType: 'image/png',
    });
    if (error) { console.warn('Giấy tờ lỗi', d.doc_type, error.message); continue; }
    const { error: ue } = await sb
      .from('org_auctioneer_documents').update({ file_paths: [path] }).eq('id', d.id);
    if (ue) { console.warn('Cập nhật file_paths lỗi', d.id, ue.message); continue; }
    nDocs++;
  }

  console.log(
    '%c✓ Đã nạp ảnh hồ sơ nhân sự',
    'color:#16a34a;font-weight:bold',
    `\n  Ảnh chân dung: ${nPortraits}` +
    `\n  Bản chụp giấy tờ: ${nDocs}` +
    `\n  Bỏ qua (đã có ảnh): ${skipped}` +
    '\n  → Tải lại trang, rồi báo lại để siết ràng buộc VALIDATE ở DB.',
  );
})();
