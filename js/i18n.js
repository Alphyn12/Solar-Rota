// ═══════════════════════════════════════════════════════════
// i18n — Çok Dil Desteği (Faz F)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'guneshesap_lang';
const SUPPORTED = ['tr', 'en', 'de'];

const STATIC_BINDINGS = [
  ['.logo-tagline', 'app.tagline'],
  ['.step-dot[data-step="1"] .step-dot-label', 'nav.step1'],
  ['.step-dot[data-step="2"] .step-dot-label', 'nav.step2'],
  ['.step-dot[data-step="3"] .step-dot-label', 'nav.step3'],
  ['.step-dot[data-step="4"] .step-dot-label', 'nav.step4'],
  ['.step-dot[data-step="5"] .step-dot-label', 'nav.step5'],
  ['#step-1 .step-heading-title', 'step1.title'],
  ['#step-1 .step-heading-sub', 'step1.subtitle'],
  ['#city-search', 'step1.search', 'placeholder'],
  ['#geolocation-btn', 'step1.geoBtn'],
  ['#step-1 .two-col > div:first-child .card-title', 'step1.locationCard'],
  ['#step-1 .nav-btns .btn-primary', 'step1.next'],
  ['#step-2 .step-heading-title', 'step2.title'],
  ['#step-2 .step-heading-sub', 'step2.subtitle'],
  ['#step-2 .two-col > div:first-child .card-title', 'step2.roofInfo'],
  ['#step-2 .two-col > div:nth-child(2) .card-title', 'step2.roofOrientation'],
  ['#step-2 .nav-btns .btn-secondary', 'common.back'],
  ['#step-2 .nav-btns .btn-primary', 'step2.next'],
  ['#step-3 .step-heading-title', 'step3.title'],
  ['#step-3 .step-heading-sub', 'step3.subtitle'],
  ['#step-3 .nav-btns .btn-secondary', 'common.back'],
  ['#step-3 .nav-btns .btn-primary', 'step3.calculate'],
  ['#step-4 .loading-msg', 'step4.subtitle'],
  ['#step-5 .step-heading-title', 'step5.title'],
  ['#step-5 .step-heading-sub', 'step5.subtitle'],
  ['#step-5 .kpi-card:nth-child(1) .kpi-unit', 'units.kwhPerYear'],
  ['#step-5 .kpi-card:nth-child(1) .kpi-label', 'step5.annualEnergy'],
  ['#step-5 .kpi-card:nth-child(2) .kpi-label', 'step5.annualSavings'],
  ['#step-5 .kpi-card:nth-child(3) .kpi-unit', 'units.kwpInstalled'],
  ['#step-5 .kpi-card:nth-child(3) .kpi-label', 'step5.systemPower'],
  ['#step-5 .kpi-card:nth-child(4) .kpi-unit', 'units.tonsCo2PerYear'],
  ['#step-5 .kpi-card:nth-child(4) .kpi-label', 'step5.co2'],
  ['#step-5 .fin-box .card-title', 'finance.analysis'],
  ['#step-5 .fin-box .fin-row:nth-of-type(2) .fin-label', 'step5.totalCost'],
  ['#step-5 .fin-box .fin-row:nth-of-type(3) .fin-label', 'finance.simplePayback'],
  ['#step-5 .fin-box .fin-row:nth-of-type(4) .fin-label', 'finance.discountedPayback'],
  ['#step-5 .fin-box .fin-row:nth-of-type(5) .fin-label', 'finance.npv'],
  ['#step-5 .fin-box .fin-row:nth-of-type(6) .fin-label', 'finance.roi'],
  ['#step-5 .fin-box .fin-row:nth-of-type(7) .fin-label', 'finance.irr'],
  ['#step-5 .fin-box .fin-row:nth-of-type(8) .fin-label', 'finance.lcoe'],
  ['#step-5 .fin-box .fin-row:nth-of-type(9) .fin-label', 'finance.om'],
  ['#step-5 .fin-box .fin-row:nth-of-type(10) .fin-label', 'finance.inverterReplace'],
  ['#fin-cost', 'common.pending'],
  ['#dashboard-btn', 'dashboard.saved'],
  ['#tariff-desc', 'finance.tariffDesc'],
  ['#exchange-rate-status', 'finance.exchangeLoading'],
  ['#nm-license-badge', 'finance.settlementBadge'],
  ['.chart-wrap .chart-title', 'results.monthlyChart'],
  ['#scenario-card .card-title', 'results.scenarios'],
  ['#hourly-profile-card .card-title', 'results.hourlyProfile'],
  ['#sun-path-card .card-title', 'results.sunPath'],
  ['#heatmap-card .card-title', 'results.heatmap']
];

export function readSavedLanguage(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem?.(STORAGE_KEY);
    return SUPPORTED.includes(saved) ? saved : 'tr';
  } catch { return 'tr'; }
}

export function persistLanguage(lang, storage = globalThis.localStorage) {
  const safe = SUPPORTED.includes(lang) ? lang : 'tr';
  try { storage?.setItem?.(STORAGE_KEY, safe); } catch { /* ignore */ }
  return safe;
}

export function applyTextTranslations(elements, translate) {
  elements.forEach(item => {
    const val = translate(item.key);
    if (!val || val === item.key) return;
    if (item.attr === 'placeholder') item.el.placeholder = val;
    else if (item.attr === 'title') item.el.title = val;
    else item.el.textContent = val;
  });
}

export const i18n = {
  locale: 'tr',
  translations: {},

  async loadLocale(lang) {
    const safeLang = SUPPORTED.includes(lang) ? lang : 'tr';
    try {
      const res = await fetch(`./locales/${safeLang}.json`);
      if (!res.ok) throw new Error('Locale not found');
      this.translations = await res.json();
      this.locale = safeLang;
      persistLanguage(safeLang);
      this.applyTranslations();
      this.updateLangButtons();
      this.afterLanguageChange();
    } catch(e) {
      console.warn('Locale yüklenemedi:', lang, e);
    }
  },

  t(key) {
    const result = key.split('.').reduce((obj, k) => obj?.[k], this.translations);
    return result || key;
  },

  applyTranslations() {
    const selectorItems = [];
    STATIC_BINDINGS.forEach(([selector, key, attr]) => {
      document.querySelectorAll(selector).forEach(el => selectorItems.push({ el, key, attr }));
    });
    applyTextTranslations(selectorItems, key => this.t(key));

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      if (val !== key) el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const val = this.t(key);
      if (val !== key) el.placeholder = val;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const val = this.t(key);
      if (val !== key) el.title = val;
    });
    document.documentElement.lang = this.locale;
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = this.t('app.title') + ' — ' + this.t('app.subtitle');
  },

  updateLangButtons() {
    document.querySelectorAll('[data-lang]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === this.locale);
    });
  },

  afterLanguageChange() {
    window.renderExchangeRateStatus?.();
    window.updateDashboard?.();
    if (window.state?.results) {
      window.renderResults?.();
      window.renderEngReport?.();
      window.renderHourlyProfile?.();
      window.renderScenarioAnalysis?.();
    }
  },

  async init() {
    const saved = readSavedLanguage();
    await this.loadLocale(saved);
  }
};

export async function switchLanguage(lang) {
  await i18n.loadLocale(lang);
}

// window'a expose et
if (typeof window !== 'undefined') {
  window.i18n = i18n;
  window.switchLanguage = switchLanguage;
}
