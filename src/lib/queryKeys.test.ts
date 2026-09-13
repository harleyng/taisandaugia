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
    expect(qk.bidding.lotStates(PID)).toEqual(["bidding", PID, "lot-states"]);
    expect(qk.bidding.lotBids(PID, UID)).toEqual(["bidding", PID, "lot-bids", UID]);
    expect(qk.bidding.started(PID)).toEqual(["bidding", PID, "started"]);
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
      [qk.orgContacts.byOrg(UID), qk.orgContacts.byId(UID, PID)],
      [qk.sessionAudience.all, qk.sessionAudience.bySession(PID)],
      [qk.sessionAudience.bySession(PID), qk.sessionAudience.list(PID, `${UID},${PID}`)],
      [qk.sessionOutreach.bySession(PID), qk.sessionOutreach.edits(PID)],
      [qk.sessionOutreach.bySession(PID), qk.sessionOutreach.sends(PID)],
      [qk.orgContacts.byOrg(UID), qk.orgContacts.outreach(UID, PID)],
      [qk.bidding.all(PID), qk.bidding.lotStates(PID)],
      [qk.bidding.all(PID), qk.bidding.lotBids(PID, UID)],
      [qk.bidding.all(PID), qk.bidding.lotEvents(PID)],
      // Mở lô làm "đã bắt đầu trả giá" thành true ⇒ thẻ quy tắc phải tự khoá.
      [qk.bidding.all(PID), qk.bidding.started(PID)],
      // Chốt phiên / phát hành biên bản chỉ invalidate qk.bidding.all(sessionId).
      [qk.bidding.all(PID), qk.bidding.results(PID)],
      [qk.bidding.all(PID), qk.bidding.minutes(PID)],
      [qk.biddingContracts.all, qk.biddingContracts.wonLots(UID, [PID])],
      // Hợp đồng mua bán: ghi nhận tiền / huỷ đổi cùng lúc trang tổ chức, trang
      // bên mua và cổng chủ tài sản ⇒ mutation chỉ invalidate `all`.
      [qk.saleContracts.all, qk.saleContracts.byOrg(UID)],
      [qk.saleContracts.all, qk.saleContracts.byId(PID)],
      [qk.saleContracts.all, qk.saleContracts.mine(UID)],
      [qk.saleContracts.all, qk.saleContracts.ownerMine(UID)],
      [qk.saleContracts.all, qk.saleContracts.counts(UID)],
      // id đứng TRƯỚC biến thể nên byId phủ được detail.
      [qk.saleContracts.byId(PID), qk.saleContracts.detail(PID)],
    ];
    for (const [broad, narrow] of pairs) {
      expect(covers(broad, narrow), `${JSON.stringify(broad)} ⊃ ${JSON.stringify(narrow)}`).toBe(
        true,
      );
    }
  });

  it("ghim key hợp đồng mua bán", () => {
    expect(qk.saleContracts.all).toEqual(["sale-contracts"]);
    expect(qk.saleContracts.byOrg("o1")).toEqual(["sale-contracts", "org", "o1"]);
    expect(qk.saleContracts.byId("c1")).toEqual(["sale-contracts", "id", "c1"]);
    expect(qk.saleContracts.detail("c1")).toEqual(["sale-contracts", "id", "c1", "detail"]);
    expect(qk.saleContracts.counts("o1")).toEqual(["sale-contracts", "counts", "o1"]);
  });

  it("wonLots không phụ thuộc thứ tự danh sách hồ sơ", () => {
    expect(qk.biddingContracts.wonLots(UID, [PID, UID])).toEqual(qk.biddingContracts.wonLots(UID, [UID, PID]));
  });

  it("hợp đồng mua bán KHÔNG dính vào hồ sơ tham gia đấu giá", () => {
    // Hai thực thể khác nhau trên cùng một phiên — gộp prefix là invalidate thừa.
    expect(covers(qk.saleContracts.all, qk.biddingContracts.all)).toBe(false);
    expect(covers(qk.biddingContracts.all, qk.saleContracts.all)).toBe(false);
    expect(covers(qk.saleContracts.byId(PID), qk.saleContracts.byId(UID))).toBe(false);
  });

  it("KHÔNG phủ chéo giữa hai thực thể khác nhau", () => {
    expect(covers(qk.leads.all, qk.customers.all)).toBe(false);
    expect(covers(qk.orders.byCustomer(UID), qk.orders.byAdvertisement(UID))).toBe(false);
    expect(covers(qk.profile.byUser(UID), qk.profile.byUser(PID))).toBe(false);
  });
});
