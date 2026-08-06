/**
 * SEED localStorage cho Hồ sơ năng lực — CTĐG Hải Phòng (demo).
 *
 * VÌ SAO PHẢI CHẠY TAY: 4 module Thông tin chung / Cơ sở vật chất / Lịch sử
 * đấu giá / Tài chính & Thuế vẫn lưu ở localStorage của trình duyệt, không nằm
 * trong Supabase, nên migration SQL không chạm tới được. Riêng Đấu giá viên và
 * Hồ sơ nhân sự đã ở DB rồi (migration 20260805000060) — script này KHÔNG đụng
 * vào chúng.
 *
 * CÁCH DÙNG: mở app, đăng nhập harleyngx@gmail.com, mở DevTools Console,
 * dán toàn bộ file này rồi Enter. Xong thì tải lại trang.
 *
 * Tên đấu giá viên trong `tsd:auction-records` khớp CHÍNH XÁC với dữ liệu đã
 * seed ở DB, để nút "Nạp từ Lịch sử đấu giá" trong hồ sơ nhân sự có việc để làm.
 */
(function seedPortalDemo() {
  const now = new Date().toISOString();
  const uid = () => crypto.randomUUID();
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  // ─── 1. Thông tin chung ────────────────────────────────────────────────────
  const generalInfo = {
    id: uid(),
    name: 'Chi nhánh Công ty Đấu giá Hợp danh Việt Nam tại Hải Phòng',
    shortName: 'ĐGVN Hải Phòng',
    orgType: 'CONG_TY_HOP_DANH',
    taxCode: '0201234567-001',
    registrationCode: '02-CN/ĐGTS',
    logoInitials: 'HP',
    brandColor: '#0a3d7a',
    address: 'Số 168 đường Lạch Tray',
    ward: 'Phường Đằng Giang',
    district: 'Quận Ngô Quyền',
    province: 'Thành phố Hải Phòng',
    phone: '02253736888',
    alternativePhone: '02253736889',
    fax: '02253736890',
    email: 'chinhanh.haiphong@dgvn.vn',
    website: 'https://dgvn-haiphong.vn',
    legalRepName: 'Nguyễn Quang Đại',
    legalRepPosition: 'Giám đốc chi nhánh',
    legalRepIdNumber: '031075001234',
    legalRepIdIssuedDate: '2021-05-18',
    legalRepIdIssuedPlace: 'Cục Cảnh sát QLHC về TTXH',
    foundedDate: '2011-04-01',
    establishmentDecisionNumber: '412/QĐ-STP',
    establishmentDecisionDate: '2011-03-22',
    establishmentDecisionIssuer: 'Sở Tư pháp thành phố Hải Phòng',
    businessLicenseNumber: '0201234567-001',
    businessLicenseDate: '2011-03-28',
    businessLicenseIssuer: 'Sở Kế hoạch và Đầu tư TP Hải Phòng',
    isListedInMOJDirectory: true,
    mojListingNotes: 'Có tên trong danh sách tổ chức đấu giá tài sản do Bộ Tư pháp công bố.',
    bankAccounts: [
      {
        id: uid(),
        bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN Hải Phòng',
        accountNumber: '0031000123456',
        accountHolder: 'Chi nhanh Cong ty Dau gia Hop danh Viet Nam tai Hai Phong',
        branch: 'Hải Phòng',
        isPrimary: true,
      },
      {
        id: uid(),
        bankName: 'Ngân hàng TMCP Công Thương Việt Nam (VietinBank) - CN Hồng Bàng',
        accountNumber: '102876543210',
        accountHolder: 'Chi nhanh Cong ty Dau gia Hop danh Viet Nam tai Hai Phong',
        branch: 'Hồng Bàng',
        isPrimary: false,
      },
    ],
    branches: [
      {
        id: uid(),
        name: 'Văn phòng đại diện Thuỷ Nguyên',
        type: 'REP_OFFICE',
        address: 'Số 25 đường Bạch Đằng, thị trấn Núi Đèo',
        province: 'Thành phố Hải Phòng',
        phone: '02253642100',
        managerName: 'Trần Thị Bích Ngọc',
        isActive: true,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  // ─── Lịch sử đấu giá: ĐÃ CHUYỂN SANG SUPABASE ─────────────────────────────
  // 30 cuộc đấu giá nay nằm ở bảng org_auction_records, seed bằng migration
  // 20260805000211_seed_auction_records.sql và liên kết người điều hành bằng
  // FK auctioneer_id. Không ghi vào localStorage nữa: key tsd:auction-records
  // là kho CHẾT — không nơi nào ghi và trang Lịch sử đấu giá không đọc nó.

  // ─── 3. Tài chính & Thuế ───────────────────────────────────────────────────
  const taxRecords = [
    {
      id: uid(), year: 2025, recordType: 'CIT', amount: 1420000000,
      vatExcluded: true, isFinalized: true, finalizedDate: '2026-03-28',
      supportingDocuments: [], notes: 'Quyết toán thuế TNDN năm 2025 đã nộp.',
      isDeleted: false, createdAt: now, updatedAt: now, scoreContribution: 3,
    },
    {
      id: uid(), year: 2025, recordType: 'NSNN', amount: 386000000,
      vatExcluded: true, isFinalized: true, finalizedDate: '2026-01-15',
      supportingDocuments: [], notes: 'Các khoản nộp ngân sách khác năm 2025.',
      isDeleted: false, createdAt: now, updatedAt: now, scoreContribution: 0,
    },
    {
      id: uid(), year: 2024, recordType: 'CIT', amount: 1105000000,
      vatExcluded: true, isFinalized: true, finalizedDate: '2025-03-30',
      supportingDocuments: [], isDeleted: false,
      createdAt: now, updatedAt: now, scoreContribution: 3,
    },
  ];

  localStorage.setItem('tsd:general-info', JSON.stringify(generalInfo));
  localStorage.setItem('tsd:tax-records', JSON.stringify(taxRecords));
  localStorage.setItem('tsd:org-tax-code', '0201234567-001');

  // Cơ sở vật chất CỐ Ý bỏ trống: cấu trúc lồng sâu kèm bộ tính điểm riêng,
  // dựng JSON bằng tay dễ làm hỏng module. Code đã tự tạo bản mặc định khi
  // thiếu (createDefaultInfrastructure) — vào màn đó điền qua form là chuẩn nhất.

  console.log(
    '%c✓ Đã seed localStorage',
    'color:#16a34a;font-weight:bold',
    `\n  Thông tin chung: 1 tổ chức, ${generalInfo.bankAccounts.length} tài khoản NH, ${generalInfo.branches.length} chi nhánh` +
    `\n  Tài chính & Thuế: ${taxRecords.length} bản ghi` +
    '\n  → Tải lại trang để thấy dữ liệu.',
  );
})();
