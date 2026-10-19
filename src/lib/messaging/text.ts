/** Rút gọn một đoạn văn về tối đa `max` ký tự, gộp khoảng trắng, thêm "…". */
export const excerpt = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};
