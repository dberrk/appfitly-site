# Fitly web sitesi

Bu depo Fitly'nin statik pazarlama sitesini ve App Store indirme köprüsünü içerir. Canlı site GitHub Pages üzerinden yayınlanır ve ana dala yapılan her push yayına çıkar; `./deploy.sh` ise yalnızca `pages.dev` ortamına dağıtım yapar.

## Attribution

- Apple app ID: `6790693710`
- Provider token: `127590870`
- Canonical kampanya URL'leri:
  - `https://appfitly.com/indir/?c=tiktok_paid_spark_a_us&lang=en`
  - `https://appfitly.com/indir/?c=tiktok_organic_us&lang=en`
  - `https://appfitly.com/indir/?c=instagram_organic_us&lang=en`
  - `https://appfitly.com/indir/?c=elif_balci` (creator: Elif Balcı, 2026-09-07; `ı` sanitize edilir, ASCII `elif_balci` yaz)
  - Popeye: `https://appfitly.com/popeye/?c=ig_popeye` ve `https://appfitly.com/popeye/?c=tt_popeye` (özel İngilizce landing, 2026-10-08 onaylı taslak; eski `/indir/?c=*_popeye&lang=en` hedefleri de çalışır) (AI UGC persona Popeye Sailorman, 2026-10-08; bio'da bit.ly kısaltmasıyla, platform başına ayrı `ct`)

TikTok ve Instagram (2026-10-08, owner iPhone'unda iki uygulamanın DM'sinden `?test=1` ile ölçüldü): dokunuşla `location.href = https://apps.apple.com/...` App Store'u açıyor (Instagram 2026-08-05'teki ölçümden bu yana değişmiş). `/indir/` bu iki uygulamada butonu doğrudan mağazaya bağlar; ölçülmeyen in-app tarayıcılarda (Facebook, Snapchat, ...) tarayıcı şeması zinciri kalır. `?test=1` her yöntemi ayrı butonla dener, yeniden ölçüm içindir.

TikTok App Promotion reklamlarında öncelikli destination doğrudan Apple linkidir: `https://apps.apple.com/app/apple-store/id6790693710?pt=127590870&ct=tiktok_paid_spark_a_us&mt=8`. Web URL'si yalnızca Traffic kampanyalarında veya App Store'un doğrudan açılamadığı organik ve in-app-browser akışlarında kullanılmalıdır.

Parametre zinciri `?c=` -> sanitize -> `ct` şeklindedir. `c` yoksa `utm_source` veya referrer üzerinden `ai_*` değeri üretilir; bunlar da yoksa varsayılan değer `website` olur. Apple 301 yönlendirmesinin `pt` ve `ct` değerlerini koruduğu 2026-08-21 tarihinde canlı doğrulandı. `mt` yönlendirmede düşer ve bu bir sorun değildir.

Kampanyalar App Store Connect'te ilk 5 first-time download sonrasında görünür.

Web analytics: PostHog bilinçli olarak YOK.
