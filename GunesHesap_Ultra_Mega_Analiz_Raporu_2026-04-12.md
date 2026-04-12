# GunesHesap Ultra Mega Analiz Raporu

Tarih: 12 Nisan 2026  
Kapsam: `index.html`, `service-worker.js`, `manifest.json`, `package.json`, `css/components.css`, `js/*.js`, `locales/*.json` ve mevcut proje dokumanlari.  
Oncelik: hesap dogrulugu, ticari kullanima hazirlik, 0 TL butce ile yapilabilecek iyilestirmeler.

## 1. Kisa Ozet

GunesHesap, statik olarak calisabilen, moduler JavaScript ile yazilmis, PWA kabiliyeti olan bir Turkiye GES hesaplama ve raporlama uygulamasi. Ana akista konum secimi, cati/yuzey bilgisi, panel/inverter secimi, PVGIS veya fallback uretim hesabi, maliyet kirilimi, 25 yillik finansal projeksiyon, PDF rapor, kayitli hesaplar, teklif karsilastirma, saatlik profil, gunes yolu, isi pompasi, EV, vergi ve yapisal kontrol modulleri var.

En buyuk risk UI tarafinda degil; hesap motorundaki finansal varsayimlarin sabit/hardcoded olmasi, 2026 mevzuat degisikliklerinin modele yansimamis olmasi ve bazi modullerin "sonuc karti" gibi gorunmesine ragmen ana ROI/payback hesabina etki etmemesi.

Ticari kullanim icin bu haliyle "bilgilendirme/demonstrasyon" seviyesinde guclu; fakat "yanlis hesap olmamali" hedefi icin dogrudan satis/teklif/taahhut araci olarak kullanilmamali. Once kritik hesap buglari, resmi tarife/vergi/mevzuat modeli, otomatik regresyon testleri ve hesap metodolojisi versiyonlama eklenmeli.

## 2. Dogrulama Ozeti

- `node --check js/*.js` calistirildi: JS dosyalari syntax olarak temiz.
- Playwright ile yerel statik server uzerinden acilis testi yapildi: sayfa basligi yuklendi, console/pageerror yok.
- Playwright ile PVGIS mock denemesi yapildi: hesap akisi tamamlandi, sonuc objesi olustu. Service worker devre disi birakildiginda PVGIS mock yakalandi.
- `rg` komutu sandbox/izin sorunu nedeniyle calismadi; PowerShell dosya ve metin taramasi kullanildi.
- Proje git deposu degil; bu nedenle git diff/status tabanli degil, dosya bazli statik ve runtime inceleme yapildi.

## 3. Mimari Analiz

### 3.1 Teknoloji

- Frontend: tek sayfa `index.html`.
- Modul yapisi: ES module tabanli `js/app.js` ana orkestrator.
- Harita: Leaflet CDN.
- Grafik: Chart.js CDN.
- PDF: jsPDF CDN.
- PWA: `manifest.json` + `service-worker.js`.
- Veri saklama: localStorage (`dashboard.js`, `i18n.js`).
- Paket yonetimi: yalnizca `package.json` icinde `npm start = npx serve . -l 3000 --no-clipboard`; test/lint/build yok.

### 3.2 Ana Akis

1. Kullanici sehir/konum secer.
2. Cati alani, egim, yon, golge, kirlenme girer.
3. Panel ve inverter secilir.
4. Opsiyonel moduller acilir: fatura, batarya, net metering, O&M, kablo kaybi, EV, isi pompasi, vergi.
5. `runCalculation()` PVGIS veya fallback uretimi hesaplar.
6. Sonuc, grafik, muhendis raporu, PDF, dashboard ve senaryo modulleri guncellenir.

### 3.3 Guclu Yanlar

- Kod modullere ayrilmis; tek dosya karmasasi kismen cozulmus.
- PVGIS birincil kaynak olarak kullaniliyor; API basarisiz olursa fallback var.
- Fallback kullanildiysa kullaniciya banner gosteriliyor.
- Coklu cati yuzeyi destegi var.
- Inverter, batarya, kablo kaybi, vergi, EV, isi pompasi gibi ticari acidan degerli ek moduller dusunulmus.
- PDF ve paylasim linki ticari demo icin iyi bir baslangic.
- `renderMonthlyChart` icinde NaN/null guard var; bu iyi bir dayaniklilik ornegi.

## 4. Kritik Bulgular

### P0 - Finansal NPV formulu hatali etiketlenmis/hatalı hesaplanmis

`calc-engine.js` icinde `npvArray` yalnizca yillik net nakit akimlarinin bugunku degerlerini topluyor; ilk yatirim maliyeti ayrica dusulmuyor. Sonucta `npvTotal: Math.round(npvTotal + totalCost)` yapiliyor. Standart proje NPV formulu `-initialCost + discountedCashFlows` olmali. Mevcut hali yatirimin net bugunku degerini ciddi sekilde sisiriyor.

Etki: Ticari kullanimda "NPV pozitif" iddiasi yanlis cikabilir. Geri odeme/ROI ile birlikte musteri kararini dogrudan etkiler.

Oneri: `projectNPV = discountedNetCashFlows - totalCost`; eger "25 yil bugunku degerde brut nakit girişi" gosterilecekse farkli metrik adi kullanilmali.

### P0 - 2026 lisanssiz uretim mahsuplasma mantigi modele yansimamis

Kodda net metering, yillik toplam uretim ve yillik toplam tuketime gore `selfConsumptionRatio = annualConsumption / annualEnergy` yapiyor. Oysa Nisan 2026 duzenlemesiyle lisanssiz uretimde aylik genis zaman dilimi yerine saatlik mahsuplasma esasina gecis duyuruldu. Anadolu Ajansi haberine gore yeni duzende uretim ve tuketim "her saat icin ayri ayri" hesaplanacak; bazi hukumler 1 Mayis 2026'da uygulanmaya baslayacak. Kaynak: https://www.aa.com.tr/tr/enerjiterminali/genel/lisanssiz-elektrik-uretiminde-saatlik-mahsuplasma-donemi-basladi/56064

Etki: Ozellikle ticari isletmelerde gunduz/gece tuketim profili farkliysa ihracat, oz tuketim, gelir ve geri odeme hatali cikar.

Oneri: Net metering hesabini saatlik profil tabanli yap. Minimum 24 saat x 12 ay profil; daha iyi versiyon 8760 saat CSV yukleme.

### P0 - Tarife varsayimlari sabit ve guncel resmi tarife mantigini temsil etmiyor

`DEFAULT_TARIFFS` ve `state.tariff` sabit degerler kullaniyor. EPDK fatura hesaplama sayfasi 2026 icin son kaynak limitlerini ve PST/SKTT ayrimini vurguluyor; 2026'da mesken icin 4.000 kWh/yil, diger aboneler icin 15.000 kWh/yil limiti var. Kaynak: https://lisans.epdk.gov.tr/epvys-web/faces/pages/online/tarifeFatura/tarifeFatura.xhtml

Etki: Ticari kullanici, SKTT/ikili anlasma/ulusal tarife ayrimina girmeden tek TL/kWh ile hesap yapiyor. Bu, yillik tasarrufu ve payback'i dogrudan bozar.

Oneri: Tarife modelini `PST`, `SKTT`, `ikili anlasma`, `tek zamanli`, `uc zamanli`, `vergi dahil/haric`, `KDV`, `elektrik tuketim vergisi` alanlariyla ayrilastir.

### P0 - Elektrik fiyat artis orani hardcoded ve ilk yildan sisirilmis basliyor

`annualPriceIncrease = 0.25` sabit. 25 yillik tabloda `tariff * Math.pow(1 + annualPriceIncrease, year)` kullanildigi icin 1. yil bile bugunku tarifenin %25 artmis haliyle basliyor. Bu hem `annualSavings` ile 25 yillik tabloyu tutarsizlastiriyor hem de ROI/NPV'yi asiri buyutuyor.

Etki: Test senaryosunda mock PVGIS ile ROI %14113.9 gibi ticari karar icin guvenilmez bir deger uretildi. Asil sorun tek test degeri degil; model varsayiminin kullanici tarafindan gorulebilir/degistirilebilir olmamasi.

Oneri: Fiyat artisi kullanici girdisi olmali; 1. yil icin `year - 1` bazli hesap veya acik "ilk yil sonunda artar" varsayimi secilmeli. Baz/supheci/iyimser senaryolar ayri raporlanmali.

### P0 - Saatlik uretim profili normalize edilmedigi icin gunluk enerjiyi 4.64x-8.23x sisiriyor

`hourly-profile.js` icinde `dailyProduction * profileWeight` yapiliyor. Ancak profil agirliklarinin toplami 1 degil: yaz 8.23, kis 4.64, ilkbahar 6.78. Bu yuzden saatlik grafik ve oz tuketim/export/import istatistikleri fiziksel olarak imkansiz degerlere cikiyor.

Etki: Saatlik net metering'e gecildiginde bu modul kullanilirsa finansal hesaplar buyuk oranda yanlis olur.

Oneri: Profil agirliklarini once toplama bol: `hourlyProduction = dailyProduction * weight / sumWeights`.

### P0 - Muhendis raporu PVGIS parametresini yanlis gosteriyor

Gercek PVGIS URL'sinde `loss=0` kullaniliyor; muhendis raporu ise `loss=10%` yaziyor. Bu, hesap metodolojisi raporunda dogrudan yanlis beyan anlamina gelir.

Etki: Ticari rapor musteriye/vergi/teknik danismana verildiginde guven kaybi ve hukuki risk.

Oneri: Raporu kodla ayni parametreleri okuyacak sekilde uret. `loss=0` ise bunu ve sonradan uygulanan kayiplari acikca yaz.

## 5. Yuksek Onemli Bulgular

### P1 - Kablo kaybi 3 fazli sistemleri dogru modellemiyor

`cable-loss.js` AC tarafta her zaman `V_ac = 230` ve tek faz varsayiyor. 10 kWp uzeri ticari sistemlerde 3 faz 400 V cok daha olasi. Ayrica toplam kayip `Math.min(..., 5)` ile %5'e kesiliyor; bu, hatali kablo secimini saklayabilir.

Oneri: Faz secimi, cos phi, 400 V 3 faz formulu, kablo sicaklik katsayisi ve uyari mekanizmasi eklenmeli. Hesap yanlis ise "kotu sonucu saklama", kullaniciya kirmizi uyari ver.

### P1 - Kablo kaybi on izlemesi gercek panel/multi-roof secimini kullanmiyor

`updateCableLoss()` sistem gucunu hesaplarken sabit `430 W` mono panel ve sadece `state.roofArea` kullaniyor. Kullanici bifacial/poly panel veya coklu cati sectiyse kablo kaybi on izlemesi gercek sistemden sapabilir.

Oneri: Hesap motorundaki panel sayisi/guc hesabi tek fonksiyona alinip hem preview hem final hesapta kullanilmali.

### P1 - Vergi KDV iadesi gross totalCost uzerinden ikinci kez %20 gibi hesaplanabilir

`calculateTaxBenefits()` icinde `kdv_recovery = totalCost * 0.20`. `totalCost` zaten KDV dahil toplam gibi kullaniliyor. KDV dahil fiyattan KDV ayrilacaksa `gross * 20 / 120` veya dogrudan `costBreakdown.kdv` kullanilmali.

Etki: Vergi avantajini ve efektif maliyeti sisirir.

### P1 - Batarya ana finansal modele eksik entegre

Batarya maliyeti toplam maliyete ekleniyor, fakat bataryanin oz tuketime, export'a, saatlik mahsuplasmaya ve gelir/tasarrufa etkisi detayli modellenmiyor. Batarya `gridIndependence` gosteriyor ama payback/NPV mantigi batarya faydasini net sekilde yakalamiyor.

Oneri: Batarya icin saatlik charge/discharge simulasyonu, round-trip efficiency, DoD, cycle limit, replacement ve export kisitlari eklenmeli.

### P1 - EV ve isi pompasi ana sistem boyutlandirma/finansala bagli degil

EV ve isi pompasi sonuclar kart olarak gosteriliyor; ancak PV sistemin gerekli kapasitesi, yillik elektrik tuketimi, oz tuketim orani, net tasarruf ve geri odeme hesabi bu ek yuklerle bastan modellenmiyor.

Oneri: "Ek yukleri hesaba kat" secenegi ile daily/annual load profilini guncelle, sonra PV/batarya/net metering hesaplarini yeniden calistir.

### P1 - Bifacial kazanci sabit +%10

Bifacial panel icin `bifacialGain: 0.10` tum senaryolara uygulanmis. Gercekte albedo, montaj yuksekligi, arka yuz acikligi, cati rengi, egim ve golgeye bagli.

Oneri: Bifacial icin `albedo` ve montaj tipi alanlari eklenmeli; cati ustu dusuk yukseklikte varsayilan kazanc daha muhafazakar olmali.

### P1 - Sıcaklik kaybi fallback'te ambient yaz sicakligi ile yillik uygulanıyor

Fallback hesabinda sicaklik kaybi `avgSummerTemp - 25` uzerinden tum yillik uretime carpiliyor. Panel sicakligi ortam sicakligindan farklidir ve yillik/aylik sicaklik profili gerekir.

Oneri: PVGIS yoksa bile aylik sicaklik veya NOCT tabanli hucre sicakligi modeli kullan.

### P1 - Karsilastirma modulu basit oranlarla hesap yapiyor

`comparison.js` mevcut sonucu panel verim orani ve inverter verimiyle olceklendiriyor. Bu; panel gucu, alan, farkli panel sayisi, PVGIS geometri, kayiplar, O&M, inverter omru ve net metering'i dogru yansitmaz. Ayrica inverter yenileme senaryo hesabinda 12. yil gibi sabit davranis var.

Oneri: Her senaryo icin asil hesap motorunu parametre setiyle yeniden calistir.

### P1 - Service worker offline iddiasi zayif

Precache sadece `/`, `/index.html`, `/manifest.json`; CSS, JS, icon, locale dosyalari ve CDN kutuphaneleri precache edilmiyor. Ilk kurulumdan sonra offline acilista uygulama eksik kalabilir.

Oneri: Local asset listesi otomatik uretilmeli; CDN bagimliligi icin ya local vendor dosyalari ya da offline uyarisi.

## 6. Orta ve Dusuk Onemli Bulgular

- Fatura analizi `billAnalysisEnabled` ve aylik tuketimi state'e yaziyor; fakat `r.billAnalysis` hic uretilmedigi icin `renderBillAnalysisResults()` placeholder kaliyor.
- Paylasim linki sadece temel alanlari sakliyor; inverter, tarife, soiling, batarya, net metering, EV, isi pompasi, vergi, kablo kaybi, multi-roof gibi kritik girdiler kayboluyor.
- i18n kismen uygulanmis; dinamik JS ile olusan metinlerin cogu cevrilmiyor.
- CDN scriptleri icin SRI/integrity yok; ticari kullanimda tedarik zinciri riski.
- CSP yok; inline style ve onclick cok yaygin oldugu icin CSP eklemek su an zor.
- `innerHTML` cok kullaniliyor. Su an verilerin cogu kontrollu; ancak gelecekte kullanici metni eklenirse XSS riski artar.
- Yerel kayitlar localStorage'da; kullaniciya verinin tarayicida tutuldugu acikca soylenmiyor.
- Veri sabitleri ve fiyatlar icin "son guncelleme tarihi / kaynak / metodoloji versiyonu" yok.
- `manifest.json` screenshot bos; PWA store kalitesi dusuk.
- `package.json` icinde test/lint/format yok.
- Harita, grafik ve PDF CDN'e bagimli; internet veya CDN sorunu demo sirasinda uygulamayi zayiflatir.
- `PSH_FALLBACK` yalnizca bazi sehirler icin ozel deger iceriyor, kalan sehirler default'a dusuyor.
- Yapısal hesap iyi niyetli bir on kontrol; profesyonel statik hesap yerine gecmemeli ve raporda daha sert disclaimer olmali.
- Panel yerlesimi %75 alan katsayisina indirgenmis; gercek modul dizilim, engeller, baca, parapet, yangin boslugu ve inverter-string kisitlari yok.

## 7. Resmi Kaynaklara Gore Ticari Risk Notlari

- EPDK sayfasi 2026 icin PST/SKTT ayrimini ve yillik limitleri belirtiyor: mesken 4.000 kWh/yil, diger aboneler 15.000 kWh/yil; uygulama tek sabit tarife ile guvenilir olmaz. Kaynak: https://lisans.epdk.gov.tr/epvys-web/faces/pages/online/tarifeFatura/tarifeFatura.xhtml
- EPDK SKTT bilgilendirme sayfasinda 2026 mesken limitinin 4.000 kWh/yil oldugu ve desteklenen gruptan cikma mantigi aciklaniyor. Kaynak: https://www.epdk.gov.tr/Detay/Icerik/16-38/son-kaynak-tedarik-tarifesi-sktt-ile-ilgili-bil
- 2 Nisan 2026 tarihli duzenleme haberlerinde lisanssiz uretimde saatlik mahsuplasma, fazla uretim siniri ve depolama kaynakli export kisitlari vurgulaniyor. Bu proje su an yillik/net oran yaklasimi kullandigi icin ticari tekliflerde riskli. Kaynak: https://www.aa.com.tr/tr/enerjiterminali/genel/lisanssiz-elektrik-uretiminde-saatlik-mahsuplasma-donemi-basladi/56064

## 8. Hesap Dogrulugu Icin Mutlaka Yapilmasi Gerekenler

1. Tek bir `calculation-core` olustur: panel sayisi, sistem gucu, enerji, finans, net metering ve opsiyonel yukler ayni saf fonksiyonlardan gecsin.
2. Her formulu "input -> output" testleriyle sabitle.
3. NPV/IRR/LCOE icin bilinen ornek vaka testleri ekle.
4. PVGIS yanitini fixture olarak kaydet ve regresyon testinde kullan.
5. Fallback PSH degerlerini kaynakli ve sehir bazli yap; default kullanimini raporda buyuk uyariyla goster.
6. Tarife ve vergi modeline "kaynak tarihi" ekle.
7. Net metering'i saatlik profil tabanli hesapla.
8. Batarya, EV ve isi pompasini ana yuk profiline entegre et.
9. Rapor metinlerini gercek hesap parametrelerinden otomatik uret; elle yazilmis varsayim metinlerini azalt.
10. Sonuclara "guven seviyesi" ve "hesap modu" etiketi ekle: PVGIS/live, PVGIS/cached, fallback, demo/mock.

## 9. 0 TL Butceyle Ticari Kaliteyi Artiracak 25 Olmazsa Olmaz Ozellik

1. Hesap metodolojisi sayfasi: tum formuller, kaynaklar, varsayimlar, surum numarasi.
2. Saatlik mahsuplasma motoru: 24 saat x 12 ay profil ile oz tuketim/export/import.
3. 8760 saat CSV yukleme: ticari musterinin sayac verisini iceri al.
4. Resmi tarife modu: PST/SKTT/ikili anlasma/vergi dahil-haric secimleri.
5. Tarife kaynak tarihi rozeti: "Bu tarife 2026-04-12 tarihinde manuel dogrulandi".
6. NPV/IRR/LCOE test paketi: bilinen fixture'larla otomatik test.
7. PVGIS yanit onbellegi ve kaynak detayi: lat/lon, angle, aspect, loss, API timestamp.
8. Fallback kalite uyarisi: PVGIS yoksa raporda "dusuk guven" etiketi.
9. Batarya saatlik simulasyonu: charge/discharge, DoD, round-trip efficiency, export kisitlari.
10. EV ve isi pompasi yuk profil entegrasyonu: ana PV boyutlandirmayi etkileyecek sekilde.
11. Kablo kaybi 1 faz/3 faz secimi: 230/400 V, cos phi, kablo sicakligi.
12. Panel yerlesim kabaca grid cizimi: cati alanina gore panel sayisini gorsel dogrula.
13. Ticari disclaimer ve rapor imzasi: "on fizibilite, kesin teklif/statik proje degildir".
14. Veri gizliligi notu: localStorage'da ne saklaniyor, nasil silinir.
15. Tam paylasim linki: tum state'i surumlu JSON olarak hash'e koy.
16. Senaryo karsilastirmayi asil hesap motoruyla yeniden hesapla.
17. Hassasiyet analizi: tarife, maliyet, uretim, enflasyon, kur icin tornado chart.
18. Guven araligi: uretim icin kotu/baz/iyi yil senaryolari.
19. Maliyet kalemi editoru: panel, inverter, montaj, iscilik, izin, KDV kullanici tarafindan duzenlenebilir.
20. Musteri raporu ve teknik rapor ayrimi: biri sade, biri formullu.
21. Offline asset precache: tum local JS/CSS/icon/locale dosyalarini service worker'a ekle.
22. CDN fallback veya local vendor: Leaflet/Chart/jsPDF icin yerel kopya opsiyonu.
23. Coklu dilin gercek tamamlanmasi: dinamik JS metinleri de i18n'e bagla.
24. Audit paneli: hesap sonucunda kullanilan tum inputlari tek tabloda goster.
25. "Hata yakala" modu: NaN, negatif maliyet, asiri kayip, PR > %95, CF imkansiz gibi durumlarda hesap durdur.

## 10. Oncelikli Yol Haritasi

### 1. Hafta: Dogruluk kilidi

- NPV formulu duzelt.
- Saatlik profil normalize et.
- PVGIS rapor metnindeki `loss` tutarsizligini duzelt.
- Tarife ve fiyat artisi girdilerini kullaniciya ac.
- Kablo kaybi 3 faz formulu ekle.
- Basit test altyapisi kur.

### 2. Hafta: Ticari guven

- Saatlik mahsuplasma modelini ekle.
- PDF raporuna metodoloji, kaynak tarihi, disclaimer ve guven etiketi ekle.
- Paylasim linkini tum state'i kapsayacak sekilde genislet.
- Fatura/EV/isi pompasi modullerini ana yuk profiline bagla.

### 3. Hafta: Satis degeri

- Maliyet editoru.
- Hassasiyet analizi.
- Musteri/teknik rapor ayrimi.
- Offline asset precache.
- Dashboard export/import.

## 11. Son Karar

Bu proje fikir ve kapsam olarak ticari bir GES fizibilite aracina donusmeye cok yakin; ama su an hesap dogrulugu hedefi icin fazla iyimser ve bazi noktalarda metodolojik olarak hatali. En kritik konu: finansal metriklerin ve net metering'in resmi/guncel tarife ve saatlik mahsuplasma gercegine gore yeniden modellenmesi. Bunlar cozulmeden "yanlis hesap olmamali" hedefi karsilanmis sayilmaz.

0 TL butceyle ilerlemek mumkun: dis servis satin almadan, mevcut PVGIS + resmi EPDK kaynaklari + yerel JSON/CSV + otomatik testlerle ciddi bir kalite sicramasi yapilabilir.
