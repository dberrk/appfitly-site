# Fitly web sitesi

Bu depo Fitly'nin statik pazarlama sitesini ve App Store indirme köprüsünü içerir. Canlı site GitHub Pages üzerinden yayınlanır ve ana dala yapılan her push yayına çıkar; `./deploy.sh` ise yalnızca `pages.dev` ortamına dağıtım yapar.

## Attribution

- Apple app ID: `6790693710`
- Provider token: `127590870`
- Canonical kampanya URL'leri:
  - `https://appfitly.com/indir/?c=tiktok_paid_spark_a_us&lang=en`
  - `https://appfitly.com/indir/?c=tiktok_organic_us&lang=en`
  - `https://appfitly.com/indir/?c=instagram_organic_us&lang=en`

TikTok App Promotion reklamlarında öncelikli destination doğrudan Apple linkidir: `https://apps.apple.com/app/apple-store/id6790693710?pt=127590870&ct=tiktok_paid_spark_a_us&mt=8`. Web URL'si yalnızca Traffic kampanyalarında veya App Store'un doğrudan açılamadığı organik ve in-app-browser akışlarında kullanılmalıdır.

Parametre zinciri `?c=` -> sanitize -> `ct` şeklindedir. `c` yoksa `utm_source` veya referrer üzerinden `ai_*` değeri üretilir; bunlar da yoksa varsayılan değer `website` olur. Apple 301 yönlendirmesinin `pt` ve `ct` değerlerini koruduğu 2026-08-21 tarihinde canlı doğrulandı. `mt` yönlendirmede düşer ve bu bir sorun değildir.

Kampanyalar App Store Connect'te ilk 5 first-time download sonrasında görünür.

Web analytics: PostHog bilinçli olarak YOK.
