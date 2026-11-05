// Sensitive account changes require a recent, valid authentication timestamp.
export function recentlyVerified(user: {verifiedAt: number}, now = Date.now()) {
  const age = now - user.verifiedAt;
  return Number.isSafeInteger(user.verifiedAt) && user.verifiedAt > 0 && age >= 0 && age < 300000;
}
