import { describe, expect, it } from "vitest";
import { wizardDefaults, type WizardValues } from "../wizardSchema";
import { appraisalPatch, sourcePatch, wantsAuctionPatch } from "./dossierWizard";

const mk = (over: Partial<WizardValues> = {}): WizardValues => ({ ...wizardDefaults, ...over });
const apply = (f: WizardValues, p: Partial<WizardValues>): WizardValues => ({ ...f, ...p });

describe("đồng bộ 'Dịch vụ của sàn' với luồng chọn tổ chức", () => {
  it("muốn đấu giá ⇒ tổ chức đấu giá mặc định Dịch vụ của sàn; bỏ đấu giá ⇒ gỡ", () => {
    const yes = apply(mk(), wantsAuctionPatch(mk(), "yes"));
    expect(yes.dossier.auction.source).toBe("marketplace");
    expect(yes.chosenOrgs).toEqual([]);
    const no = apply({ ...yes, orgMode: "self" }, wantsAuctionPatch(yes, "no"));
    expect(no.dossier.auction.source).toBe("");
    expect(no.orgMode).toBe("");
  });

  it("muốn đấu giá không đè lựa chọn 'Đối tác riêng'", () => {
    const f = mk({ dossier: { ...wizardDefaults.dossier, auction: { ...wizardDefaults.dossier.auction, source: "external_partner" } } });
    expect(apply(f, wantsAuctionPatch(f, "yes")).dossier.auction.source).toBe("external_partner");
  });

  it("tổ chức đấu giá riêng ⇒ không gửi RFQ", () => {
    let f = apply(mk(), wantsAuctionPatch(mk(), "yes"));
    f = apply(f, { orgMode: "self", chosenOrgs: ["o1"] });
    f = apply(f, sourcePatch(f, "auction", "external_partner"));
    expect(f.orgMode).toBe("");
    expect(f.chosenOrgs).toEqual([]);
  });

  it("thẩm định không còn dính cách xác định giá", () => {
    const f = apply(mk(), wantsAuctionPatch(mk(), "yes"));
    const g = apply(f, sourcePatch(f, "appraisal", "marketplace"));
    expect(g.pricingMode).toBe(f.pricingMode);
    expect(g.dossier.appraisal.source).toBe("marketplace");
  });
});

describe("giá thẩm định điền sẵn giá khởi điểm", () => {
  it("điền khi trống, đi theo khi đang gõ, không đè giá tự nhập", () => {
    let f = mk();
    f = apply(f, appraisalPatch(f, { value: "1" }));
    f = apply(f, appraisalPatch(f, { value: "15" }));
    expect(f.startingPrice).toBe("15");
    expect(f.dossier.appraisal.value).toBe("15");

    const own = mk({ startingPrice: "900" });
    expect(apply(own, appraisalPatch(own, { value: "1000" })).startingPrice).toBe("900");
    expect(appraisalPatch(own, { partnerName: "X" }).startingPrice).toBeUndefined();
  });
});
