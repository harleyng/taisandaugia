// Link nhận lời mời của Trạm chủ tài sản (route /loi-moi-chu-tai-san/:token).
// Sàn KHÔNG gửi email lời mời — người quản trị copy link rồi chuyển cho đơn vị.
export const inviteUrl = (token: string) =>
  `${window.location.origin}/loi-moi-chu-tai-san/${token}`;
