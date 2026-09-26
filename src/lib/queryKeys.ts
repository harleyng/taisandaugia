// Nguồn DUY NHẤT cho các query key dùng ở NHIỀU file.
//
// Vì sao cần: `invalidateQueries` không bao giờ báo lỗi. Gõ sai một ký tự, hay
// thêm một segment vào key đọc mà quên sửa key invalidate, thì mutation vẫn
// "thành công", toast vẫn xanh, chỉ có UI là hiện dữ liệu cũ. Không stack trace,
// không log — loại bug đắt nhất để lần ra.
//
// PHẠM VI: chỉ gom những key xuất hiện ở ≥2 file. Key mà cả chỗ đọc lẫn chỗ
// invalidate nằm trong CÙNG một hook thì để nguyên tại đó — chúng không có rủi
// ro lệch giữa các file, và kéo vào đây chỉ làm file này phình ra vô ích.
//
// ─── LUẬT PREFIX (TanStack Query v5) ────────────────────────────────────────
// invalidateQueries({ queryKey: A }) làm mới MỌI query có key bắt đầu bằng A.
// Nên thứ tự segment quyết định đúng/sai:
//
//   ✅ ["x", id]  và  ["x", id, "public"]   → invalidate ["x", id] phủ cả hai
//   ❌ ["x", id]  và  ["x", "public", id]   → invalidate ["x", id] KHÔNG phủ
//
// Biến thể hẹp hơn phải nằm SAU tham số, không đứng trước.

export const qk = {
  // ─── Người dùng & phân quyền ─────────────────────────────────────────────
  profile: {
    all: ["profile"] as const,
    byUser: (userId?: string | null) => ["profile", userId] as const,
  },
  profileSearch: (term: string) => ["profile_search", term] as const,
  userCredits: {
    all: ["user-credits"] as const,
    byUser: (userId?: string | null) => ["user-credits", userId] as const,
  },
  isAdmin: (userId?: string | null) => ["is-admin", userId] as const,
  adminUsers: {
    all: ["admin-users"] as const,
  },
  adminPermissions: {
    all: ["admin-permissions"] as const,
    byUser: (userId?: string | null) => ["admin-permissions", userId] as const,
  },
  /** Hàng chờ duyệt tài sản (admin). Tham số đứng SAU nên `all` phủ cả chi tiết. */
  adminAssetPostings: {
    all: ["admin-asset-postings"] as const,
    byId: (id?: string | null) => ["admin-asset-postings", id] as const,
  },

  // ─── Ký gửi tài sản (chủ tài sản ↔ tổ chức đấu giá) ──────────────────────
  // Giữ NGUYÊN chuỗi đang dùng trước khi gom về đây để cache không tách đôi.
  myPostings: (userId?: string | null) => ["my-postings", userId] as const,
  /** Danh sách hồ sơ của MỘT tenant ("personal" hoặc workspaceId) — myPostings(userId) là prefix. */
  myPostingsIn: (userId: string | null | undefined, tenantKey: string | null) =>
    ["my-postings", userId, tenantKey] as const,
  /** Hồ sơ + chuỗi ký gửi / phiên / HĐ mua bán cho "Đường ống" (Phase 12) — nằm DƯỚI
   *  myPostings nên mọi thao tác trên hồ sơ invalidate myPostings(userId) là đủ. */
  ownerPipelinePostings: (userId: string | null | undefined, tenantKey: string | null) =>
    ["my-postings", userId, tenantKey, "pipeline"] as const,
  postingDetail: (id?: string | null) => ["posting-detail", id] as const,
  consignment: {
    orgRequests: (auctionOrgId?: string | null) => ["org-service-requests", auctionOrgId] as const,
    orgCounts: (auctionOrgId?: string | null) => ["org-service-request-counts", auctionOrgId] as const,
    orgContract: (requestId?: string | null) => ["org-consignment-contract", requestId] as const,
    postingContracts: (postingId?: string | null) => ["posting-contracts", postingId] as const,
    /** Địa chỉ Bên A của MỘT hồ sơ (cá nhân ⇒ KYC cá nhân; không gian ⇒ KYC tổ chức). */
    partyAddress: (postingId?: string | null) => ["posting-party-address", postingId] as const,
    ownerSummary: (userId?: string | null) => ["owner-consignment-summary", userId] as const,
    ownerSummaryIn: (userId: string | null | undefined, tenantKey: string | null) =>
      ["owner-consignment-summary", userId, tenantKey] as const,
  },

  /** Model 3D của hồ sơ số hoá. `all` phủ mọi key con — webhook/duyệt đổi trạng
   *  thái ở server nên invalidate cả nhánh cho gọn. Lô công khai là prefix riêng. */
  asset3d: {
    all: ["asset-3d-scans"] as const,
    byPosting: (postingId?: string | null) => ["asset-3d-scans", "posting", postingId] as const,
    /** Theo user vì RLS quyết định tập dòng (chủ: của mình · admin: tất cả). */
    readyIds: (userId?: string | null) => ["asset-3d-scans", "ready", userId] as const,
    sessionLots: (sessionId?: string | null) => ["lot-3d-models", sessionId] as const,
  },

  // ─── Yêu cầu dịch vụ (menu gộp: tư vấn pháp lý/đấu giá, giám định, VR) ─────
  serviceRequests: {
    /** Dòng hoa hồng đối tác trong sổ orders — chung cho mọi loại. */
    commission: (orderId?: string | null) => ["service-requests", "commission", orderId] as const,
  },

  // ─── VR tour (đơn dịch vụ đối tác theo hồ sơ số hoá) ─────────────────────
  vrTour: {
    all: ["vr-tour-orders"] as const,
    byPosting: (postingId?: string | null) => ["vr-tour-orders", "posting", postingId] as const,
    detail: (orderId?: string | null) => ["vr-tour-orders", "detail", orderId] as const,
    /** Theo user vì RLS quyết định tập dòng (chủ: của mình · admin: tất cả). */
    attachedIds: (userId?: string | null) => ["vr-tour-orders", "attached", userId] as const,
    adminList: ["vr-tour-orders", "admin-list"] as const,
    catalog: ["vr-tour-catalog"] as const,
    sessionLots: (sessionId?: string | null) => ["lot-vr-tours", sessionId] as const,
  },

  authentication: {
    all: ["authentication-orders"] as const,
    byPosting: (postingId?: string | null) => ["authentication-orders", "posting", postingId] as const,
    detail: (orderId?: string | null) => ["authentication-orders", "detail", orderId] as const,
    state: (postingId?: string | null) => ["authentication-orders", "state", postingId] as const,
    /** Theo user vì RLS quyết định tập dòng (chủ: của mình · admin: tất cả). */
    authenticIds: (userId?: string | null) => ["authentication-orders", "authentic", userId] as const,
    adminList: ["authentication-orders", "admin-list"] as const,
    catalog: ["authentication-catalog"] as const,
    /** Chính sách + cờ hạn chế của CHÍNH người dùng (wizard báo "Bắt buộc"). */
    rules: (userId?: string | null) => ["authentication-rules", userId] as const,
    policy: ["authentication-policy"] as const,
    sellerRestrictions: ["authentication-seller-restrictions"] as const,
    sessionLots: (sessionId?: string | null) => ["lot-authentications", sessionId] as const,
  },

  legalConsult: {
    all: ["legal-consultations"] as const,
    byPosting: (postingId?: string | null) => ["legal-consultations", "posting", postingId] as const,
    detail: (id?: string | null) => ["legal-consultations", "detail", id] as const,
    items: (id?: string | null) => ["legal-consultations", "items", id] as const,
    adminList: ["legal-consultations", "admin-list"] as const,
    catalog: ["legal-consult-catalog"] as const,
  },

  auctionConsult: {
    all: ["auction-consultations"] as const,
    byPosting: (postingId?: string | null) => ["auction-consultations", "posting", postingId] as const,
    detail: (id?: string | null) => ["auction-consultations", "detail", id] as const,
    proposal: (id?: string | null) => ["auction-consultations", "proposal", id] as const,
    adminList: ["auction-consultations", "admin-list"] as const,
    catalog: ["auction-consult-catalog"] as const,
    // Tiền tố riêng: quyết định của người bán không invalidate được cache của tổ chức (khác trình duyệt).
    sessionSuggestions: (sessionId?: string | null) => ["auction-consult-suggestions", sessionId] as const,
  },

  // ─── Tổ chức (cổng /portal) ──────────────────────────────────────────────
  myOrgs: {
    all: ["my-orgs"] as const,
    byUser: (userId?: string | null) => ["my-orgs", userId] as const,
  },
  orgMembers: (orgId?: string | null) => ["org-members", orgId] as const,
  orgRoles: (orgId?: string | null) => ["org-roles", orgId] as const,
  orgPermissions: {
    all: ["org-permissions"] as const,
    byTarget: (targetId?: string | null, userId?: string | null) =>
      ["org-permissions", targetId, userId] as const,
  },

  // ─── Phiên đấu giá ───────────────────────────────────────────────────────
  /** Portal (theo tổ chức) và công khai là HAI prefix khác nhau; mutation ở
   *  portal phải invalidate cả `public` vì công bố/huỷ đổi thứ trang sàn thấy. */
  auctionSessions: {
    byOrg: (orgId?: string | null) => ["auction-sessions", orgId] as const,
    byId: (id?: string | null) => ["auction-session", id] as const,
    public: ["public-auction-sessions"] as const,
    publicList: (includeEnded: boolean) =>
      ["public-auction-sessions", "list", includeEnded] as const,
    publicById: (id?: string | null) => ["public-auction-sessions", "detail", id] as const,
    publicByAuctionOrg: (auctionOrgId?: string | null) =>
      ["public-auction-sessions", "org", auctionOrgId] as const,
  },

  // ─── Hỏi đáp tài liệu phiên + hộp thư tổ chức ────────────────────────────
  /** Mọi thay đổi tài liệu / điều khoản invalidate `bySession` — phủ cả danh sách
   *  tài liệu ở portal lẫn điều khoản citable mà engine + trang công khai đọc. */
  caseQa: {
    bySession: (sessionId?: string | null) => ["case-qa", sessionId] as const,
    documents: (sessionId?: string | null) => ["case-qa", sessionId, "documents"] as const,
    citable: (sessionId?: string | null) => ["case-qa", sessionId, "citable"] as const,
    mine: (sessionId?: string | null, userId?: string | null) => ["case-qa", sessionId, "mine", userId] as const,
  },

  /** Hộp thư theo tổ chức: mọi mutation chỉ cần invalidate `all(org)`. */
  orgChat: {
    all: (orgId?: string | null) => ["org-chat", orgId] as const,
    inbox: (orgId: string | null | undefined, filter: string, channel: string | null, sessionId: string | null) =>
      ["org-chat", orgId, "inbox", filter, channel, sessionId] as const,
    thread: (orgId?: string | null, conversationId?: string | null) =>
      ["org-chat", orgId, "thread", conversationId] as const,
    counts: (orgId?: string | null) => ["org-chat", orgId, "counts"] as const,
    escalations: (orgId: string | null | undefined, scope: string) =>
      ["org-chat", orgId, "escalations", scope] as const,
    settings: (orgId?: string | null) => ["org-chat", orgId, "settings"] as const,
  },

  /** Hồ sơ tham gia đấu giá. Mọi key chung prefix nên mua / thanh toán / tổ chức
   *  cập nhật chỉ cần invalidate `all` là trang sàn, hồ sơ cá nhân và portal cùng
   *  làm mới. `mine` là prefix của `mineBySession`. */
  biddingContracts: {
    all: ["bidding-contracts"] as const,
    mine: (userId?: string | null) => ["bidding-contracts", "mine", userId] as const,
    mineBySession: (userId?: string | null, sessionId?: string | null) =>
      ["bidding-contracts", "mine", userId, sessionId] as const,
    summary: (sessionId?: string | null) => ["bidding-contracts", "summary", sessionId] as const,
    bySession: (sessionId?: string | null) => ["bidding-contracts", "session", sessionId] as const,
    byOrg: (orgId?: string | null) => ["bidding-contracts", "org", orgId] as const,
    byId: (id?: string | null) => ["bidding-contracts", "id", id] as const,
    /**
     * Lô mà các hồ sơ này đã trúng. `contractIds` được SẮP XẾP vào key để thứ tự
     * mảng đầu vào không sinh ra hai cache khác nhau cho cùng một tập hồ sơ.
     */
    wonLots: (userId?: string | null, contractIds: readonly string[] = []) =>
      ["bidding-contracts", "won", userId, [...contractIds].sort().join(",")] as const,
  },
  /** Danh tính đã xác thực qua VNeID — dữ liệu CÁ NHÂN, key theo userId. */
  verifiedIdentity: (userId?: string | null) => ["verified-identity", userId] as const,

  /** Đấu giá trực tuyến. Một lượt trả giá đổi CÙNG LÚC trạng thái lô, sổ trả
   *  giá và nhật ký, nên cả ba nằm dưới `all(sessionId)` để mutation chỉ phải
   *  invalidate một key. sessionId đứng TRƯỚC biến thể — xem LUẬT PREFIX. */
  bidding: {
    all: (sessionId?: string | null) => ["bidding", sessionId] as const,
    lotStates: (sessionId?: string | null) => ["bidding", sessionId, "lot-states"] as const,
    lotBids: (sessionId?: string | null, lotId?: string | null) =>
      ["bidding", sessionId, "lot-bids", lotId] as const,
    lotEvents: (sessionId?: string | null) => ["bidding", sessionId, "events"] as const,
    /** Phiên đã có lô rời trạng thái chờ chưa — quyết định khoá form quy tắc. */
    started: (sessionId?: string | null) => ["bidding", sessionId, "started"] as const,
    /** Kết quả từng lô cho TRANG CÔNG KHAI — query thường, không mở kênh realtime. */
    results: (sessionId?: string | null) => ["bidding", sessionId, "results"] as const,
    /** Biên bản đã phát hành. Cùng key cho org và khách — RLS quyết ai thấy gì. */
    minutes: (sessionId?: string | null) => ["bidding", sessionId, "minutes"] as const,
  },

  /** Hợp đồng mua bán tài sản đấu giá. Một lần thu tiền / huỷ đổi CÙNG LÚC hợp
   *  đồng, kỳ hạn, sổ tiền và trạng thái lô, nên mutation chỉ invalidate `all`.
   *  id đứng TRƯỚC biến thể — xem LUẬT PREFIX. */
  saleContracts: {
    all: ["sale-contracts"] as const,
    byOrg: (orgId?: string | null) => ["sale-contracts", "org", orgId] as const,
    byId: (id?: string | null) => ["sale-contracts", "id", id] as const,
    detail: (id?: string | null) => ["sale-contracts", "id", id, "detail"] as const,
    mine: (userId?: string | null) => ["sale-contracts", "mine", userId] as const,
    ownerMine: (userId?: string | null) => ["sale-contracts", "owner", userId] as const,
    /** Hợp đồng bên bán của MỘT tenant — ownerMine(userId) là prefix. */
    ownerMineIn: (userId: string | null | undefined, tenantKey: string | null) =>
      ["sale-contracts", "owner", userId, tenantKey] as const,
    counts: (orgId?: string | null) => ["sale-contracts", "counts", orgId] as const,
  },

  // ─── Khách hàng của tổ chức & tiếp thị phiên ─────────────────────────────
  /** Danh bạ riêng của tổ chức. byOrg là PREFIX của byId nên sửa khách rồi
   *  invalidate byOrg làm mới cả trang chi tiết. */
  orgContacts: {
    byOrg: (orgId?: string | null) => ["org-contacts", orgId] as const,
    byId: (orgId?: string | null, id?: string | null) => ["org-contacts", orgId, id] as const,
    /** Lịch sử tiếp thị của một khách — nằm SAU id nên byOrg / byId phủ được. */
    outreach: (orgId?: string | null, id?: string | null) => ["org-contacts", orgId, id, "outreach"] as const,
  },
  /** Gói tiếp thị của phiên: bySession là prefix của edits / sends. */
  sessionOutreach: {
    bySession: (sessionId?: string | null) => ["session-outreach", sessionId] as const,
    edits: (sessionId?: string | null) => ["session-outreach", sessionId, "edits"] as const,
    sends: (sessionId?: string | null) => ["session-outreach", sessionId, "sends"] as const,
  },
  outreachOrgInfo: (auctionOrgId?: string | null) => ["outreach-org-info", auctionOrgId] as const,
  orgContactGroups: (orgId?: string | null) => ["org-contact-groups", orgId] as const,
  /** Người nhận của một phiên — đổi khách, nhu cầu, nhóm HAY lô đều làm lệch,
   *  nên các mutation đó invalidate `all`. */
  sessionAudience: {
    all: ["session-audience"] as const,
    bySession: (sessionId?: string | null) => ["session-audience", sessionId] as const,
    /** groupKey = id nhóm đã sort + nối "," ("" = không lọc nhóm). */
    list: (sessionId?: string | null, groupKey = "") => ["session-audience", sessionId, groupKey] as const,
  },

  // ─── Hồ sơ năng lực ──────────────────────────────────────────────────────
  auctioneers: (organizationId?: string | null) => ["auctioneers", organizationId] as const,
  personnel: {
    /** Hồ sơ một đấu giá viên. Là PREFIX của documents/events/cpdExemptions
     *  bên dưới, nên invalidate ở đây làm mới toàn bộ hồ sơ đó. */
    byAuctioneer: (auctioneerId?: string | null) => ["personnel", auctioneerId] as const,
    documents: (auctioneerId?: string | null) =>
      ["personnel", auctioneerId, "documents"] as const,
    events: (auctioneerId?: string | null) => ["personnel", auctioneerId, "events"] as const,
    cpdExemptions: (auctioneerId?: string | null) =>
      ["personnel", auctioneerId, "cpd-exemptions"] as const,
  },

  /** Danh mục bồi dưỡng (master data admin). Một key duy nhất, không tham số:
   *  ba bảng nhỏ luôn được nạp cùng nhau nên tách key chỉ tạo cơ hội lệch. */
  cpdCatalog: ["cpd-catalog"] as const,

  /** Tủ tài liệu — dữ liệu THUỘC TỔ CHỨC nên key luôn mang organizationId; nếu
   *  thiếu, đổi tổ chức sẽ đọc lại cache của tổ chức trước. */
  orgDocuments: {
    folders: (organizationId?: string | null) =>
      ["org-document-folders", organizationId] as const,
    list: (organizationId?: string | null) => ["org-documents", organizationId] as const,
  },

  // ─── Hồ sơ năng lực đã di trú khỏi localStorage ───────────────────────────
  // Tất cả đều mang organizationId vì là dữ liệu thuộc tổ chức.
  orgTaxRecords: (organizationId?: string | null) => ["org-tax-records", organizationId] as const,
  orgGeneralInfo: (organizationId?: string | null) =>
    ["org-general-info", organizationId] as const,
  orgInfrastructure: (organizationId?: string | null) =>
    ["org-infrastructure", organizationId] as const,
  /** Điểm năng lực tổng hợp — nhiều module ghi vào (thuế, đấu giá viên, cơ sở
   *  vật chất), nên mỗi nơi sửa phải invalidate đúng key này. */
  orgCapacityProfile: (organizationId?: string | null) =>
    ["org-capacity-profile", organizationId] as const,
  orgApplications: {
    list: (organizationId?: string | null) => ["org-applications", organizationId] as const,
    detail: (id?: string | null) => ["org-application", id] as const,
  },
  /** Gói theo dõi nhu cầu — dữ liệu CÁ NHÂN, key theo userId. */
  demandSubscription: (userId?: string | null) => ["demand-subscription", userId] as const,

  // ─── Danh bạ tổ chức đấu giá (công khai) ─────────────────────────────────
  auctionOrg: (id?: string | null) => ["auction-org", id] as const,
  auctionOrganizationsList: ["auction-organizations-list"] as const,

  // ─── Chủ tài sản ─────────────────────────────────────────────────────────
  ownerPortfolioClaims: (workspaceId?: string | null) =>
    ["owner-portfolio-claims", workspaceId] as const,
  /** RPC owner_asset_outcomes_resolved — mọi thao tác khai/sửa kết quả phải invalidate key này. */
  ownerAssetOutcomes: (workspaceId?: string | null) =>
    ["owner-asset-outcomes", workspaceId] as const,
  /** Các lượt đơn vị đã tự khai cho một tin (bảng owner_asset_outcomes). */
  ownerOutcomeRounds: (workspaceId?: string | null, listingId?: string | null) =>
    ["owner-outcome-rounds", workspaceId, listingId] as const,
  /** "Kết quả phiên" — RPC owner_outcomes_overview (Phase 8). Nằm DƯỚI ownerAssetOutcomes
   *  nên mọi mutation khai / sửa kết quả invalidate key đó là đủ. */
  ownerOutcomesOverview: (workspaceId?: string | null) =>
    ["owner-asset-outcomes", workspaceId, "overview"] as const,
  /** Các lượt tự khai của MỘT tài sản (assetKey = row_key "l:<listing>" / "t:<title_key>"). */
  ownerOutcomeHistory: (workspaceId?: string | null, assetKey?: string | null) =>
    ["owner-asset-outcomes", workspaceId, "history", assetKey] as const,
  /** "Dòng tiền" — RPC owner_cash_flow (Phase 15a). Nằm DƯỚI ownerAssetOutcomes nên mọi
   *  thao tác khai kết quả / ghi thu chi đã invalidate key đó là đủ. */
  ownerCashFlow: (workspaceId?: string | null, includeLinked = true) =>
    ["owner-asset-outcomes", workspaceId, "cash-flow", includeLinked] as const,
  /** Số đã thu của các bản ghi tự khai (thẻ "Chờ thu tiền" ở Nhịp đập) — mọi thao tác thu tiền invalidate key này. */
  ownerOutcomePayments: (workspaceId?: string | null) =>
    ["owner-outcome-payments", workspaceId] as const,
  /** Chỉ tiêu của không gian (bảng owner_workspace_targets) — Phase 9. */
  ownerTargets: (workspaceId?: string | null) => ["owner-targets", workspaceId] as const,
  /** Danh sách báo cáo định kỳ của không gian (bảng owner_report_snapshots) — Phase 10. */
  ownerReports: (workspaceId?: string | null) => ["owner-reports", workspaceId] as const,
  /** MỘT báo cáo, tra theo id (quyền xét theo không gian của chính báo cáo, không theo
   *  không gian đang chọn) ⇒ không nằm dưới ownerReports: mutation invalidate cả hai. */
  ownerReport: (reportId?: string | null) => ["owner-report", reportId] as const,
  /** Token link chia sẻ của MỘT báo cáo (RPC owner_report_share_link, chỉ Trưởng đơn vị) —
   *  Phase 11. Nằm DƯỚI ownerReport nên invalidate báo cáo là làm mới luôn link. */
  ownerReportShareLink: (reportId?: string | null) => ["owner-report", reportId, "share-link"] as const,
  /** Trang công khai /r/:token (RPC get_shared_owner_report — mỗi lần gọi là một lượt xem). */
  sharedOwnerReport: (token?: string | null) => ["shared-owner-report", token] as const,
  /** Số liệu SỐNG của bản nháp (RPC owner_build_report_payload). Nằm DƯỚI ownerAssetOutcomes
   *  nên mọi thao tác khai / sửa kết quả / thu tiền đã invalidate luôn bản xem trước. */
  ownerReportPreview: (
    workspaceId?: string | null,
    periodType?: string | null,
    periodStart?: string | null,
    branchId?: string | null,
  ) => ["owner-asset-outcomes", workspaceId, "report-preview", periodType, periodStart, branchId] as const,
  /** Không gian chủ tài sản (thành viên, lời mời, claims) — Phase 3. */
  ownerWorkspace: {
    /** Các không gian mà người dùng là thành viên đang hoạt động (kèm dòng workspace). */
    memberships: (userId?: string | null) => ["owner-ws-memberships", userId] as const,
    /** Người dùng có tenant "Cá nhân" không (KYC cá nhân đã duyệt / còn hồ sơ cá nhân) — Phase 4. */
    personalTenant: (userId?: string | null) => ["owner-personal-tenant", userId] as const,
    /** Mọi dữ liệu của MỘT không gian — invalidate key này phủ cả các nhánh dưới. */
    all: (workspaceId?: string | null) => ["owner-ws", workspaceId] as const,
    members: (workspaceId?: string | null) => ["owner-ws", workspaceId, "members"] as const,
    invites: (workspaceId?: string | null) => ["owner-ws", workspaceId, "invites"] as const,
    claims: (workspaceId?: string | null) => ["owner-ws", workspaceId, "claims"] as const,
    /** Liên kết trụ sở ↔ chi nhánh của một Trạm (RPC owner_ws_link_overview) — Phase 14. */
    linkOverview: (workspaceId?: string | null) => ["owner-ws", workspaceId, "link-overview"] as const,
    /** Số yêu cầu liên kết đang chờ Trạm này trả lời (huy hiệu nav). */
    linkRequests: (workspaceId?: string | null) => ["owner-ws", workspaceId, "link-requests"] as const,
    /** So sánh ẩn danh với các chi nhánh cùng hệ thống (RPC owner_ws_benchmark). */
    benchmark: (workspaceId?: string | null) => ["owner-ws", workspaceId, "benchmark"] as const,
  },

  // ─── CRM ─────────────────────────────────────────────────────────────────
  leads: {
    all: ["leads"] as const,
  },
  customers: {
    all: ["customers"] as const,
  },
  opportunities: {
    all: ["opportunities"] as const,
    byLead: (leadId?: string | null) => ["opportunities", "by-lead", leadId] as const,
    byCustomer: (customerId?: string | null) =>
      ["opportunities", "by-customer", customerId] as const,
  },
  orders: {
    all: ["orders"] as const,
    byCustomer: (customerId?: string | null) => ["orders", "by-customer", customerId] as const,
    /** Prefix dùng để invalidate cả nhóm khi không biết customerId nào đổi. */
    byCustomerUserAll: ["orders", "by-customer-user"] as const,
    byCustomerUser: (customerId?: string | null, userId?: string | null) =>
      ["orders", "by-customer-user", customerId, userId ?? null] as const,
    byAdvertisement: (advertisementId?: string | null) =>
      ["orders", "by-advertisement", advertisementId] as const,
    bySupplier: (supplierId?: string | null) => ["orders", "by-supplier", supplierId] as const,
  },

  /** Hợp đồng hợp tác với đối tác. Tham số đứng SAU nên `all` phủ cả chi tiết. */
  supplierContracts: {
    all: ["supplier-contracts"] as const,
    bySupplier: (supplierId?: string | null) =>
      ["supplier-contracts", supplierId] as const,
  },
  /** Điều khoản hoa hồng đang hiệu lực, tra theo (đối tác, dịch vụ, biến thể, ngày). */
  contractTerms: (
    supplierId?: string | null,
    serviceId?: string | null,
    variantId?: string | null,
    at?: string | null,
  ) => ["contract-terms", supplierId, serviceId, variantId ?? null, at ?? null] as const,

  // ─── Dịch vụ & giá ───────────────────────────────────────────────────────
  services: {
    all: ["services"] as const,
  },
  /** Bảng giá biến thể — nguồn giá của toàn app, đọc ở nhiều nơi. */
  serviceCatalog: ["service-catalog"] as const,

  // ─── Marketing ───────────────────────────────────────────────────────────
  campaignRecipients: {
    /** Invalidate ở đây phủ CẢ danh sách theo chiến dịch VÀ theo người nhận.
     *  Gửi chiến dịch làm thay đổi cả hai, nên dùng `all`. */
    all: ["campaign_recipients"] as const,
    byCampaign: (campaignId?: string | null) => ["campaign_recipients", campaignId] as const,
    byUserAll: ["campaign_recipients", "by-user"] as const,
    byUser: (userId?: string | null) => ["campaign_recipients", "by-user", userId] as const,
  },
  partners: {
    all: ["partners"] as const,
    /** "public" đứng sau nên `all` phủ được — xem LUẬT PREFIX ở đầu file. */
    public: ["partners", "public"] as const,
  },

  // ─── Công cụ đấu giá ─────────────────────────────────────────────────────
  auctionTools: {
    all: ["auction-tools"] as const,
    public: ["auction-tools", "public"] as const,
  },
  toolShowcases: {
    all: ["tool-showcases"] as const,
    byProvider: (providerId?: string | null) => ["tool-showcases", providerId] as const,
    /**
     * "public" đặt SAU providerId — đây là phần SỬA BUG.
     *
     * Trước đây key công khai là ["tool-showcases", "public", providerId], còn
     * mutation của admin chỉ invalidate ["tool-showcases", providerId]. Hai key
     * đó không prefix-match nhau, nên admin thêm/sửa/xoá showcase thì trang
     * công khai vẫn phục vụ dữ liệu cũ. Đảo thứ tự thì byProvider() tự phủ.
     */
    publicByProvider: (providerId?: string | null) =>
      ["tool-showcases", providerId, "public"] as const,
  },
} as const;
