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
  },

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
