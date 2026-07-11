import type { AdStartType, AdEndType, NavType } from "@/types/advertising";

// State điều khiển toàn bộ form tạo/sửa banner (controlled, không dùng RHF vì
// nhiều field phụ thuộc lẫn nhau — toggle thiết bị, điều hướng, lịch).
export interface AdFormState {
  name: string;
  customer_id: string; // "" = không gắn
  position_id: string; // "" = chưa chọn
  show_desktop: boolean;
  show_mobile: boolean;
  desktop_image_url: string; // "" = chưa có
  mobile_image_url: string;
  nav_type: NavType;
  nav_url: string;
  start_type: AdStartType;
  start_at: string; // ISO hoặc ""
  end_type: AdEndType;
  end_at: string;
  sort_order: number;
}

export const defaultAdForm: AdFormState = {
  name: "",
  customer_id: "",
  position_id: "",
  show_desktop: true,
  show_mobile: true,
  desktop_image_url: "",
  mobile_image_url: "",
  nav_type: "none",
  nav_url: "",
  start_type: "immediate",
  start_at: "",
  end_type: "continuous",
  end_at: "",
  sort_order: 1,
};
