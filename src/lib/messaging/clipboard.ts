/** Chép vào clipboard; trả false khi trình duyệt chặn để nơi gọi báo người dùng. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
