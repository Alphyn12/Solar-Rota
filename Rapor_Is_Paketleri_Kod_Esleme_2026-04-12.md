# Rapor İş Paketleri ve Kod Eşleme

Tarih: 2026-04-12
Kapsam: `GunesHesap_Ultra_Mega_Analiz_Raporu_2026-04-12.md` maddelerinin uygulanabilir iş paketlerine ayrılması, mevcut kodla eşlenmesi ve doğrulama izi.

## P0/P1 Doğruluk Paketleri

| Paket | Rapor maddesi | Durum | Kod eşlemesi | UI/çıktı | Test kanıtı |
|---|---|---:|---|---|---|
| WP-CALC-01 | NPV ilk yatırım maliyetini düşmeli | Tamamlandı | `js/calc-core.js::computeFinancialTable` | Ana sonuç, mühendis raporu, PDF | `tests/calc-core.test.mjs`, `tests/calc-regression.test.mjs` |
| WP-CALC-02 | Fiyat artışı ilk yıldan şişmemeli | Tamamlandı | `js/calc-core.js::computeFinancialTable` | 25 yıl tablosu, senaryo analizi | `priceIncreaseStartsAfterFirstYear` fixture |
| WP-CALC-03 | Saatlik profil normalize edilmeli | Tamamlandı | `js/calc-core.js::normalizeProfile`, `simulateHourlyEnergy` | Saatlik profil ve net mahsuplaşma | `tests/calc-core.test.mjs` |
| WP-CALC-04 | Saatlik mahsuplaşma ana motora girmeli | Tamamlandı | `js/calc-engine.js`, `js/calc-core.js::simulateHourlyEnergy` | Net metering, audit paneli | `tests/calc-core.test.mjs` |
| WP-CALC-05 | 8760 saat CSV gerçek 365 gün olmalı | Tamamlandı | `js/bill-analysis.js`, `js/calc-core.js::COMMON_YEAR_MONTH_DAYS` | Fatura analizi CSV yükleme | `tests/calc-regression.test.mjs` |
| WP-CALC-06 | PVGIS `loss` raporla tutarlı olmalı | Tamamlandı | `js/calc-core.js::PVGIS_LOSS_PARAM`, `js/eng-report.js` | Mühendis raporu, PDF metodoloji satırı | Browser smoke test |
| WP-CALC-07 | Tarife varsayımları kullanıcı girdisi olmalı | Tamamlandı | `js/app.js::updateTariffAssumptions`, `js/calc-core.js::buildTariffModel` | Tarife, ihracat tarife, artış, iskonto, kaynak tarihi | Syntax + browser smoke |
| WP-CALC-08 | KDV iadesi gross toplamdan ikinci kez hesaplanmamalı | Tamamlandı | `js/calc-engine.js::calculateTaxBenefits` | Vergi avantajı kartı | Syntax + engine flow |
| WP-CALC-09 | Kablo kaybı 1 faz/3 faz seçebilmeli | Tamamlandı | `js/cable-loss.js` | Kablo kaybı bloğu | Syntax check |
| WP-CALC-10 | Kablo kaybı gerçek panel/multi-roof gücünü kullanmalı | Tamamlandı | `js/cable-loss.js`, `js/calc-core.js::calculateSystemLayout` | Kablo kaybı ön izleme | Syntax check |
| WP-CALC-11 | Batarya ana saatlik modele bağlanmalı | Tamamlandı | `js/calc-core.js::simulateBatteryOnHourlySummary`, `js/calc-engine.js` | Batarya sonucu, NPV/LCOE etkisi | `tests/calc-core.test.mjs` |
| WP-CALC-12 | EV ve ısı pompası ana tüketim profiline bağlanmalı | Tamamlandı | `js/calc-core.js::calculateEVLoad`, `calculateHeatPumpLoad`, `js/calc-engine.js` | EV/ısı pompası sonuç kartları | Syntax + flow |
| WP-CALC-13 | Teklif karşılaştırması çekirdek finansala bağlanmalı | Tamamlandı | `js/comparison.js`, `js/calc-core.js::computeFinancialTable` | Karşılaştırma modalı | Syntax check |

## 25 Olmazsa Olmaz Özellik Eşlemesi

| # | Özellik | Durum | Kod/UI eşlemesi |
|---:|---|---:|---|
| 1 | Hesap metodolojisi, formüller, varsayımlar, sürüm | Tamamlandı | `js/eng-report.js`, `js/ui-render.js`, `METHODOLOGY_VERSION` |
| 2 | Saatlik mahsuplaşma motoru | Tamamlandı | `js/calc-core.js::simulateHourlyEnergy` |
| 3 | 8760 saat CSV yükleme | Tamamlandı | `js/bill-analysis.js`, Step 3 fatura bloğu |
| 4 | Resmi tarife modu / PST-SKTT / manuel sözleşme yaklaşımı | Tamamlandı | `TARIFF_META`, `buildTariffModel`, Step 3 tarife alanları |
| 5 | Tarife kaynak tarihi rozeti | Tamamlandı | `tariff-source-date`, audit paneli, PDF |
| 6 | NPV/IRR/LCOE test paketi | Tamamlandı | `tests/calc-core.test.mjs`, `tests/calc-regression.test.mjs` |
| 7 | PVGIS kaynak detayı ve metodoloji izi | Tamamlandı | `pvgisLossParam`, `calculationMode`, mühendis raporu |
| 8 | Fallback kalite uyarısı | Tamamlandı | `confidenceLevel`, `calculationWarnings`, fallback banner |
| 9 | Batarya saatlik simülasyonu | Tamamlandı | `simulateBatteryOnHourlySummary` |
| 10 | EV ve ısı pompası yük entegrasyonu | Tamamlandı | `calculateEVLoad`, `calculateHeatPumpLoad`, sonuç kartları |
| 11 | Kablo kaybı 1 faz/3 faz | Tamamlandı | `js/cable-loss.js`, Step 3 kablo bloğu |
| 12 | Panel yerleşim kaba doğrulama | Tamamlandı | `calculateSystemLayout`, panel preview, multi-roof |
| 13 | Ticari disclaimer ve rapor imzası | Tamamlandı | PDF kapak, mühendis raporu notları |
| 14 | Veri gizliliği notu | Tamamlandı | Audit paneli, dashboard/localStorage açıklaması |
| 15 | Tam paylaşım linki | Tamamlandı | `shareResults`, `loadFromHash` v2 state snapshot |
| 16 | Senaryo karşılaştırmayı çekirdeğe yaklaştırma | Tamamlandı | `js/comparison.js` çekirdek finansal tablo |
| 17 | Hassasiyet analizi | Tamamlandı | `js/scenarios.js::renderSensitivityTable` |
| 18 | Güven aralığı / kötü-baz-iyi senaryo | Tamamlandı | Senaryo analizi, FX projeksiyonu, confidence etiketi |
| 19 | Maliyet kalemi editörü | Tamamlandı | Step 3 maliyet editörü, `costOverrides` |
| 20 | Müşteri ve teknik rapor ayrımı | Tamamlandı | `downloadPDF`, `downloadTechnicalPDF`, sonuç ekranı aksiyon butonları |
| 21 | Offline asset precache | Tamamlandı | `service-worker.js::STATIC_ASSETS` |
| 22 | CDN fallback / yerel vendor opsiyonu | Kısmi tamamlandı | Service worker runtime cache; yerel vendor kopyaları yok |
| 23 | Çoklu dil altyapısı | Kısmi tamamlandı | `locales/*.json`, `js/i18n.js`; dinamik metinlerin tamamı bağlı değil |
| 24 | Audit paneli | Tamamlandı | `js/ui-render.js::renderWarningsAndAudit` |
| 25 | Hata yakala modu | Tamamlandı | `detectCalculationWarnings`, audit paneli |

## Kalan Kısmi Paketler

- WP-OFFLINE-01: Leaflet, Chart.js ve jsPDF için yerel vendor kopyası ekle; 0 TL bütçeyle yapılabilir ama dosya hacmini artırır.
- WP-I18N-01: JS ile üretilen tüm dinamik metinleri `locales/*.json` anahtarlarına bağla.
- WP-DATA-01: Tüm ticari fiyat/tarife varsayımları için resmi kaynak URL'si, manuel doğrulama tarihi ve kullanıcı imzası alanı ekle.

## Doğrulama Komutları

- `npm test`
- `npm run check`
- `npm run test:usd`
