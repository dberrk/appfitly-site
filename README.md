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

TikTok App Promotion reklamlarında öncelikli destination doğrudan Apple linkidir: `https://apps.apple.com/app/apple-store/id6790693710?pt=127590870&ct=tiktok_paid_spark_a_us&mt=8`. Web URL'si yalnızca Traffic kampanyalarında veya App Store'un doğrudan açılamadığı organik ve in-app-browser akışlarında kullanılmalıdır.

Parametre zinciri `?c=` -> sanitize -> `ct` şeklindedir. `c` yoksa `utm_source` veya referrer üzerinden `ai_*` değeri üretilir; bunlar da yoksa varsayılan değer `website` olur. Apple 301 yönlendirmesinin `pt` ve `ct` değerlerini koruduğu 2026-08-21 tarihinde canlı doğrulandı. `mt` yönlendirmede düşer ve bu bir sorun değildir.

Kampanyalar App Store Connect'te ilk 5 first-time download sonrasında görünür.

Web analytics: PostHog bilinçli olarak YOK.

## PRD-27 WP4: English root

Release timing: merge this site change on the 2.0 release day (PRD-27 §8a).
Pushing the publishing branch makes the site live. Work on a feature branch,
open a PR, and do not run `deploy.sh` for this change.

### URL map

All paths below are on `https://appfitly.com`.

| Before | After |
|---|---|
| `/`, `/index.html` (Turkish home) | `/tr/`, `/tr/index.html` (same Turkish content); the root and its index alias now serve the existing English home |
| `/en/`, `/en/index.html` (English home) | `/` (English canonical), with an immediate HTML meta refresh and canonical at both old aliases |
| `/#top`, `/#konsey`, `/#nasil`, `/#ozellikler`, `/#fiyatlar` | Still resolve to the same sections at the English root; Turkish equivalents are under `/tr/#…` |
| Turkish home download links: `/indir/` | `/indir/?lang=tr` to keep the selected language explicit |
| Partner portal's broken static fallback: `/partner-terms/` | `/partner-sozlesmesi.html` |
| `/{de,es,fr,it,pt-BR,ru,ja,ko,zh-Hans,ar}/` and index aliases | Unchanged |
| `/{gizlilik,kosullar,eula,partner-sozlesmesi}.html` (Turkish) | Unchanged, including the legal text |
| `/{en,de,es,fr,it,pt-BR,ru,ja,ko,zh-Hans,ar}/{gizlilik,kosullar,eula}.html` | Unchanged, including the legal text |
| `/en/partner-sozlesmesi.html` | Unchanged, including the legal text |
| `/indir/`, `/a/`, `/partner/`, `/partner/davet.html`, `/partner/admin/` | Routes unchanged; download and auth bridge logic unchanged |

The English root links to `/en/` legal documents. The Turkish home links to the
existing root legal documents. Keeping legal URLs in place preserves published
app/store links without redirecting or duplicating legal content. There is no
redirect at `/`: it must serve English. Existing root bookmarks still load, and
the language selector leads directly to `/tr/`.

The `/en/` compatibility page uses `<meta http-equiv="refresh" content="0; url=/">`,
a canonical pointing at `/`, and visible fallback links. This works on static
GitHub Pages with JavaScript disabled and requires no HTTP 301 configuration.
It uses a fixed destination, so incoming query parameters are not forwarded.
Campaign links should continue to use the unchanged `/indir/?c=…&lang=…` bridge.

### Hreflang matrix

Each of the 12 home pages (and the `/en/` redirect) contains this identical,
reciprocal set. All hrefs are absolute HTTPS URLs.

| Hreflang | Home path | Open Graph locale |
|---|---|---|
| `en` | `/` | `en_US` |
| `tr` | `/tr/` | `tr_TR` |
| `de` | `/de/` | `de_DE` |
| `es` | `/es/` | `es_ES` |
| `fr` | `/fr/` | `fr_FR` |
| `it` | `/it/` | `it_IT` |
| `pt-BR` | `/pt-BR/` | `pt_BR` |
| `ru` | `/ru/` | `ru_RU` |
| `ja` | `/ja/` | `ja_JP` |
| `ko` | `/ko/` | `ko_KR` |
| `zh-Hans` | `/zh-Hans/` | `zh_CN` |
| `ar` | `/ar/` | `ar_AR` |
| `x-default` | `/` | English fallback |

Privacy, Terms and EULA each retain their own full 12-language set plus
`x-default`: `tr` points to `/<document>.html`, other languages to
`/<language>/<document>.html`, and `x-default` to `/en/<document>.html`.
The partner agreement has only two translations, so its complete set is `tr`,
`en`, and `x-default` (English). Every indexable HTML page has `og:locale`.
The noindex download/auth/partner tools are not translated document clusters;
they do not advertise unrelated home pages as hreflang alternatives.

The sitemap lists only the 50 canonical, indexable pages. `/en/` is replaced by
`/tr/`; the already-noindex `/indir/` and `/partner/` are removed. Robots keeps
both home languages and the `/en/` redirect crawlable, retains the existing bot
policy, and points to the same sitemap.

### Verification and owner follow-up

```sh
python3 scripts/check-seo.py
python3 scripts/check-links.py
node scripts/test-language-switchers.js
node scripts/test-indir.js
git diff --check
```

The link checker covers HTML links, CSS assets, fragments and refresh targets
offline. It skips external hosts, mail links and app schemes. The switcher check
executes every translated page's language switcher and covers directory and
`index.html` aliases. The existing bridge suite covers attribution and browser
navigation. This is local verification, not a claim that the feature is live.

No Cloudflare routing configuration is stored in this repository. Before the
release-day merge, the owner should confirm that no edge rule redirects `/tr/`
to `/` or `/` to `/en/`, and that `/tr/` reaches GitHub Pages. No new edge rule is
required by this implementation. Any optional edge redirect must match only
`/en/` and `/en/index.html`, never `/en/*` (the English legal pages stay there).
No Cloudflare settings are changed by this PR.
