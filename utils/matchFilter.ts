// utils/matchFilter.ts
export const filterMatchesByTurkeyTime = (matches: any[]) => {
    if (!matches) return [];
  
    // Şu anki Türkiye zamanı
    const now = new Date();
    const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const turkeyNow = new Date(utcNow.getTime() + 3 * 3600000);
  
    return matches
      .filter((item) => {
        const matchDateTime = new Date(`${item.date}T${item.time}:00`);
        const matchEndTime = new Date(matchDateTime.getTime() + 60 * 60 * 1000); // maç süresi 1 saat
        return matchEndTime > turkeyNow; // sadece gelecekte olanları göster
      })
      .map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
        startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
        endFormatted: `${(parseInt(item.time.split(":")[0]) + 1)
          .toString()
          .padStart(2, "0")}:${item.time.split(":")[1]}`,
      }));
  };
  