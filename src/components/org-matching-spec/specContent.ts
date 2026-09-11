/**
 * Nội dung trang "Cách sàn chấm điểm tổ chức đấu giá" — bản Việt và bản Anh.
 *
 * CẤU TRÚC DỰNG MỘT LẦN, LỜI VĂN VIẾT HAI LẦN: mọi mục đều là cùng một kiểu dữ
 * liệu nên hai ngôn ngữ không thể lệch nhau về bố cục, chỉ khác chữ. Thêm mục
 * mới thì cả hai bản cùng phải khai, TypeScript sẽ báo nếu thiếu.
 *
 * Chuỗi trong file này đi qua <RichText>: **đậm**, *nghiêng*, `mã nguồn`.
 */

export type SpecLang = "vi" | "en";

export const SPEC_LANGS: SpecLang[] = ["vi", "en"];

/** Ô bảng: chuỗi thường, hoặc chuỗi mờ (diễn giải phụ trong bảng gốc). */
export type SpecCell = string | { text: string; muted: true };

export interface SpecTable {
  head: string[];
  /** Chỉ số cột trình bày kiểu số: mono + tabular-nums, không xuống dòng. */
  numericCols?: number[];
  rows: SpecCell[][];
  /** Dòng tổng, chỉ dùng ở ví dụ tính. */
  foot?: { label: string; value: string };
}

export interface SpecStage {
  title: string;
  desc: string;
  /** Hàm/đường dẫn trong mã nguồn — giống nhau ở cả hai bản. */
  src: string;
  /** Bước dùng dữ liệu suy diễn: đánh dấu khác màu. */
  mock?: boolean;
}

export interface SpecCriterion {
  title: string;
  weight: number;
  unit: string;
  inputs: string[];
  process: {
    paragraphs: string[];
    formula?: string;
    table?: SpecTable;
  };
  outputs: string[];
}

export interface SpecSectionMeta {
  id: string;
  num: string;
  title: string;
  lede: string;
}

export interface SpecCopy {
  eyebrow: string;
  title: string;
  standfirst: string;
  meta: { label: string; value: string }[];
  tocLabel: string;
  notice: { title: string; body: string };
  pipeline: SpecSectionMeta & { stages: SpecStage[] };
  attrs: SpecSectionMeta & { table: SpecTable; note: string };
  criteria: SpecSectionMeta & { items: SpecCriterion[] };
  total: SpecSectionMeta & {
    bars: { label: string; weight: number }[];
    barsAlt: string;
    paragraphs: string[];
  };
  example: SpecSectionMeta & { caseTitle: string; given: string; table: SpecTable };
  bandLabels: { input: string; process: string; output: string };
  footerNote: string;
  backToTop: string;
}

const vi: SpecCopy = {
  eyebrow: "Tài Sản Đấu Giá · Đặc tả thuật toán",
  title: "Thuật toán khớp tổ chức đấu giá",
  standfirst:
    "Cách sàn xếp hạng các tổ chức đấu giá cho một tài sản vừa được số hoá: năm tiêu chí, thang điểm 0–100, và một lớp dữ liệu năng lực hiện vẫn là dữ liệu suy diễn.",
  meta: [
    { label: "Engine", value: "src/lib/orgMatching.ts" },
    { label: "Tiêu chí", value: "buildMatchCriteria()" },
    { label: "Điểm tối đa", value: "100" },
    { label: "Nguồn năng lực", value: "suy diễn (mock)" },
  ],
  tocLabel: "Mục lục",
  notice: {
    title: "Đọc trước: dữ liệu năng lực chưa có thật",
    body:
      "Bảng `auction_organizations` mới lưu tên, tỉnh và loại hình. Chuyên môn, tầng kinh nghiệm, mức thù lao và việc có sàn trực tuyến hay không đều đang được *suy diễn tất định* từ mã tổ chức. Điểm số vì vậy ổn định và có thể kiểm thử, nhưng **không phản ánh năng lực thật** — không dùng cho cam kết với khách hàng.",
  },
  pipeline: {
    id: "luong-xu-ly",
    num: "01",
    title: "Luồng xử lý",
    lede:
      "Bảy bước, chạy hoàn toàn ở phía client. Bước 4 là lớp dữ liệu tạm sẽ được thay khi hồ sơ năng lực tổ chức có thật.",
    stages: [
      {
        title: "Dựng tiêu chí từ hồ sơ tài sản",
        desc:
          "Nhóm tài sản, tỉnh/thành, hình thức đấu giá, giá khởi điểm và mức thù lao chấp nhận được gom thành một bộ tiêu chí. Chọn “nhờ định giá” thì giá khởi điểm để trống.",
        src: "buildMatchCriteria() · postingToMatchCriteria()",
      },
      {
        title: "Lấy toàn bộ danh bạ tổ chức",
        desc:
          "Đọc `auction_organizations`, sắp theo tên. Cache 5 phút, dùng chung cho mọi lần chấm điểm trong phiên.",
        src: 'useMatchedOrgs → queryKey ["matched-orgs-pool"]',
      },
      {
        title: "Lọc tổ chức đã có tài khoản",
        desc:
          "Mặc định chỉ giữ tổ chức đã đăng ký trên sàn — tổ chức chưa có tài khoản thì không nhận được yêu cầu, nên không đưa vào danh sách gợi ý. Có thể tắt qua tuỳ chọn khi cần xem toàn bộ danh bạ.",
        src: "RPC accounted_auction_org_ids · opts.onlyAccounted",
      },
      {
        title: "Suy ra thuộc tính năng lực (lớp tạm)",
        desc:
          "Mỗi tổ chức được gán chuyên môn, tầng kinh nghiệm, mức thù lao, sàn trực tuyến, số phiên và cơ sở vật chất — suy ra tất định từ mã tổ chức nên không đổi giữa các lần render và các lần tải lại.",
        src: "deriveOrgAttributes() · seededRand(org.id, salt)",
        mock: true,
      },
      {
        title: "Chấm năm tiêu chí",
        desc:
          "Chuyên môn, địa bàn, hình thức, kinh nghiệm, thù lao — mỗi tiêu chí cho ra một số điểm trong hạn mức riêng.",
        src: "scoreOrg() → breakdown",
      },
      {
        title: "Cộng thành điểm khớp 0–100",
        desc:
          "Từng tiêu chí làm tròn một chữ số thập phân trước khi cộng, để con số hiển thị đúng bằng tổng các dòng người dùng nhìn thấy.",
        src: "breakdown → score",
      },
      {
        title: "Xếp hạng và bàn giao",
        desc:
          "Sắp giảm dần theo điểm, không cắt ngưỡng, không giới hạn số lượng. Điểm được lưu kèm yêu cầu khi chủ tài sản gửi đi, để về sau đối chiếu chất lượng gợi ý với kết quả thực tế.",
        src: "rankOrgs() → ChooseOrgAndRequest · DispatchOrgsDialog",
      },
    ],
  },
  attrs: {
    id: "thuoc-tinh-nang-luc",
    num: "02",
    title: "Thuộc tính năng lực suy ra",
    lede:
      "Sáu thuộc tính được sinh cho mỗi tổ chức. Chỉ bốn trong số đó tham gia chấm điểm — hai thuộc tính còn lại chỉ để hiển thị trên thẻ tổ chức.",
    table: {
      head: ["Thuộc tính", "Miền giá trị", "Phân bố", "Vào điểm"],
      numericCols: [3],
      rows: [
        ["Chuyên môn", "1–3 nhóm tài sản cha", { text: "Lọc 7 nhóm với ngưỡng 0.45, lấy tối đa 3", muted: true }, "Có"],
        ["Sàn trực tuyến", "có / không", { text: "≈ 60% tổ chức có sàn", muted: true }, "Có"],
        ["Tầng kinh nghiệm", "1 – 4", { text: "Ngẫu nhiên, +1 tầng cho Trung tâm và Công ty", muted: true }, "Có"],
        ["Mức thù lao", "0.5% – 5.0%", { text: "Đều trong khoảng", muted: true }, "Có"],
        ["Số phiên thành công", "20 – 500", { text: "Đều trong khoảng", muted: true }, "Không"],
        ["Cơ sở vật chất", "0–5 hạng mục", { text: "Lọc 5 hạng mục với ngưỡng 0.50", muted: true }, "Không"],
      ],
    },
    note:
      "Bốn tầng kinh nghiệm hiển thị lần lượt là *Mới thành lập*, *Đang phát triển*, *Giàu kinh nghiệm*, *Kỳ cựu hàng đầu*.",
  },
  criteria: {
    id: "nam-tieu-chi",
    num: "03",
    title: "Năm tiêu chí",
    lede:
      "Mỗi tiêu chí nhận vào một phần của bộ tiêu chí tài sản cộng một thuộc tính tổ chức, và trả ra một số điểm rời rạc hoặc giảm tuyến tính trong hạn mức của nó.",
    items: [
      {
        title: "Chuyên môn nhóm tài sản",
        weight: 30,
        unit: "điểm",
        inputs: [
          "Nhóm tài sản cha của hồ sơ — luôn có, do bước 1 của trình số hoá bắt buộc chọn",
          "Danh sách chuyên môn của tổ chức — luôn có ít nhất một nhóm",
        ],
        process: {
          paragraphs: [
            "Kiểm tra nhóm tài sản có nằm trong danh sách chuyên môn của tổ chức hay không. Không có mức “gần đúng”: hoặc đúng nhóm, hoặc là chuyên môn khác.",
          ],
          formula: "khớp nhóm            → 30.0\nchuyên môn khác      → 30 × 0.3 = 9.0\nkhông chuyên môn nào → 0.0  (không xảy ra)",
        },
        outputs: [
          "**30.0** hoặc **9.0** — chênh 21 điểm, khoảng cách lớn nhất trong cả năm tiêu chí",
          "Đây là tiêu chí quyết định thứ hạng: hai tổ chức khác nhau ở đây gần như không thể đảo ngôi bằng bốn tiêu chí còn lại",
        ],
      },
      {
        title: "Địa bàn",
        weight: 20,
        unit: "điểm",
        inputs: [
          "Tỉnh/thành nơi có tài sản — có thể trống",
          "Tỉnh/thành đăng ký của tổ chức — có thể trống với hồ sơ chưa khai đủ",
        ],
        process: {
          paragraphs: [
            "So khớp chuỗi tỉnh. Trường hợp thiếu dữ liệu được tính riêng và *không* bị phạt như khác tỉnh.",
          ],
          formula: "cùng tỉnh          → 20.0\nthiếu tỉnh (1 bên) → 20 × 0.5 = 10.0\nkhác tỉnh          → 20 × 0.4 = 8.0",
        },
        outputs: [
          "**20.0 · 10.0 · 8.0**",
          "Hồ sơ trống được lợi hơn hồ sơ khác tỉnh 2 điểm — chủ ý, để tổ chức mới onboard không bị đẩy xuống đáy bảng vì chưa kịp khai thông tin",
        ],
      },
      {
        title: "Hình thức đấu giá",
        weight: 15,
        unit: "điểm",
        inputs: [
          "Hình thức chủ tài sản chọn: trực tiếp, trực tuyến, hoặc cả hai",
          "Tổ chức có sàn trực tuyến hay không",
        ],
        process: {
          paragraphs: [
            "Đây là tiêu chí *năng lực hạ tầng*, không phải sở thích: thiếu sàn mà khách yêu cầu trực tuyến thì coi như không đáp ứng được.",
          ],
          table: {
            head: ["Khách chọn", "Tổ chức có sàn", "Không có sàn"],
            numericCols: [1, 2],
            rows: [
              ["Trực tuyến", "15.0", "0.0"],
              ["Cả hai hình thức", "15.0", "9.0"],
              ["Trực tiếp", "15.0", "15.0"],
            ],
          },
        },
        outputs: [
          "**15.0 · 9.0 · 0.0**",
          "Ô **0.0** là cơ chế loại mềm duy nhất trong thuật toán — tổ chức không bị lọc khỏi danh sách, nhưng mất trọn 15 điểm nên rơi hẳn khỏi nhóm đầu",
        ],
      },
      {
        title: "Kinh nghiệm so với giá trị tài sản",
        weight: 20,
        unit: "điểm",
        inputs: [
          "Giá khởi điểm — trống khi chủ tài sản chọn “nhờ sàn định giá”",
          "Tầng kinh nghiệm của tổ chức, thang 1–4",
        ],
        process: {
          paragraphs: [
            "Quy giá khởi điểm về cùng thang 1–4 rồi đo độ lệch giữa hai tầng. Đây là **khớp hai chiều**: lệch lên cũng bị trừ đúng như lệch xuống — tổ chức kỳ cựu nhận tài sản quá nhỏ sẽ không ưu tiên xử lý, tổ chức non kinh nghiệm nhận tài sản quá lớn thì quá sức.",
          ],
          table: {
            head: ["Giá khởi điểm", "Tầng giá trị"],
            numericCols: [1],
            rows: [
              ["Trên 5 tỷ", "4"],
              ["Trên 1 tỷ đến 5 tỷ", "3"],
              ["Trên 200 triệu đến 1 tỷ", "2"],
              ["Từ 200 triệu trở xuống", "1"],
              [{ text: "Nhờ sàn định giá (để trống)", muted: true }, "2"],
            ],
          },
          formula: "điểm = 20 × (1 − |tầng kinh nghiệm − tầng giá trị| ÷ 3)",
        },
        outputs: [
          "Lệch 0 tầng → **20.0** · 1 tầng → **13.3** · 2 tầng → **6.7** · 3 tầng → **0.0**",
          "Hồ sơ nhờ định giá luôn được đối chiếu ở tầng 2, nên tổ chức tầng 1–3 đều còn cơ hội; chỉ tổ chức tầng 4 bị thiệt",
        ],
      },
      {
        title: "Thù lao",
        weight: 15,
        unit: "điểm",
        inputs: [
          "Mức thù lao chủ tài sản chấp nhận, tính theo % — có thể bỏ trống",
          "Mức thù lao tổ chức chào, 0.5%–5.0%",
        ],
        process: {
          paragraphs: [
            "Chào bằng hoặc thấp hơn mức chấp nhận thì được trọn điểm — **chào rẻ hơn nữa không được thưởng thêm**, để bảng xếp hạng không biến thành cuộc đua phá giá. Vượt mức thì giảm tuyến tính và chạm 0 khi vượt 3 điểm phần trăm.",
          ],
          formula: "khách bỏ trống   → 15 × 0.7 = 10.5\nchào ≤ chấp nhận → 15.0\nchào > chấp nhận → 15 × (1 − chênh lệch ÷ 3), tối thiểu 0",
        },
        outputs: [
          "Vượt 0.5 điểm % → **12.5** · vượt 1.0 → **10.0** · vượt 2.0 → **5.0** · vượt từ 3.0 trở lên → **0.0**",
          "Bỏ trống cho **10.5** — thấp hơn khớp thật nhưng cao hơn vượt 1.5 điểm %, giữ nguyên tinh thần “thiếu dữ liệu không bị phạt nặng”",
        ],
      },
    ],
  },
  total: {
    id: "tong-hop-xep-hang",
    num: "04",
    title: "Tổng hợp & xếp hạng",
    lede: "Năm hạn mức cộng lại đúng 100 điểm.",
    bars: [
      { label: "Chuyên môn", weight: 30 },
      { label: "Địa bàn", weight: 20 },
      { label: "Kinh nghiệm", weight: 20 },
      { label: "Hình thức", weight: 15 },
      { label: "Thù lao", weight: 15 },
    ],
    barsAlt: "Tỷ trọng: chuyên môn 30, địa bàn 20, kinh nghiệm 20, hình thức 15, thù lao 15",
    paragraphs: [
      "Từng tiêu chí được làm tròn một chữ số thập phân *trước* khi cộng, rồi tổng được làm tròn lại — nhờ vậy con số lớn hiển thị trên thẻ luôn đúng bằng tổng các dòng chi tiết mà người dùng bung ra xem, không lệch do làm tròn.",
      "Danh sách sắp giảm dần theo điểm. Không có ngưỡng loại và không giới hạn số lượng: mọi tổ chức đã qua bộ lọc tài khoản đều xuất hiện, kể cả tổ chức điểm rất thấp. Hai tổ chức bằng điểm giữ nguyên thứ tự theo tên, vì danh bạ đã sắp theo tên từ đầu.",
      "Điểm được ghi lại cùng yêu cầu khi chủ tài sản gửi đi, và ở luồng ký gửi nội bộ nó hiển thị dưới dạng phần trăm bên cạnh từng tổ chức được chọn để phát yêu cầu.",
    ],
  },
  example: {
    id: "vi-du-tinh",
    num: "05",
    title: "Ví dụ tính",
    lede: "Một trường hợp khớp tốt nhưng không tuyệt đối.",
    caseTitle: "Nhà đất 2 tỷ tại Hà Nội",
    given:
      "Tài sản: nhóm bất động sản · Hà Nội · cả hai hình thức · giá khởi điểm 2,000,000,000₫ · chấp nhận thù lao 2.0%.  Tổ chức: đóng tại Hải Phòng · có sàn trực tuyến · tầng kinh nghiệm 3 · chào 2.5%.",
    table: {
      head: ["Tiêu chí", "Diễn giải", "Điểm"],
      numericCols: [2],
      rows: [
        ["Chuyên môn", { text: "Có bất động sản trong chuyên môn", muted: true }, "30.0"],
        ["Địa bàn", { text: "Khác tỉnh", muted: true }, "8.0"],
        ["Hình thức", { text: "Cả hai, tổ chức có sàn", muted: true }, "15.0"],
        ["Kinh nghiệm", { text: "Tầng 3 gặp tài sản tầng 3, lệch 0", muted: true }, "20.0"],
        ["Thù lao", { text: "Vượt 0.5 điểm %", muted: true }, "12.5"],
      ],
      foot: { label: "Điểm khớp", value: "85.5" },
    },
  },
  bandLabels: { input: "Input", process: "Xử lý", output: "Output" },
  footerNote:
    "Đặc tả mô tả hành vi hiện tại của engine tại src/lib/orgMatching.ts. Khi hồ sơ năng lực tổ chức có dữ liệu thật, chỉ thay nguồn ở bước 4 — năm tiêu chí, tỷ trọng và cách cộng điểm giữ nguyên.",
  backToTop: "Về đầu trang",
};

const en: SpecCopy = {
  eyebrow: "Tài Sản Đấu Giá · Algorithm specification",
  title: "Auction Organization Matching",
  standfirst:
    "How the marketplace ranks auction organizations for a newly digitized asset: five criteria, a 0–100 scale, and a capability dataset that is still inferred rather than real.",
  meta: [
    { label: "Engine", value: "src/lib/orgMatching.ts" },
    { label: "Criteria", value: "buildMatchCriteria()" },
    { label: "Max score", value: "100" },
    { label: "Capability data", value: "inferred (mock)" },
  ],
  tocLabel: "Contents",
  notice: {
    title: "Read this first: the capability data is not real yet",
    body:
      "The `auction_organizations` table currently holds only name, province and entity type. Specialties, experience tier, commission rate and whether an organization runs an online auction platform are all *deterministically inferred* from the organization's ID. That keeps scores stable and testable, but it means they **do not reflect real capability** — do not use them in commitments to customers.",
  },
  pipeline: {
    id: "luong-xu-ly",
    num: "01",
    title: "Pipeline",
    lede:
      "Seven steps, all running client-side. Step 4 is the placeholder data layer that gets replaced once organizations have real capability profiles.",
    stages: [
      {
        title: "Build the criteria from the asset record",
        desc:
          "Asset category, province, auction format, starting price and acceptable commission are collected into one criteria object. If the owner picks “let the marketplace appraise it”, starting price is left empty.",
        src: "buildMatchCriteria() · postingToMatchCriteria()",
      },
      {
        title: "Load the full organization directory",
        desc:
          "Reads `auction_organizations` ordered by name. Cached for 5 minutes and shared across every scoring run in the session.",
        src: 'useMatchedOrgs → queryKey ["matched-orgs-pool"]',
      },
      {
        title: "Keep only organizations with an account",
        desc:
          "By default the pool is narrowed to organizations already registered on the marketplace — one without an account cannot receive the request, so it does not belong in the suggestions. Can be switched off to inspect the whole directory.",
        src: "RPC accounted_auction_org_ids · opts.onlyAccounted",
      },
      {
        title: "Infer capability attributes (placeholder layer)",
        desc:
          "Each organization is assigned specialties, an experience tier, a commission rate, online-platform capability, a session count and facilities — all derived deterministically from its ID, so nothing changes between renders or across reloads.",
        src: "deriveOrgAttributes() · seededRand(org.id, salt)",
        mock: true,
      },
      {
        title: "Score the five criteria",
        desc:
          "Specialty, locality, format, experience and commission each produce a figure within their own budget.",
        src: "scoreOrg() → breakdown",
      },
      {
        title: "Add up to a 0–100 match score",
        desc:
          "Each criterion is rounded to one decimal before summing, so the headline number equals the sum of the lines the user can actually see.",
        src: "breakdown → score",
      },
      {
        title: "Rank and hand off",
        desc:
          "Sorted descending, with no cut-off threshold and no result cap. The score is stored alongside the request when the owner sends it, so suggestion quality can later be reconciled against real outcomes.",
        src: "rankOrgs() → ChooseOrgAndRequest · DispatchOrgsDialog",
      },
    ],
  },
  attrs: {
    id: "thuoc-tinh-nang-luc",
    num: "02",
    title: "Capability attributes",
    lede:
      "Six attributes are generated per organization. Only four of them feed the score — the other two exist purely to be displayed on the organization card.",
    table: {
      head: ["Attribute", "Range", "Distribution", "Scored"],
      numericCols: [3],
      rows: [
        ["Specialties", "1–3 parent categories", { text: "7 categories filtered at a 0.45 threshold, capped at 3", muted: true }, "Yes"],
        ["Online platform", "yes / no", { text: "≈ 60% of organizations have one", muted: true }, "Yes"],
        ["Experience tier", "1 – 4", { text: "Random, +1 tier for Centres and Companies", muted: true }, "Yes"],
        ["Commission rate", "0.5% – 5.0%", { text: "Uniform across the range", muted: true }, "Yes"],
        ["Successful sessions", "20 – 500", { text: "Uniform across the range", muted: true }, "No"],
        ["Facilities", "0–5 items", { text: "5 items filtered at a 0.50 threshold", muted: true }, "No"],
      ],
    },
    note:
      "The four experience tiers are shown to users as *Newly established*, *Growing*, *Experienced* and *Leading veteran*.",
  },
  criteria: {
    id: "nam-tieu-chi",
    num: "03",
    title: "The five criteria",
    lede:
      "Each criterion takes one slice of the asset's criteria plus one organization attribute, and returns either a discrete figure or a linear decay within its budget.",
    items: [
      {
        title: "Category specialty",
        weight: 30,
        unit: "pts",
        inputs: [
          "The asset's parent category — always present, since step 1 of the wizard requires it",
          "The organization's specialty list — always holds at least one category",
        ],
        process: {
          paragraphs: [
            "Checks whether the asset's category appears in the organization's specialty list. There is no partial match: it is either the right category or a different one.",
          ],
          formula: "category matches      → 30.0\ndifferent specialty   → 30 × 0.3 = 9.0\nno specialty at all   → 0.0  (unreachable)",
        },
        outputs: [
          "**30.0** or **9.0** — a 21-point gap, the widest swing of all five criteria",
          "This is what decides the ranking: two organizations that differ here can almost never be reordered by the other four criteria",
        ],
      },
      {
        title: "Locality",
        weight: 20,
        unit: "pts",
        inputs: [
          "The province where the asset is located — may be empty",
          "The organization's registered province — may be empty on incomplete profiles",
        ],
        process: {
          paragraphs: [
            "Straight province comparison. Missing data is scored as its own case and is deliberately *not* penalised as heavily as a mismatch.",
          ],
          formula: "same province      → 20.0\nprovince missing   → 20 × 0.5 = 10.0\ndifferent province → 20 × 0.4 = 8.0",
        },
        outputs: [
          "**20.0 · 10.0 · 8.0**",
          "An empty profile beats a mismatched one by 2 points — intentional, so newly onboarded organizations are not pushed to the bottom of the list before they have filled in their details",
        ],
      },
      {
        title: "Auction format",
        weight: 15,
        unit: "pts",
        inputs: [
          "The format the owner picked: in person, online, or either",
          "Whether the organization runs an online auction platform",
        ],
        process: {
          paragraphs: [
            "This is an *infrastructure capability* check, not a preference: no platform against an online request means the organization simply cannot deliver.",
          ],
          table: {
            head: ["Owner picked", "Has platform", "No platform"],
            numericCols: [1, 2],
            rows: [
              ["Online", "15.0", "0.0"],
              ["Either format", "15.0", "9.0"],
              ["In person", "15.0", "15.0"],
            ],
          },
        },
        outputs: [
          "**15.0 · 9.0 · 0.0**",
          "That **0.0** cell is the only soft-elimination in the algorithm — the organization is not filtered out, but losing all 15 points drops it clear of the top of the list",
        ],
      },
      {
        title: "Experience vs. asset value",
        weight: 20,
        unit: "pts",
        inputs: [
          "Starting price — empty when the owner asks the marketplace to appraise",
          "The organization's experience tier on a 1–4 scale",
        ],
        process: {
          paragraphs: [
            "The starting price is mapped onto the same 1–4 scale, then the gap between the two tiers is measured. This is a **two-way match**: overshooting is penalised exactly like undershooting — a veteran house handed a small asset will deprioritise it, and an inexperienced one handed a large asset is out of its depth.",
          ],
          table: {
            head: ["Starting price", "Value tier"],
            numericCols: [1],
            rows: [
              ["Above VND 5 billion", "4"],
              ["VND 1–5 billion", "3"],
              ["VND 200 million – 1 billion", "2"],
              ["VND 200 million or below", "1"],
              [{ text: "Marketplace appraisal (left empty)", muted: true }, "2"],
            ],
          },
          formula: "score = 20 × (1 − |experience tier − value tier| ÷ 3)",
        },
        outputs: [
          "0 tiers apart → **20.0** · 1 tier → **13.3** · 2 tiers → **6.7** · 3 tiers → **0.0**",
          "Appraisal-mode assets are always compared against tier 2, so organizations in tiers 1–3 all stay in contention; only tier 4 is disadvantaged",
        ],
      },
      {
        title: "Commission",
        weight: 15,
        unit: "pts",
        inputs: [
          "The commission percentage the owner will accept — may be left blank",
          "The organization's quoted rate, 0.5%–5.0%",
        ],
        process: {
          paragraphs: [
            "Quoting at or below the accepted rate earns full points — **quoting even lower earns nothing extra**, so the ranking does not turn into a race to the bottom. Above the accepted rate the score decays linearly and hits zero at 3 percentage points over.",
          ],
          formula: "owner left it blank → 15 × 0.7 = 10.5\nquote ≤ accepted   → 15.0\nquote > accepted   → 15 × (1 − overage ÷ 3), floored at 0",
        },
        outputs: [
          "0.5 pts over → **12.5** · 1.0 over → **10.0** · 2.0 over → **5.0** · 3.0 or more over → **0.0**",
          "Blank scores **10.5** — below a real match but above a 1.5-point overage, keeping the same “missing data is not heavily penalised” principle",
        ],
      },
    ],
  },
  total: {
    id: "tong-hop-xep-hang",
    num: "04",
    title: "Totalling & ranking",
    lede: "The five budgets add up to exactly 100 points.",
    bars: [
      { label: "Specialty", weight: 30 },
      { label: "Locality", weight: 20 },
      { label: "Experience", weight: 20 },
      { label: "Format", weight: 15 },
      { label: "Commission", weight: 15 },
    ],
    barsAlt: "Weights: specialty 30, locality 20, experience 20, format 15, commission 15",
    paragraphs: [
      "Every criterion is rounded to one decimal *before* the sum, and the total is then rounded again — which is why the headline figure on the card always equals the sum of the detail rows a user expands, with no rounding drift between them.",
      "The list is sorted descending by score. There is no elimination threshold and no result cap: every organization that passed the account filter appears, including very low scorers. Ties keep their original order by name, since the directory is already sorted that way.",
      "The score is written alongside the request when the owner sends it, and in the internal consignment flow it is shown as a percentage next to each organization selected for dispatch.",
    ],
  },
  example: {
    id: "vi-du-tinh",
    num: "05",
    title: "Worked example",
    lede: "A strong but imperfect match.",
    caseTitle: "Residential property, VND 2 billion, Hanoi",
    given:
      "Asset: real-estate category · Hanoi · either format · starting price 2,000,000,000₫ · accepts up to 2.0% commission.  Organization: based in Hai Phong · has an online platform · experience tier 3 · quotes 2.5%.",
    table: {
      head: ["Criterion", "Reasoning", "Points"],
      numericCols: [2],
      rows: [
        ["Specialty", { text: "Real estate is among its specialties", muted: true }, "30.0"],
        ["Locality", { text: "Different province", muted: true }, "8.0"],
        ["Format", { text: "Either format, organization has a platform", muted: true }, "15.0"],
        ["Experience", { text: "Tier 3 meets a tier 3 asset, no gap", muted: true }, "20.0"],
        ["Commission", { text: "0.5 points over the accepted rate", muted: true }, "12.5"],
      ],
      foot: { label: "Match score", value: "85.5" },
    },
  },
  bandLabels: { input: "Input", process: "Process", output: "Output" },
  footerNote:
    "This specification describes the current behaviour of the engine in src/lib/orgMatching.ts. When organizations have real capability profiles, only the data source in step 4 changes — the five criteria, their weights and the totalling rule stay the same.",
  backToTop: "Back to top",
};

export const SPEC_CONTENT: Record<SpecLang, SpecCopy> = { vi, en };

/** Thứ tự mục, dùng cho mục lục — id giống nhau ở hai bản nên neo không đổi khi đổi ngôn ngữ. */
export function specSections(copy: SpecCopy): SpecSectionMeta[] {
  return [copy.pipeline, copy.attrs, copy.criteria, copy.total, copy.example];
}
