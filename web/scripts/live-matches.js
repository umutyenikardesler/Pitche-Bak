/**
 * Landing sayfası: Kadrosu eksik maçların ilk 4'ünü hero kartında gösterir.
 * Supabase anon key ile public RLS altında çalışır.
 */
(function () {
  const SUPABASE_URL = "https://fqcjmrcnvrtqcytweyce.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxY2ptcmNudnJ0cWN5dHdleWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MjgzNTEsImV4cCI6MjA1NDAwNDM1MX0.wikCIj1tRlJuF7NDRn913fWdq1riabtmUGUxNOezFVM";

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(timeStr) {
    const [h, m] = (timeStr || "00:00").split(":");
    return `${h}:${m || "00"}`;
  }

  function getPitchName(pitches) {
    if (!pitches) return "—";
    const p = Array.isArray(pitches) ? pitches[0] : pitches;
    return p?.name || p?.address || "—";
  }

  function getDistrictName(pitches) {
    if (!pitches) return "";
    const p = Array.isArray(pitches) ? pitches[0] : pitches;
    const d = p?.districts;
    if (!d) return "";
    const dist = Array.isArray(d) ? d[0] : d;
    return dist?.name ? `, ${dist.name}` : "";
  }

  function isIncomplete(missingGroups) {
    if (!Array.isArray(missingGroups)) return false;
    return missingGroups.some((g) => {
      const parts = String(g).split(":");
      return parts.length === 2 && parseInt(parts[1], 10) > 0;
    });
  }

  function startMarquee(listEl) {
    const track = listEl.querySelector(".liveMatches__track");
    if (!track) return;

    track.style.animation = "liveMarquee 24s linear infinite";
  }

  async function loadLiveMatches() {
    const loadingEl = document.getElementById("liveMatchesLoading");
    const listEl = document.getElementById("liveMatchesList");
    const emptyEl = document.getElementById("liveMatchesEmpty");

    try {
      const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2"
      );
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const now = new Date();
      const todayLocal =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");
      const currentMins = now.getHours() * 60 + now.getMinutes();

      const { data, error } = await supabase
        .from("match")
        .select(
          "id, title, date, time, missing_groups, pitches (name, address, districts (name))"
        )
        .gte("date", todayLocal)
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(50);

      if (error) throw error;

      const filtered = (data || []).filter((item) => {
        const matchDateStr =
          typeof item.date === "string" && item.date.length >= 10
            ? item.date.slice(0, 10)
            : new Date(item.date).toISOString().slice(0, 10);
        if (matchDateStr > todayLocal) return true;
        if (matchDateStr < todayLocal) return false;
        const [h, m] = (item.time || "00:00").split(":").map(Number);
        const matchMins = (h || 0) * 60 + (m || 0);
        return matchMins > currentMins;
      }).filter((item) => isIncomplete(item.missing_groups));

      const matches = filtered.slice(0, 4);

      loadingEl.hidden = true;

      if (matches.length === 0) {
        emptyEl.hidden = false;
        listEl.hidden = true;
        return;
      }

      emptyEl.hidden = true;
      listEl.hidden = false;

      const itemHtml = (m, i) => {
        const isSoonest = i === 0;
        const cls = isSoonest ? "liveMatch liveMatch--soonest" : "liveMatch";
        return `
        <div class="${cls}">
          <div class="liveMatch__date">${formatDate(m.date)} · ${formatTime(m.time)}</div>
          <div class="liveMatch__place">${getPitchName(m.pitches)}${getDistrictName(m.pitches)}</div>
        </div>
      `;
      };

      const singleSet = matches.map((m, i) => itemHtml(m, i)).join("");
      listEl.innerHTML = `<div class="liveMatches__track">${singleSet}${singleSet}</div>`;

      startMarquee(listEl);
    } catch (err) {
      console.warn("live-matches:", err);
      loadingEl.hidden = true;
      emptyEl.hidden = false;
      emptyEl.textContent = "Maçlar yüklenemedi.";
      listEl.hidden = true;
    }
  }

  /* İlk layout tamamlandıktan sonra yükle - hero alanında kayma önlenir */
  function runWhenReady() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(loadLiveMatches, 50));
    } else {
      setTimeout(loadLiveMatches, 50);
    }
  }
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => requestAnimationFrame(runWhenReady));
  } else {
    runWhenReady();
  }
})();
