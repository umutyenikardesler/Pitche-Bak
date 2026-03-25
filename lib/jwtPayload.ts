/** JWT doğrulamadan payload okur (sadece e-posta çıkarmak için; güvenlik iddiası yok). */
export function getEmailFromAccessToken(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4;
    if (pad) payload += "=".repeat(4 - pad);
    if (typeof globalThis.atob !== "function") return null;
    const decoded = globalThis.atob(payload);
    const obj = JSON.parse(decoded) as {
      email?: string;
      user_metadata?: { email?: string };
    };
    const top = typeof obj.email === "string" && obj.email.includes("@") ? obj.email : null;
    const meta =
      typeof obj.user_metadata?.email === "string" && obj.user_metadata.email.includes("@")
        ? obj.user_metadata.email
        : null;
    return top || meta;
  } catch {
    return null;
  }
}
