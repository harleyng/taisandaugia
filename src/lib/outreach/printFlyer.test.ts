import { describe, expect, it } from "vitest";
import { flyerHtml } from "./printFlyer";

describe("flyerHtml", () => {
  it("escape nội dung — văn bản người dùng không thành thẻ HTML", () => {
    const html = flyerHtml("CÔNG TY A\nPHIÊN ĐẤU GIÁ PDG1\n<script>alert(1)</script>\nTÀI SẢN\n• Lô 1", "<b>x</b>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("<title>&lt;b&gt;x&lt;/b&gt;</title>");
  });

  it("dòng viết hoa thành tiêu đề mục, dòng thứ 3 là tiêu đề chính", () => {
    const html = flyerHtml("CÔNG TY A\nPHIÊN ĐẤU GIÁ PDG1\nNhà phố Quận 5\nTÀI SẢN\n• Lô 1", "t");
    expect(html).toContain("<h2>CÔNG TY A</h2>");
    expect(html).toContain("<h1>Nhà phố Quận 5</h1>");
    expect(html).toContain("<h2>TÀI SẢN</h2>");
    expect(html).toContain("<p>• Lô 1</p>");
  });
});
