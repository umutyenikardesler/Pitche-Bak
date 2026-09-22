/**
 * Türkiye (UTC+3) duvar saatine göre "şimdi" ve "bugün".
 *
 * Cihazın saat dilimi ne olursa olsun aynı sonucu verir.
 *
 * Günün tarihi eskiden `toLocaleDateString('en-CA')` ile alınıyordu. Bu, biçimi
 * çalışma ortamının Intl verisine bırakır: YYYY-MM-DD yerine başka bir biçim
 * dönen bir cihazda (ör. "20/09/2026") tarihler metin olarak karşılaştırıldığı
 * için bütün kıyaslamalar sessizce ters çalışır ve listeden her şey elenir.
 * Burada biçim elle kuruluyor; Intl'e bağımlılık yok.
 */

const TURKEY_OFFSET_HOURS = 3;

/** Yerel saatmiş gibi okunduğunda Türkiye duvar saatini veren Date. */
export function turkeyNow(): Date {
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  return new Date(utcNow.getTime() + TURKEY_OFFSET_HOURS * 3600000);
}

/** Türkiye saatiyle PostgreSQL damgasi: YYYY-MM-DD HH:mm:ss. */
export function turkeyTimestamp(date: Date = turkeyNow()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(':');
  return `${turkeyToday(date)} ${time}`;
}

/** Türkiye'de bugünün tarihi, YYYY-MM-DD. */
export function turkeyToday(date: Date = turkeyNow()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
