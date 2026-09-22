#!/usr/bin/env node
"use strict";

// Execute the actual page switchers, including directory and index.html aliases.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const LANGS = ["tr", "en", "de", "es", "fr", "it", "pt-BR", "ru", "ja", "ko", "zh-Hans", "ar"];
const families = ["index.html", "gizlilik.html", "kosullar.html", "eula.html", "partner-sozlesmesi.html"];
let pages = 0;
let cases = 0;

function routeFor(lang, family) {
  if (family === "index.html") return lang === "en" ? "/" : `/${lang}/`;
  return `${lang === "tr" ? "/" : `/${lang}/`}${family}`;
}

function fileFor(route) {
  return path.join(ROOT, route.endsWith("/") ? `${route}index.html` : route);
}

for (const family of families) {
  const languages = family === "partner-sozlesmesi.html" ? ["tr", "en"] : LANGS;
  for (const lang of languages) {
    const route = routeFor(lang, family);
    const html = fs.readFileSync(fileFor(route), "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1]).filter(script => script.includes("window.fitlySwitchLang="));
    assert.equal(scripts.length, 1, `${route}: one language switcher`);
    const currentLang = html.match(/<html\b[^>]*lang="([^"]+)"/i)[1];
    const selectorCount = [...html.matchAll(/<select\b[^>]*class="lang"/g)].length;
    assert.ok(selectorCount > 0, `${route}: language selector exists`);
    assert.equal(currentLang, lang, `${route}: page language`);
    pages++;
    for (const pathname of route.endsWith("/") ? [route, `${route}index.html`] : [route]) {
      const selectors = Array.from({ length: selectorCount }, () => ({ value: "" }));
      const location = { pathname, href: pathname };
      const window = {};
      const document = {
        documentElement: { lang: currentLang },
        addEventListener(event, callback) {
          assert.equal(event, "DOMContentLoaded");
          callback();
        },
        querySelector: () => selectors[0],
        querySelectorAll: () => selectors,
      };
      vm.runInNewContext(scripts[0], { location, window, document }, { timeout: 1000 });
      for (const selector of selectors) assert.equal(selector.value, lang, `${pathname}: selected language`);
      for (const targetLang of languages) {
        window.fitlySwitchLang(targetLang);
        const expected = routeFor(targetLang, family);
        assert.equal(location.href, expected, `${pathname}: ${targetLang} destination`);
        const target = fs.readFileSync(fileFor(location.href), "utf8");
        assert.equal(target.match(/<html\b[^>]*lang="([^"]+)"/i)[1], targetLang);
        assert.ok(!/http-equiv="refresh"/i.test(target), `${pathname}: switch directly to content`);
        cases++;
      }
    }
  }
}

console.log(`Language switcher check PASS: ${pages} pages, ${cases} navigation cases, directory/index aliases and selected languages verified.`);
