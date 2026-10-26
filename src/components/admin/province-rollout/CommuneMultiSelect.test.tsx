import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AdminUnit } from "@/lib/adminUnits";
import { CommuneMultiSelect } from "./CommuneMultiSelect";

const UNITS: AdminUnit[] = [
  { code: "09169", name: "Phường Vũ Ninh", level: "commune", unit_type: "phuong", parent_code: "24", legacy_names: [], is_active: true },
  { code: "07210", name: "Phường Bắc Giang", level: "commune", unit_type: "phuong", parent_code: "24", legacy_names: ["Thành phố Bắc Giang"], is_active: true },
  { code: "07339", name: "Xã Tân Yên", level: "commune", unit_type: "xa", parent_code: "24", legacy_names: [], is_active: true },
];

vi.mock("@/hooks/useAdminUnits", () => ({
  useAdminUnits: (): { data: AdminUnit[]; isLoading: boolean } => ({ data: UNITS, isLoading: false }),
  useAdminUnit: (): { data: AdminUnit | null } => ({ data: null }),
}));

describe("CommuneMultiSelect", () => {
  it("chưa chọn tỉnh thì nhắc chọn tỉnh trước", () => {
    render(<CommuneMultiSelect provinceCode={null} value={[]} onChange={() => {}} />);
    expect(screen.getByText(/Chọn tỉnh \/ thành phố trước/)).toBeInTheDocument();
  });

  it("bật / tắt một đơn vị trả về danh sách mã", () => {
    const onChange = vi.fn();
    render(<CommuneMultiSelect provinceCode="24" value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Xã Tân Yên"));
    expect(onChange).toHaveBeenCalledWith(["07339"]);
  });

  it("'Chọn tất cả' chỉ lấy các đơn vị ĐANG hiện sau khi tìm", () => {
    const onChange = vi.fn();
    render(<CommuneMultiSelect provinceCode="24" value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Tìm xã, phường/), { target: { value: "vu ninh" } });
    fireEvent.click(screen.getByRole("button", { name: /Chọn tất cả \(1\)/ }));
    expect(onChange).toHaveBeenCalledWith(["09169"]);
  });

  it("tìm được bằng tên TRƯỚC sáp nhập", () => {
    render(<CommuneMultiSelect provinceCode="24" value={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Tìm xã, phường/), { target: { value: "thanh pho bac giang" } });
    expect(screen.getByText("Phường Bắc Giang")).toBeInTheDocument();
    expect(screen.queryByText("Xã Tân Yên")).not.toBeInTheDocument();
  });

  it("đơn vị đã có chi nhánh được dán nhãn 'đã có'", () => {
    render(
      <CommuneMultiSelect
        provinceCode="24"
        value={[]}
        onChange={() => {}}
        existing={new Set(["09169"])}
      />,
    );
    expect(screen.getAllByText("đã có")).toHaveLength(1);
  });
});
