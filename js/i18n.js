// ═══════════════════════════════════════════════════════════
// i18n — Çok Dil Desteği (Faz F)
// GüneşHesap v2.0
// ═══════════════════════════════════════════════════════════

export const i18n = {
  locale: 'tr',
  translations: {},

  async loadLocale(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (!res.ok) throw new Error('Locale not found');
      this.translations = await res.json();
      this.locale = lang;
      localStorage.setItem('guneshesap_lang', lang);
      this.applyTranslations();
      this.updateLangButtons();
    } catch(e) {
      console.warn('Locale yüklenemedi:', lang, e);
    }
  },

  t(key) {
    const result = key.split('.').reduce((obj, k) => obj?.[k], this.translations);
    return result || key;
  },

  applyTranslations() {
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

  async init() {
    const saved = localStorage.getItem('guneshesap_lang') || 'tr';
    await this.loadLocale(saved);
  }
};

export async function switchLanguage(lang) {
  await i18n.loadLocale(lang);
}

// window'a expose et
window.i18n = i18n;
window.switchLanguage = switchLanguage;
