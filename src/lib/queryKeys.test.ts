import { describe, it, expect } from "vitest";
import { qk } from "./queryKeys";

/**
 * Hai nhóm test, hai mục đích khác nhau:
 *
 * 1. GHIM GIÁ TRỊ — key là hợp đồng ngầm giữa chỗ đọc và chỗ invalidate. Đổi
 *    một segment là cache miss im lặng (query cũ không bao giờ được làm mới,
 *    UI hiện dữ liệu cũ, không có lỗi nào để lần ra). Test này khoá đúng chuỗi
 *    mà code đang chạy dùng, nên refactor không thể lặng lẽ đổi chúng.
 *
 * 2. BẤT BIẾN PREFIX — quan trọng hơn cả giá trị. invalidateQueries({queryKey: A})
 *    chỉ làm mới những query có key BẮT ĐẦU bằng A. Nếu biến thể hẹp hơn
 *    (vd "public") đứng TRƯỚC tham số thì key rộng không phủ được nó nữa. Đây
 *    chính là bug đã có thật ở tool-showcases.
 */

/** Mô phỏng đúng luật khớp prefix của TanStack Query v5. */
const covers = (broad: readonly unknown[], narrow: readonly unknown[]) =>
  broad.length <= narrow.length && broad.every((seg, i) => seg === narrow[i]);

const UID = "11111111-1111-1111-1111-111111111111";
const PID = "22222222-2222-2222-2222-222222222222";

describe("qk — ghim giá trị key", () => {
  it("giữ nguyên key của các thực thể dùng ở nhiều file", () => {
    expect(qk.profile.all).toEqual(["profile"]);
    expect(qk.profile.byUser(UID)).toEqual(["profile", UID]);
    expect(qk.userCredits.byUser(UID)).toEqual(["user-credits", UID]);
    expect(qk.isAdmin(UID)).toEqual(["is-admin", UID]);
    expect(qk.adminUsers.all).toEqual(["admin-users"]);
    expect(qk.leads.all).toEqual(["leads"]);
    expect(qk.customers.all).toEqual(["customers"]);
    expect(qk.serviceCatalog).toEqual(["service-catalog"]);
    expect(qk.auctioneers(UID)).toEqual(["auctioneers", UID]);
    expect(qk.orgMembers(UID)).toEqual(["org-members", UID]);
    expect(qk.auctionOrganizationsList).toEqual(["auction-organizations-list"]);
  });

  it("giữ nguyên key phân cấp có nhánh giữa", () => {
    expect(qk.orders.byCustomer(UID)).toEqual(["orders", "by-customer", UID]);
    expect(qk.orders.byCustomerUser(UID, null)).toEqual(["orders", "by-customer-user", UID, null]);
    expect(qk.opportunities.byLead(UID)).toEqual(["opportunities", "by-lead", UID]);
    expect(qk.personnel.documents(UID)).toEqual(["personnel", UID, "documents"]);
  });

  it("chuẩn hoá userId thiếu thành null ở byCustomerUser", () => {
    // Key phải TẤT ĐỊNH: undefined và null cùng nghĩa "chưa gắn tài khoản",
    // nếu để lẫn hai giá trị thì cùng một dữ liệu bị cache thành hai entry.
    expect(qk.orders.byCustomerUser(UID, undefined)).toEqual(qk.orders.byCustomerUser(UID, null));
  });
});

describe("qk — bất biến prefix (chống invalidate câm)", () => {
  it("invalidate showcase theo provider phủ CẢ bản công khai", () => {
    // Đây là bug đã sửa: trước đây key công khai là
    // ["tool-showcases", "public", providerId] nên admin sửa showcase thì trang
    // công khai giữ dữ liệu cũ.
    expect(covers(qk.toolShowcases.byProvider(PID), qk.toolShowcases.publicByProvider(PID))).toBe(
      true,
    );
    expect(covers(qk.toolShowcases.all, qk.toolShowcases.byProvider(PID))).toBe(true);
  });

  it("invalidate hồ sơ nhân sự phủ mọi mục con", () => {
    const root = qk.personnel.byAuctioneer(PID);
    for (const child of [
      qk.personnel.documents(PID),
      qk.personnel.events(PID),
      qk.personnel.cpdExemptions(PID),
    ]) {
      expect(covers(root, child), JSON.stringify(child)).toBe(true);
    }
  });

  it("`all` phủ được mọi biến thể hẹp hơn cùng thực thể", () => {
    const pairs: [readonly unknown[], readonly unknown[]][] = [
      [qk.profile.all, qk.profile.byUser(UID)],
      [qk.userCredits.all, qk.userCredits.byUser(UID)],
      [qk.myOrgs.all, qk.myOrgs.byUser(UID)],
      [qk.adminPermissions.all, qk.adminPermissions.byUser(UID)],
      [qk.orgPermissions.all, qk.orgPermissions.byTarget(UID, UID)],
      [qk.partners.all, qk.partners.public],
      [qk.auctionTools.all, qk.auctionTools.public],
      [qk.orders.all, qk.orders.byCustomer(UID)],
      [qk.orders.all, qk.orders.byAdvertisement(UID)],
      [qk.orders.byCustomerUserAll, qk.orders.byCustomerUser(UID, UID)],
      [qk.opportunities.all, qk.opportunities.byLead(UID)],
      [qk.opportunities.all, qk.opportunities.byCustomer(UID)],
      [qk.campaignRecipients.all, qk.campaignRecipients.byCampaign(UID)],
      [qk.campaignRecipients.all, qk.campaignRecipients.byUser(UID)],
      [qk.campaignRecipients.byUserAll, qk.campaignRecipients.byUser(UID)],
    ];
    for (const [broad, narrow] of pairs) {
      expect(covers(broad, narrow), `${JSON.stringify(broad)} ⊃ ${JSON.stringify(narrow)}`).toBe(
        true,
      );
    }
  });

  it("KHÔNG phủ chéo giữa hai thực thể khác nhau", () => {
    expect(covers(qk.leads.all, qk.customers.all)).toBe(false);
    expect(covers(qk.orders.byCustomer(UID), qk.orders.byAdvertisement(UID))).toBe(false);
    expect(covers(qk.profile.byUser(UID), qk.profile.byUser(PID))).toBe(false);
  });
});
