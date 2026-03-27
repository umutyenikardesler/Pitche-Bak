let lockUntilMs = 0;

export function lockAuthCallbackFor(ms: number) {
  lockUntilMs = Math.max(lockUntilMs, Date.now() + ms);
}

export function isAuthCallbackLocked() {
  return Date.now() < lockUntilMs;
}

