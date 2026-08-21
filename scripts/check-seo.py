#!/usr/bin/env python3
"""appfitly.com statik SEO dosyalarını doğrular."""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://appfitly.com"
LANGS = ("tr", "en", "de", "es", "fr", "it", "pt-BR", "ru", "ja", "ko", "zh-Hans", "ar")
HOME_FILES = {"tr": Path("index.html"), **{lang: Path(lang) / "index.html" for lang in LANGS[1:]}}
HOME_URLS = {"tr": f"{ORIGIN}/", **{lang: f"{ORIGIN}/{lang}/" for lang in LANGS[1:]}}
EXPECTED_HREFLANG = {**HOME_URLS, "x-default": f"{ORIGIN}/en/"}
EM_DASH = chr(0x2014)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.html_lang: str | None = None
        self.html_dir: str | None = None
        self.canonicals: list[str] = []
        self.alternates: list[tuple[str, str]] = []
        self.titles: list[str] = []
        self.meta: list[dict[str, str]] = []
        self.json_ld: list[str] = []
        self._title: list[str] | None = None
        self._json: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "html" and self.html_lang is None:
            self.html_lang = values.get("lang")
            self.html_dir = values.get("dir")
        elif tag == "link":
            rel = set(values.get("rel", "").lower().split())
            if "canonical" in rel:
                self.canonicals.append(values.get("href", ""))
            if "alternate" in rel and values.get("hreflang"):
                self.alternates.append((values["hreflang"], values.get("href", "")))
        elif tag == "title":
            self._title = []
        elif tag == "meta":
            self.meta.append(values)
        elif tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._json = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._title is not None:
            self.titles.append("".join(self._title).strip())
            self._title = None
        elif tag == "script" and self._json is not None:
            self.json_ld.append("".join(self._json).strip())
            self._json = None

    def handle_data(self, data: str) -> None:
        if self._title is not None:
            self._title.append(data)
        if self._json is not None:
            self._json.append(data)


def parse_page(path: Path, errors: list[str]) -> PageParser:
    parser = PageParser()
    try:
        parser.feed((ROOT / path).read_text(encoding="utf-8"))
        parser.close()
    except (OSError, UnicodeError) as exc:
        errors.append(f"{path}: HTML okunamadı: {exc}")
    return parser


def sitemap_file_for(url: str) -> Path | None:
    parsed = urlsplit(url)
    if f"{parsed.scheme}://{parsed.netloc}" != ORIGIN or parsed.query or parsed.fragment:
        return None
    route = unquote(parsed.path)
    if not route.startswith("/") or ".." in Path(route).parts:
        return None
    relative = route.lstrip("/")
    return Path(relative) / "index.html" if not relative or route.endswith("/") else Path(relative)


def find_values(value: object, key: str) -> list[object]:
    found: list[object] = []
    if isinstance(value, dict):
        for name, child in value.items():
            if name == key:
                found.append(child)
            found.extend(find_values(child, key))
    elif isinstance(value, list):
        for child in value:
            found.extend(find_values(child, key))
    return found


def meta_values(page: PageParser, *, name: str | None = None, prop: str | None = None) -> list[str]:
    result = []
    for item in page.meta:
        if name is not None and item.get("name", "").lower() == name.lower():
            result.append(item.get("content", ""))
        if prop is not None and item.get("property", "").lower() == prop.lower():
            result.append(item.get("content", ""))
    return result


def main() -> int:
    errors: list[str] = []
    pages: dict[Path, PageParser] = {}

    try:
        tree = ET.parse(ROOT / "sitemap.xml")
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locations = [node.text.strip() for node in tree.findall("sm:url/sm:loc", namespace) if node.text]
    except (OSError, ET.ParseError) as exc:
        errors.append(f"sitemap.xml: XML okunamadı: {exc}")
        locations = []

    if len(locations) != len(set(locations)):
        errors.append("sitemap.xml: yinelenen URL var")
    for location in locations:
        local = sitemap_file_for(location)
        if local is None:
            errors.append(f"sitemap.xml: geçersiz mutlak URL: {location}")
        elif not (ROOT / local).is_file():
            errors.append(f"sitemap.xml: {location} için dosya yok: {local}")

    baseline: list[tuple[str, str]] | None = None
    for lang, path in HOME_FILES.items():
        page = parse_page(path, errors)
        pages[path] = page
        if page.canonicals != [HOME_URLS[lang]]:
            errors.append(f"{path}: canonical kendi dil URL'si değil veya sayısı 1 değil")

        counts: dict[str, int] = {}
        hrefs: dict[str, str] = {}
        for code, href in page.alternates:
            counts[code] = counts.get(code, 0) + 1
            hrefs[code] = href
        if len(page.alternates) != 13 or counts != {code: 1 for code in EXPECTED_HREFLANG}:
            errors.append(f"{path}: tam 13 benzersiz hreflang yok")
        if hrefs != EXPECTED_HREFLANG:
            errors.append(f"{path}: hreflang kümesi beklenen URL'lerle birebir aynı değil")
        if baseline is None:
            baseline = page.alternates
        elif page.alternates != baseline:
            errors.append(f"{path}: hreflang kümesi diğer ana sayfalarla karşılıklı aynı değil")

        descriptions = meta_values(page, name="description")
        og_titles = meta_values(page, prop="og:title")
        og_descriptions = meta_values(page, prop="og:description")
        if len(descriptions) != 1 or not 140 <= len(descriptions[0]) <= 160:
            errors.append(f"{path}: meta description 140-160 karakter değil veya sayısı 1 değil")
        if len(page.titles) == 1 and og_titles != page.titles:
            errors.append(f"{path}: og:title title ile eşleşmiyor")
        if len(descriptions) == 1 and og_descriptions != descriptions:
            errors.append(f"{path}: og:description meta description ile eşleşmiyor")

    for path in sorted(Path("ar").glob("*.html")):
        page = pages.get(path) or parse_page(path, errors)
        pages[path] = page
        if page.html_dir != "rtl":
            errors.append(f"{path}: html etiketinde dir=\"rtl\" yok")

    html_files = sorted(path.relative_to(ROOT) for path in ROOT.rglob("*.html") if ".git" not in path.parts)
    for path in html_files:
        page = pages.get(path) or parse_page(path, errors)
        pages[path] = page
        if len(page.titles) != 1:
            errors.append(f"{path}: title sayısı {len(page.titles)}, beklenen 1")
        elif page.titles[0] == "Fitly":
            errors.append(f"{path}: title yalnızca Fitly olamaz")

        decoded: list[object] = []
        for index, raw in enumerate(page.json_ld, start=1):
            try:
                decoded.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                errors.append(f"{path}: JSON-LD #{index} parse edilemiyor: {exc}")
        if path in HOME_FILES.values():
            values = [item for data in decoded for item in find_values(data, "inLanguage")]
            if values != [page.html_lang]:
                errors.append(f"{path}: JSON-LD inLanguage sayfa lang değeriyle eşit değil")
            descriptions = meta_values(page, name="description")
            json_descriptions = [item for data in decoded for item in find_values(data, "description")]
            if len(descriptions) == 1 and json_descriptions != descriptions:
                errors.append(f"{path}: JSON-LD description meta description ile eşleşmiyor")

        if path != Path("a/index.html"):
            seo_text = page.titles + page.json_ld
            seo_text.extend(meta_values(page, name="description"))
            seo_text.extend(meta_values(page, prop="og:title"))
            seo_text.extend(meta_values(page, prop="og:description"))
            if any(EM_DASH in text for text in seo_text):
                errors.append(f"{path}: eklenen SEO metninde em dash var")

    for path in (Path("sitemap.xml"), Path("robots.txt")):
        try:
            if EM_DASH in (ROOT / path).read_text(encoding="utf-8"):
                errors.append(f"{path}: eklenen metinde em dash var")
        except OSError as exc:
            errors.append(f"{path}: dosya okunamadı: {exc}")

    if errors:
        print("SEO doğrulaması başarısız:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"SEO doğrulaması başarılı: {len(locations)} sitemap URL'si, {len(html_files)} HTML sayfası.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
