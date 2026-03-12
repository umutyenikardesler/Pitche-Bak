const UPDATED_AT = "12.03.2026";
const CONTACT_EMAIL = "info@sahayabak.com";

export type PolicyKey = "terms" | "privacy" | "kvkk" | "cookies" | "retention" | "community";

export type PolicyBlock = { type: "meta" | "p" | "h3" | "li"; text: string };

export const POLICIES: Record<
  PolicyKey,
  { title: string; blocks: PolicyBlock[] }
> = {
  terms: {
    title: "Kullanıcı Sözleşmesi",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: 'Bu Kullanıcı Sözleşmesi ("Sözleşme"), SahayaBak mobil uygulaması ve ilgili web arayüzleri ("Hizmet") kapsamında sunulan özellikleri kullanan kullanıcılar ("Kullanıcı") ile SahayaBak ("Biz") arasındaki kullanım koşullarını düzenler.',
      },
      { type: "h3", text: "1) Kapsam" },
      {
        type: "li",
        text: "Hizmet; maç oluşturma, saha seçimi, kadro/pozisyon belirleme, mesajlaşma ve bildirim özellikleri sunabilir.",
      },
      {
        type: "li",
        text: "Hizmetin kötüye kullanımı, spam, taciz, nefret söylemi, sahtecilik ve yasa dışı faaliyetler yasaktır.",
      },
      { type: "h3", text: "2) Hesap güvenliği" },
      {
        type: "li",
        text: "Kullanıcı, hesap bilgilerini doğru ve güncel tutmakla yükümlüdür.",
      },
      {
        type: "li",
        text: "Hesap güvenliği (şifre/cihaz erişimi) Kullanıcı sorumluluğundadır.",
      },
      { type: "h3", text: "3) Konum ve izinler" },
      {
        type: "p",
        text: "Yakın saha/maç önerileri için konum izni istenebilir. Konum izni vermek zorunlu değildir; ancak bazı özellikler sınırlı çalışabilir.",
      },
      { type: "h3", text: "4) Sorumluluğun sınırlandırılması" },
      {
        type: "li",
        text: 'Hizmet "olduğu gibi" sunulur. Kesintisiz/hatadan arınmış olacağı garanti edilmez.',
      },
      {
        type: "li",
        text: "Halı saha rezervasyonu, ödeme, ulaşım ve fiziksel etkinliklerden doğan riskler Kullanıcı sorumluluğundadır.",
      },
      { type: "h3", text: "5) İletişim" },
      { type: "p", text: `İletişim: ${CONTACT_EMAIL}` },
    ],
  },
  privacy: {
    title: "Gizlilik Politikası",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: "Bu Gizlilik Politikası, SahayaBak Hizmeti kapsamında hangi verileri topladığımızı, nasıl kullandığımızı ve koruduğumuzu açıklar.",
      },
      { type: "h3", text: "1) Toplanan veri kategorileri" },
      {
        type: "li",
        text: "Hesap/Profil: ad, soyad, e‑posta, profil fotoğrafı, yaş/boy/kilo gibi profil alanları (kullanıcı tercihine bağlı).",
      },
      {
        type: "li",
        text: "Maç verileri: maç başlığı, tarih/saat, saha bilgisi, eksik pozisyonlar.",
      },
      {
        type: "li",
        text: "Mesajlaşma: kullanıcıların birbirine gönderdiği mesaj içerikleri.",
      },
      {
        type: "li",
        text: "Konum: yakınlık sıralaması için yaklaşık konum (izin verilirse).",
      },
      {
        type: "li",
        text: "Cihaz/Log: uygulama sürümü, platform, dil, hata kayıtları ve kullanım adımları.",
      },
      { type: "h3", text: "2) Amaçlar" },
      {
        type: "li",
        text: "Hizmeti sunmak ve geliştirmek (maç oluşturma, eşleştirme, bildirim).",
      },
      { type: "li", text: "Güvenlik ve kötüye kullanımın önlenmesi." },
      { type: "li", text: "Destek taleplerinin yanıtlanması." },
      { type: "h3", text: "3) Saklama ve güvenlik" },
      {
        type: "p",
        text: "Veriler, amaç için gerekli süre boyunca saklanır. Uygun teknik ve idari tedbirlerle verileri korumaya çalışırız; ancak internet üzerinden iletimde %100 güvenlik garanti edilemez.",
      },
      { type: "h3", text: "4) İletişim" },
      { type: "p", text: `Talepleriniz için: ${CONTACT_EMAIL}` },
    ],
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, SahayaBak Hizmeti kapsamında kişisel verileriniz veri sorumlusu sıfatıyla işlenebilir.',
      },
      { type: "h3", text: "1) Veri sorumlusu" },
      { type: "p", text: `Veri sorumlusu: SahayaBak (İletişim: ${CONTACT_EMAIL})` },
      { type: "h3", text: "2) İşlenen kişisel veriler" },
      {
        type: "p",
        text: "Hesap, profil, maç/organizasyon, mesajlaşma, konum (izin verilirse), cihaz ve log verileri.",
      },
      { type: "h3", text: "3) İşleme amaçları" },
      { type: "li", text: "Hizmetin sunulması ve operasyonların yürütülmesi" },
      { type: "li", text: "Güvenliğin sağlanması ve suistimallerin önlenmesi" },
      { type: "li", text: "Yasal yükümlülüklerin yerine getirilmesi" },
      { type: "h3", text: "4) Hukuki sebepler" },
      {
        type: "p",
        text: "KVKK m.5 kapsamında; sözleşmenin kurulması/ifası, meşru menfaat, hukuki yükümlülük ve ilgili durumlarda açık rıza.",
      },
      { type: "h3", text: "5) Haklar" },
      {
        type: "p",
        text: `KVKK m.11 kapsamındaki taleplerinizi ${CONTACT_EMAIL} adresine iletebilirsiniz.`,
      },
    ],
  },
  cookies: {
    title: "Çerez Politikası",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: "Bu Çerez Politikası, SahayaBak web sayfalarında kullanılan çerez ve benzeri teknolojileri açıklar.",
      },
      { type: "h3", text: "1) Çerez nedir?" },
      {
        type: "p",
        text: "Çerezler, tarayıcınızda saklanan küçük metin dosyalarıdır.",
      },
      { type: "h3", text: "2) Çerez türleri" },
      {
        type: "li",
        text: "Zorunlu: Site işlevlerinin çalışması için gerekli.",
      },
      {
        type: "li",
        text: "Tercih: Dil/tema gibi tercihleri hatırlayabilir.",
      },
      {
        type: "li",
        text: "Analitik: Site performansını ölçmeye yardımcı olabilir (kullanım varsa).",
      },
      { type: "h3", text: "3) Yönetim" },
      {
        type: "p",
        text: "Tarayıcı ayarlarınızdan çerezleri silebilir/engelleyebilirsiniz. Bazı özellikler bu durumda çalışmayabilir.",
      },
    ],
  },
  retention: {
    title: "Saklama ve İmha Politikası",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: "Bu politika, SahayaBak kapsamında işlenen verilerin saklanma sürelerini ve imha yöntemlerini açıklamak için hazırlanmıştır.",
      },
      { type: "h3", text: "1) Genel ilkeler" },
      {
        type: "li",
        text: "Veriler, işleme amacının gerektirdiği süre kadar saklanır.",
      },
      {
        type: "li",
        text: "İhtiyaç kalmadığında silme, yok etme veya anonimleştirme uygulanır.",
      },
      { type: "h3", text: "2) Örnek saklama süreleri" },
      {
        type: "li",
        text: "Hesap/Profil: Üyelik devam ettiği sürece; silme talebi sonrası makul süre.",
      },
      {
        type: "li",
        text: "Maç kayıtları: Hizmet kalitesi ve geçmiş görüntüleme için sınırlı süre.",
      },
      {
        type: "li",
        text: "Mesajlar: Hizmetin yürütülmesi için gerekli süre ve/veya yasal zorunluluklara göre.",
      },
      {
        type: "li",
        text: "Log/Analitik: Güvenlik ve hata ayıklama için sınırlı süre.",
      },
      { type: "h3", text: "3) İmha yöntemleri" },
      {
        type: "li",
        text: "Silme: Verinin sistemlerden geri döndürülemeyecek şekilde kaldırılması.",
      },
      {
        type: "li",
        text: "Anonimleştirme: Kişiyle ilişkilendirilemeyecek hale getirme.",
      },
    ],
  },
  community: {
    title: "Topluluk İlkeleri",
    blocks: [
      { type: "meta", text: `Son güncelleme: ${UPDATED_AT}` },
      {
        type: "p",
        text: "SahayaBak topluluğunda herkesin güvenli ve saygılı bir deneyim yaşaması amaçlanır.",
      },
      { type: "h3", text: "1) Saygı ve güvenlik" },
      {
        type: "li",
        text: "Taciz, nefret söylemi, ayrımcılık, tehdit ve zorbalık yasaktır.",
      },
      {
        type: "li",
        text: "Başkasının kişisel bilgisini izinsiz paylaşmayın.",
      },
      { type: "h3", text: "2) Sahtecilik ve spam" },
      {
        type: "li",
        text: "Sahte hesap, yanıltıcı içerik, spam mesaj ve suistimal yasaktır.",
      },
      { type: "h3", text: "3) İçerik kuralları" },
      {
        type: "li",
        text: "Yasa dışı içerik, yetişkin içerik ve şiddet övücülüğü yasaktır.",
      },
      {
        type: "li",
        text: "Maç ilanlarında doğru bilgi verin (tarih/saat/konum).",
      },
      { type: "h3", text: "4) Yaptırımlar" },
      {
        type: "p",
        text: "İhlallerde içerik kaldırma, kısıtlama, geçici/kalıcı hesap kapatma uygulanabilir.",
      },
      { type: "h3", text: "5) Bildirim" },
      { type: "p", text: `İhlal bildirimleri için: ${CONTACT_EMAIL}` },
    ],
  },
};

export const POLICY_KEYS: PolicyKey[] = [
  "terms",
  "privacy",
  "kvkk",
  "cookies",
  "retention",
  "community",
];
