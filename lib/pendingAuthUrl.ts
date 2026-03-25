// Uygulama arka plandayken gelen auth callback URL'sini saklar.
// auth/callback ekranı mount olduğunda bu URL işlenir.
let pendingUrl: string | null = null;

export function setPendingAuthUrl(url: string) {
  pendingUrl = url;
}

export function getAndClearPendingAuthUrl(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}
