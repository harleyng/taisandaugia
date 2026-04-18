/**
 * Generate a default display name for a user when they haven't set one.
 * Uses the trailing digits of their user id, e.g. "User456988876".
 */
export const generateDefaultName = (userId?: string | null): string => {
  if (!userId) return "User";
  const digits = userId.replace(/\D/g, "");
  const tail = digits.slice(-9) || digits.slice(0, 9) || "0";
  return `User${tail}`;
};

export const resolveDisplayName = (
  profileName: string | null | undefined,
  userId?: string | null,
): string => {
  const trimmed = (profileName || "").trim();
  if (trimmed) return trimmed;
  return generateDefaultName(userId);
};
