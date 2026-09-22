#!/usr/bin/env python3
"""Check local HTML/CSS links, assets, fragments and meta refreshes offline.

Query strings are retained when resolving URLs, but do not change the file on
disk. External hosts, mail links and app schemes are outside this check.
Run scripts/test-language-switchers.js for JavaScript-generated locale links.
"""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://appfitly.com"
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)['\"]?\s*\)", re.I)


class Page(HTMLParser):
    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.anchors: set[str] = set()
        self.in_style = False
        self.feed(source)
        self.close()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for attr in ("href", "src", "poster", "action"):
            if values.get(attr):
                self.links.append(values[attr])
        if values.get("id"):
            self.anchors.add(values["id"])
        if tag == "a" and values.get("name"):
            self.anchors.add(values["name"])
        if values.get("style"):
            self.links.extend(CSS_URL.findall(values["style"]))
        if tag == "meta" and (values.get("http-equiv") or "").lower() == "refresh":
            match = re.search(r";\s*url\s*=\s*(.+)", values.get("content") or "", re.I)
            if match:
                self.links.append(match[1].strip("\"' "))
        if tag == "style":
            self.in_style = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "style":
            self.in_style = False

    def handle_data(self, data: str) -> None:
        if self.in_style:
            self.links.extend(CSS_URL.findall(data))


def main() -> int:
    pages = {
        path.relative_to(ROOT): Page(path.read_text(encoding="utf-8"))
        for path in ROOT.rglob("*.html") if ".git" not in path.parts
    }
    sources = {path: page.links for path, page in pages.items()}
    css_files = [path for path in ROOT.rglob("*.css") if ".git" not in path.parts]
    for path in css_files:
        sources[path.relative_to(ROOT)] = CSS_URL.findall(path.read_text(encoding="utf-8"))
    errors: list[str] = []
    checked = 0
    skipped = 0
    for source, links in sources.items():
        for href in links:
            url = urlsplit(urljoin(f"{ORIGIN}/{source.as_posix()}", href))
            if url.scheme not in ("http", "https") or url.hostname != "appfitly.com":
                skipped += 1
                continue
            checked += 1
            target = ROOT / unquote(url.path).lstrip("/")
            if target.is_dir():
                target /= "index.html"
            if not target.resolve().is_relative_to(ROOT) or not target.is_file():
                errors.append(f"{source}: missing target {href}")
                continue
            relative = target.relative_to(ROOT)
            # Text fragments are browser directives, not element IDs.
            fragment = unquote(url.fragment.split(":~:text=", 1)[0])
            if fragment and relative in pages and fragment not in pages[relative].anchors:
                errors.append(f"{source}: missing fragment {href}")
    if errors:
        print("Internal link check FAILED:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(
        f"Internal link check PASS: {len(pages)} HTML pages, {len(css_files)} CSS files, "
        f"{checked} internal references, 0 broken links; {skipped} external/scheme links skipped."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
