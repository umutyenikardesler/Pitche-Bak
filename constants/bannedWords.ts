/**
 * Yasaklı kelime listesi - sohbet mesajlarında kullanılamaz.
 * Kaynak: https://github.com/ooguz/turkce-kufur-karaliste (uyarlanmış)
 */
const RAW_LIST = [
  "amk", "aq", "amcık", "amcik", "orospu", "oruspu", "sik", "siktir", "sikeyim", "sikerim",
  "sikim", "sikti", "siktim", "sikmiş", "sikmis", "sikik", "sikil", "sikiyorum", "siker", "sike",
  "göt", "got", "götveren", "gotveren", "yarrak", "yarram", "piç", "pic", "pezevenk", "ibne", "ipne",
  "kahpe", "kaltak", "fahişe", "fahise", "avrat", "kancık", "kancik", "puşt",
  "mal", "salak", "aptal", "gerizekalı", "gerizekali", "öküz", "dangalak",
  "kerhane", "domal", "sokam", "sokarım", "koyim", "koyayım", "aminakoyim",
  "amina", "amına", "ananı", "ananin", "ananısikerim", "ananı sikerim",
  "bok", "boka", "sıçayım", "sicayim", "sıçarım", "sicarim", "amına koy", "amina koy",
  "orospu çocuğu", "orospu cocugu", "piç kurusu", "pic kurusu", "ibnelik", "oç", "oc",
  "amını", "aminı", "götüne", "gotune", "sülaleni", "sulaleni", "ecdadını", "ecdadini",
  "hassiktir", "hasiktir", "has siktir", "amına koyayım", "amina koyayim",
  "siktir git", "siktirgit", "siktir ol", "geber", "geberik", "amcığın", "amcigin",
  "dalyarak", "dalyarrak", "taşak", "tasak", "taşşak", "tassak", "malafat",
  "yalama", "sakso", "dildo", "vajina", "penis", "fuck", "fucking", "bitch", "ass",
  "motherfucker", "fucker", "whore", "bastard", "idiot", "goddamn",
  "sülale", "sulale", "veled", "veledizina", "kavat", "gavat", "yavşak", "yavsak",
  "kevaşe", "kevase", "şerefsiz", "serefsiz", "itoğlu it", "itoglu it",
];

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s",
  "7": "t", "8": "b", "9": "g", "|": "i", "!": "i",
};

function normalizeText(text: string): string {
  let s = text.toLowerCase();
  for (const [from, to] of Object.entries(LEET_MAP)) {
    s = s.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), to);
  }
  return s;
}

const BANNED_SET = new Set(RAW_LIST.filter(Boolean).map((w) => normalizeText(w)));

/**
 * Metinde yasaklı kelime var mı kontrol eder.
 * Kelime sınırları ve leetspeak varyasyonları (0->o, 1->i vb.) dikkate alınır.
 */
export function containsBannedWord(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const normalized = normalizeText(trimmed);

  // Kelimeleri ayır (harf, rakam, Türkçe karakterler)
  const words = normalized.split(/[\s\.\,\!\?\:\;\-\_\"\'\(\)\[\]\*\/\\]+/).filter(Boolean);

  for (const word of words) {
    if (BANNED_SET.has(word)) return true;
  }

  // Çok kelimeli ifadeler (örn. "amına koyayım")
  for (const banned of BANNED_SET) {
    if (banned.includes(" ") && normalized.includes(banned)) return true;
  }

  return false;
}
