export type PasswordRuleViolation = "min8" | "classes" | "sequentialNumbers";

const hasUpper = (s: string) => /[A-Z]/.test(s);
const hasLower = (s: string) => /[a-z]/.test(s);
const hasDigit = (s: string) => /\d/.test(s);
// "symbol" = not a letter or digit (keeps it simple/portable)
const hasSymbol = (s: string) => /[^A-Za-z0-9]/.test(s);

function hasSequentialDigits(s: string, runLen = 3) {
  let incRun = 1;
  let decRun = 1;
  let prevDigit: number | null = null;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch >= "0" && ch <= "9") {
      const d = ch.charCodeAt(0) - 48;
      if (prevDigit === null) {
        incRun = 1;
        decRun = 1;
      } else {
        if (d === prevDigit + 1) incRun += 1;
        else incRun = 1;

        if (d === prevDigit - 1) decRun += 1;
        else decRun = 1;
      }
      prevDigit = d;
      if (incRun >= runLen || decRun >= runLen) return true;
    } else {
      prevDigit = null;
      incRun = 1;
      decRun = 1;
    }
  }
  return false;
}

export function getPasswordChecks(passwordRaw: string) {
  const password = (passwordRaw || "").trim();
  const min8 = password.length >= 8;
  const upper = hasUpper(password);
  const lower = hasLower(password);
  const digit = hasDigit(password);
  const symbol = hasSymbol(password);
  const sequentialNumbers = hasSequentialDigits(password, 3);
  return {
    min8,
    upper,
    lower,
    digit,
    symbol,
    noSequentialNumbers: !sequentialNumbers,
  };
}

export function getPasswordViolations(passwordRaw: string): PasswordRuleViolation[] {
  const password = (passwordRaw || "").trim();
  const violations: PasswordRuleViolation[] = [];

  if (password.length < 8) violations.push("min8");

  const okClasses = hasUpper(password) && hasLower(password) && hasDigit(password) && hasSymbol(password);
  if (!okClasses) violations.push("classes");

  if (hasSequentialDigits(password, 3)) violations.push("sequentialNumbers");

  return violations;
}

export function isPasswordValid(passwordRaw: string) {
  return getPasswordViolations(passwordRaw).length === 0;
}

