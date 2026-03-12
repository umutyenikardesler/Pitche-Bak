const UPDATED_AT   = "12.03.2026";
const CONTACT_EMAIL = "info@sahayabak.com";

const SERVER_REQUIRED_MSG = "Bu sayfayı bir web sunucusu üzerinden açmanız gerekiyor (örn. npx serve web).";

const POLICIES = {
  terms: {
    title: "Kullanıcı Sözleşmesi",
    file: "./modals/kullanici-sozlesmesi.html",
  },
  privacy: {
    title: "Gizlilik Politikası",
    file: "./modals/gizlilik-politikasi.html",
  },
  kvkk: {
    title: "KVKK Aydınlatma Metni",
    file: "./modals/kvkk-aydinlatma-metni.html",
  },
  cookies: {
    title: "Çerez Politikası",
    file: "./modals/cerez-politikasi.html",
  },
  retention: {
    title: "Saklama ve İmha Politikası",
    file: "./modals/saklama-ve-imha-politikasi.html",
  },
  community: {
    title: "Topluluk İlkeleri",
    file: "./modals/topluluk-ilkeleri.html",
  },
};

function applyTokens(html) {
  return html
    .replace(/\{\{updatedAt\}\}/g, UPDATED_AT)
    .replace(/\{\{contactEmail\}\}/g, CONTACT_EMAIL);
}

function ensureModalShell() {
  let modalEl = document.getElementById("policyModal");
  if (modalEl) return modalEl;

  const holder = document.createElement("div");
  holder.innerHTML = `
    <div class="modalOverlay" id="policyModal" hidden aria-hidden="true">
      <div class="modalCard" role="dialog" aria-modal="true" aria-labelledby="policyModalTitle">
        <div class="modalHeader">
          <h2 class="modalTitle" id="policyModalTitle">Metin</h2>
          <button class="modalClose" type="button" id="policyModalClose" aria-label="Kapat">Kapat</button>
        </div>
        <div class="modalBody">
          <div class="policy" id="policyModalBody"></div>
        </div>
      </div>
    </div>
  `.trim();

  modalEl = holder.firstElementChild;
  document.body.appendChild(modalEl);
  return modalEl;
}

function setupPolicyModal(modalEl) {
  const modalTitle = document.getElementById("policyModalTitle");
  const modalBody  = document.getElementById("policyModalBody");
  const closeBtn   = document.getElementById("policyModalClose");

  async function openPolicy(key) {
    const cfg = POLICIES[key];
    if (!cfg) return;

    modalTitle.textContent = cfg.title;
    modalBody.innerHTML = '<p class="policy-loading">Yükleniyor…</p>';
    modalEl.hidden = false;
    modalEl.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const base = new URL(".", window.location.href).href;
    const url = new URL(cfg.file, base).href;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText || "Yükleme başarısız");
      let html = await res.text();
      html = applyTokens(html);
      modalBody.innerHTML = html;
    } catch {
      modalBody.innerHTML = `<p class="policy-error">${SERVER_REQUIRED_MSG}</p>`;
    }
  }

  function closePolicy() {
    modalEl.hidden = true;
    modalEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalBody.innerHTML = "";
  }

  document.querySelectorAll("[data-policy]").forEach((btn) => {
    btn.addEventListener("click", () => openPolicy(btn.getAttribute("data-policy")));
  });

  closeBtn.addEventListener("click", closePolicy);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closePolicy();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.hidden) closePolicy();
  });
}

function main() {
  const modalEl = ensureModalShell();
  setupPolicyModal(modalEl);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
