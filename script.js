/**
 * Willsim - Script d'interaction, accessibilité mobile et consentement cookies
 * Chargé avec "defer" : le DOM est prêt quand ce fichier s'exécute.
 */

// ---------------------------------------------------------------------------
// Configuration Matomo (mesure d'audience, chargée UNIQUEMENT après consentement)
// Laisser MATOMO_URL vide tant que l'instance n'est pas créée : rien n'est chargé.
// Si vous changez de domaine Matomo, mettez aussi à jour la CSP dans .htaccess.
// ---------------------------------------------------------------------------
const MATOMO_URL = ""; // ex. "https://willsim.matomo.cloud/"
const MATOMO_SITE_ID = "1";
const CONSENT_KEY = "willsim-consent";
const CONSENT_MAX_AGE = 1000 * 60 * 60 * 24 * 182; // 6 mois (recommandation CNIL)

// 1. Année dynamique du copyright
const yearEl = document.querySelector("#year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

// 2. Menu mobile : "inert" retire le tiroir fermé du clavier ET des lecteurs d'écran
const navToggle = document.querySelector("#nav-toggle");
const navMenu = document.querySelector("#mobile-nav");
const behindMenu = document.querySelectorAll("main, footer");

function setMenu(open) {
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Fermer le menu de navigation" : "Ouvrir le menu de navigation");
  navMenu.classList.toggle("is-open", open);
  navMenu.inert = !open;
  // Le contenu derrière le tiroir devient inaccessible : le focus reste dans le menu
  behindMenu.forEach((el) => { el.inert = open; });
  document.body.classList.toggle("menu-locked", open);
  if (open) navMenu.querySelector("a").focus();
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });

  // Fermer au clic sur un lien ou sur le fond assombri
  navMenu.querySelectorAll("a, .mobile-nav-backdrop").forEach((el) => {
    el.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navMenu.classList.contains("is-open")) {
      setMenu(false);
      navToggle.focus();
    }
  });
}

// 3. FAQ : une seule question ouverte à la fois
const faqItems = document.querySelectorAll(".faq-item");
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    faqItems.forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

// 4. Consentement cookies (RGPD / CNIL)
function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (saved && Date.now() - saved.date < CONSENT_MAX_AGE) return saved.value;
  } catch (e) {
    // localStorage indisponible (navigation privée stricte) : on redemandera
  }
  return null;
}

function saveConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, date: Date.now() }));
  } catch (e) {
    // Choix non mémorisé : sans conséquence, aucun traceur n'est chargé par défaut
  }
}

function loadMatomo() {
  if (!MATOMO_URL || window._paq) return;
  const _paq = (window._paq = []);
  _paq.push(["trackPageView"], ["enableLinkTracking"]);
  _paq.push(["setTrackerUrl", MATOMO_URL + "matomo.php"], ["setSiteId", MATOMO_SITE_ID]);
  const s = document.createElement("script");
  s.async = true;
  s.src = MATOMO_URL + "matomo.js";
  document.head.appendChild(s);
}

function clearMatomoCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_pk_")) {
      document.cookie = name + "=; Max-Age=0; path=/";
    }
  });
}

function showCookieBanner() {
  if (document.querySelector(".cookie-banner")) return;
  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Gestion des cookies");
  banner.innerHTML =
    "<p>Avec votre accord, nous mesurons l'audience du site avec Matomo pour l'améliorer. " +
    "Aucune publicité, aucune revente de données. " +
    '<a href="/confidentialite.html">En savoir plus</a></p>' +
    '<div class="cookie-actions">' +
    '<button type="button" data-consent="denied">Refuser</button>' +
    '<button type="button" data-consent="granted">Accepter</button>' +
    "</div>";
  banner.addEventListener("click", (e) => {
    const value = e.target.dataset.consent;
    if (!value) return;
    const wasGranted = readConsent() === "granted";
    saveConsent(value);
    banner.remove();
    if (value === "granted") {
      loadMatomo();
    } else if (wasGranted) {
      // Retrait du consentement : on supprime les cookies et on recharge sans Matomo
      clearMatomoCookies();
      location.reload();
    }
  });
  document.body.appendChild(banner);
}

const consent = readConsent();
if (consent === "granted") loadMatomo();
// Pas de bandeau tant qu'aucun traceur n'est configuré : rien à consentir
if (consent === null && MATOMO_URL) showCookieBanner();

// Liens « Cookies » / « Gérer mes préférences » : rouvrent le bandeau
document.querySelectorAll("[data-cookie-settings]").forEach((btn) => {
  btn.addEventListener("click", showCookieBanner);
});
