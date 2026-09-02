import { supabase } from '@/services/supabase';

// Supabase Storage'daki "pictures" bucket'ında profil resmi yönetimi.
//
// Güncel klasör yapısı: <userId>/<yyyy>/<MM>/profile_<yyyy-MM-dd>_<HH-mm-ss>.jpg
// Geçmişte iki eski format kullanıldı (düz <userId>/profile_<epoch>.jpg ve
// year/month altında ':' ayırıcılı isimler); aşağıdaki migration'lar ikisini de
// mevcut yapıya taşır.

// Tüm kullanıcıların eski resimlerini yeni formata çevir
export const migrateAllUsersImagesToNewFormat = async () => {
  try {
    // Tüm kullanıcıları al
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id");

    if (usersError || !allUsers) {
      console.error("Kullanıcılar alınamadı:", usersError);
      return;
    }

    for (const user of allUsers) {
      try {
        await migrateOldImagesToNewStructure(user.id);
      } catch (userError) {
        console.error(`❌ Kullanıcı ${user.id} için migration hatası:`, userError);
      }
    }
  } catch (error) {
    console.error("Genel migration hatası:", error);
  }
};

// Eski resimleri yeni klasör yapısına taşı ve formatını düzelt
export const migrateOldImagesToNewStructure = async (userId: string) => {
  try {
    // Ana klasördeki tüm dosyaları listele
    const { data: allFiles, error: listError } = await supabase.storage
      .from("pictures")
      .list(`${userId}/`, {
        limit: 1000,
      });

    if (listError || !allFiles) {
      console.error("Dosyalar listelenemedi:", listError);
      return;
    }

    // Sadece profile resimlerini filtrele (eski yapıda olanlar)
    const oldProfileImages = allFiles.filter(file => 
      file.name.startsWith("profile_") && 
      !file.name.includes("/") // Klasör yapısında olanlar
    );

    // Year/month klasörlerindeki eski format resimleri de bul
    let yearMonthOldImages: { name: string; path: string }[] = [];
    
    for (const yearFolder of allFiles) {
      if (yearFolder.name && /^\d{4}$/.test(yearFolder.name)) {
        const { data: monthFolders } = await supabase.storage
          .from("pictures")
          .list(`${userId}/${yearFolder.name}/`, {
            limit: 100,
          });

        if (monthFolders) {
          for (const monthFolder of monthFolders) {
            if (monthFolder.name && /^\d{2}$/.test(monthFolder.name)) {
              const { data: files } = await supabase.storage
                .from("pictures")
                .list(`${userId}/${yearFolder.name}/${monthFolder.name}/`, {
                  limit: 100,
                });

              if (files) {
                const oldFormatFiles = files
                  .filter(file => 
                    file.name.startsWith("profile_") && 
                    file.name.includes('-') && // Eski format: profile_2025-08-31_17-46-16.jpg
                    !file.name.includes(':') // Yeni format değil
                  )
                  .map(file => ({
                    name: file.name,
                    path: `${userId}/${yearFolder.name}/${monthFolder.name}/${file.name}`
                  }));

                yearMonthOldImages.push(...oldFormatFiles);
              }
            }
          }
        }
      }
    }

    // Tüm eski format resimleri birleştir
    const allOldImages = [
      ...oldProfileImages.map(file => ({ name: file.name, path: `${userId}/${file.name}` })),
      ...yearMonthOldImages
    ];

    if (allOldImages.length === 0) {
      return;
    }

    for (const oldImage of allOldImages) {
      try {
        // Dosya adından timestamp çıkar
        const timestampStr = oldImage.name.replace("profile_", "").replace(".jpg", "");
        let timestamp: number;
        
        if (timestampStr.includes('-')) {
          // Yeni format: profile_2025-08-31_14-30-25.jpg
          const dateTimeStr = timestampStr.replace(/_/g, ' ').replace(/-/g, ':');
          timestamp = new Date(dateTimeStr).getTime();
        } else {
          // Eski format: profile_1756644880709.jpg
          timestamp = parseInt(timestampStr);
        }
        
        if (isNaN(timestamp)) continue;

        // Tarih bilgilerini hesapla
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        // Yeni dosya yolu (yeni format ile)
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        const newFileName = `profile_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.jpg`;
        const newPath = `${userId}/${year}/${month}/${newFileName}`;
        const oldPath = oldImage.path || `${userId}/${oldImage.name}`;

        // Dosyayı yeni konuma kopyala
        const { data: fileData } = await supabase.storage
          .from("pictures")
          .download(oldPath);

        if (fileData) {
          // Yeni konuma yükle
          const { error: uploadError } = await supabase.storage
            .from("pictures")
            .upload(newPath, fileData, {
              contentType: 'image/jpeg',
              cacheControl: '3600'
            });

          if (!uploadError) {
            // Eski dosyayı sil
            await supabase.storage
              .from("pictures")
              .remove([oldPath]);
          } else {
            console.error(`❌ Yükleme hatası: ${oldImage.name}`, uploadError);
          }
        }
      } catch (migrateError) {
        console.error(`❌ Taşıma hatası: ${oldImage.name}`, migrateError);
      }
    }
  } catch (error) {
    console.error("Resim taşıma hatası:", error);
  }
};





// En güncel profil resmi Storage klasörleri taranarak bulunuyor (kök → yıl → ay).
// Bu tarama birden fazla ağ turu demek ve aynı kullanıcı için ekran başına defalarca
// çağrılabiliyor. Bu yüzden sonucu kullanıcı bazında kısa süreli önbellekliyoruz ve
// eşzamanlı istekleri tek isteğe indiriyoruz.
const PROFILE_IMAGE_TTL_MS = 5 * 60 * 1000;
const profileImageCache = new Map<string, { url: string | null; at: number }>();
const profileImageInflight = new Map<string, Promise<string | null>>();

/**
 * Profil resmi önbelleğini temizler. Yeni resim yüklendiğinde ya da dosyalar taşındığında
 * MUTLAKA çağrılmalı; aksi halde kullanıcı TTL boyunca eski resmini görür.
 */
export const clearProfileImageCache = (userId?: string) => {
  if (userId) {
    profileImageCache.delete(userId);
    profileImageInflight.delete(userId);
  } else {
    profileImageCache.clear();
    profileImageInflight.clear();
  }
};

export const fetchLatestProfileImage = async (userId: string): Promise<string | null> => {
  if (!userId) return null;

  const cached = profileImageCache.get(userId);
  if (cached && Date.now() - cached.at < PROFILE_IMAGE_TTL_MS) {
    return cached.url;
  }

  const inflight = profileImageInflight.get(userId);
  if (inflight) return inflight;

  const request = fetchLatestProfileImageUncached(userId)
    .then((url) => {
      profileImageCache.set(userId, { url, at: Date.now() });
      return url;
    })
    .finally(() => {
      profileImageInflight.delete(userId);
    });

  profileImageInflight.set(userId, request);
  return request;
};

const fetchLatestProfileImageUncached = async (userId: string): Promise<string | null> => {
  try {
    // Ana kullanıcı klasörünü listele
    const { data: userFolders, error: userError } = await supabase.storage
      .from("pictures")
      .list(`${userId}/`, {
        limit: 100,
      });

    if (userError) {
      console.error("Kullanıcı klasörleri listelenemedi:", userError);
      return null;
    }

    if (!userFolders || userFolders.length === 0) {
      return null;
    }

    // Yıl klasörleri paralel taranıyor (önceden sıralı await zinciriydi).
    const yearNames = userFolders
      .map((f) => f.name)
      .filter((name): name is string => !!name && /^\d{4}$/.test(name));

    const perYearImages = await Promise.all(
      yearNames.map(async (yearName) => {
        const { data: monthFolders } = await supabase.storage
          .from("pictures")
          .list(`${userId}/${yearName}/`, {
            limit: 100,
          });

        if (!monthFolders) return [];

        const monthNames = monthFolders
          .map((f) => f.name)
          .filter((name): name is string => !!name && /^\d{2}$/.test(name));

        // Ay klasörleri de paralel
        const perMonthImages = await Promise.all(
          monthNames.map(async (monthName) => {
            const { data: files } = await supabase.storage
              .from("pictures")
              .list(`${userId}/${yearName}/${monthName}/`, {
                limit: 100,
              });

            if (!files) return [];

            return files
              .filter((file) => file.name.startsWith("profile_"))
              .map((file) => {
                // Hem yeni format (profile_2025-08-31_17:08:46.jpg) hem eski format
                // (profile_2025-08-31_16-37-08.jpg) destekleniyor.
                const dateTimeStr = file.name.replace("profile_", "").replace(".jpg", "");
                const formattedDateTime = dateTimeStr.replace(/_/g, ' ');
                const [datePart, timePart] = formattedDateTime.split(' ');
                if (!datePart || !timePart) return null;

                const [year, month, day] = datePart.split('-').map(Number);
                // Yeni formatta saat ayırıcısı ':', eskisinde '-'
                const [hours, minutes, seconds] = timePart
                  .split(timePart.includes(':') ? ':' : '-')
                  .map(Number);

                const timestamp = new Date(year, month - 1, day, hours, minutes, seconds).getTime();
                if (isNaN(timestamp)) return null;

                return {
                  path: `${userId}/${yearName}/${monthName}/${file.name}`,
                  timestamp,
                  name: file.name,
                };
              })
              .filter((item): item is { path: string; timestamp: number; name: string } => item !== null);
          })
        );

        return perMonthImages.flat();
      })
    );

    const allProfileImages = perYearImages.flat();
    if (allProfileImages.length === 0) {
      return null;
    }

    // Timestamp'e göre sırala (en yeni en üstte)
    allProfileImages.sort((a, b) => b.timestamp - a.timestamp);

    // Public URL al
    const { data: publicURLData } = supabase.storage
      .from("pictures")
      .getPublicUrl(allProfileImages[0].path);

    return publicURLData.publicUrl;

  } catch (error) {
    console.error("fetchLatestProfileImage'de hata:", error);
    return null;
  }
};
