#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const HTML_PATH = path.join(ROOT, "indir", "index.html");
const APP_ID = "6790693710";
const PROVIDER_TOKEN = "127590870";

function extractInlineScript(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const attributes = match[1];
    if (/\bsrc\s*=/i.test(attributes)) continue;
    if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) continue;
    scripts.push(match[2]);
  }

  assert.equal(scripts.length, 1, "indir/index.html içinde tam bir çalıştırılabilir inline script olmalı");
  return scripts[0];
}

const INLINE_SCRIPT = extractInlineScript(fs.readFileSync(HTML_PATH, "utf8"));

class StubElement {
  constructor(id) {
    this.id = id;
    this.attributes = Object.create(null);
    this.hrefHistory = [];
    this.hidden = id === "fallbacks";
    this.style = {};
    this.textContent = "";
    this.value = "";
  }

  get href() {
    return this.attributes.href;
  }

  set href(value) {
    const link = String(value);
    this.attributes.href = link;
    this.hrefHistory.push(link);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  select() {}
  setSelectionRange() {}
}

function createPage({ search = "", referrer = "", ua, platform = "iPhone", maxTouchPoints = 0 }) {
  const elements = new Map();
  const locationAssignments = [];
  const clipboardWrites = [];
  const documentListeners = Object.create(null);
  const windowListeners = Object.create(null);

  function element(id) {
    if (!elements.has(id)) elements.set(id, new StubElement(id));
    return elements.get(id);
  }

  const location = { search };
  let currentHref = "https://appfitly.com/indir/" + search;
  Object.defineProperty(location, "href", {
    get() {
      return currentHref;
    },
    set(value) {
      currentHref = String(value);
      locationAssignments.push(currentHref);
    },
  });

  const document = {
    body: {
      appendChild() {},
      removeChild() {},
    },
    documentElement: {},
    hidden: false,
    referrer,
    addEventListener(name, handler) {
      documentListeners[name] = handler;
    },
    createElement(tag) {
      return new StubElement(tag);
    },
    execCommand(command) {
      return command === "copy";
    },
    getElementById(id) {
      return element(id);
    },
  };

  const navigator = {
    userAgent: ua,
    platform,
    maxTouchPoints,
    language: "en",
    languages: ["en"],
    clipboard: {
      writeText(value) {
        clipboardWrites.push(String(value));
        return Promise.resolve();
      },
    },
  };

  const window = {
    addEventListener(name, handler) {
      windowListeners[name] = handler;
    },
  };

  const context = {
    URL,
    URLSearchParams,
    document,
    encodeURIComponent,
    location,
    navigator,
    setTimeout() {
      return 1;
    },
    window,
  };

  vm.runInNewContext(INLINE_SCRIPT, context, { filename: "indir/index.html:inline-script" });

  return {
    clipboardWrites,
    document,
    element,
    locationAssignments,
  };
}

function asStoreUrl(link) {
  if (link.startsWith("https://")) return link;
  if (link.startsWith("googlechromes://")) {
    return "https://" + link.slice("googlechromes://".length);
  }
  if (link.startsWith("microsoft-edge-https://")) {
    return "https://" + link.slice("microsoft-edge-https://".length);
  }
  if (link.startsWith("opera-https://")) {
    return "https://" + link.slice("opera-https://".length);
  }
  if (link.startsWith("firefox://")) {
    return new URL(link).searchParams.get("url");
  }
  assert.fail("Bilinmeyen App Store link biçimi: " + link);
}

function assertAttribution(link, expectedCt, expectedLang) {
  const storeUrl = new URL(asStoreUrl(link));
  assert.equal(storeUrl.protocol, "https:");
  assert.equal(storeUrl.hostname, "apps.apple.com");
  assert.equal(storeUrl.pathname, "/app/id" + APP_ID);
  assert.equal(storeUrl.searchParams.get("pt"), PROVIDER_TOKEN);
  assert.equal(storeUrl.searchParams.get("ct"), expectedCt);
  assert.equal(storeUrl.searchParams.get("mt"), "8");
  assert.equal(storeUrl.searchParams.get("l"), expectedLang);
}

function assertInAppLinks(page, expectedCt, expectedLang) {
  const btn = page.element("btn");
  assert.equal(btn.hrefHistory.length, 1, "ana App Store URL'si bir kez üretilmeli");
  assertAttribution(btn.hrefHistory[0], expectedCt, expectedLang);

  const copyLink = page.element("copyLink");
  assert.equal(typeof copyLink.onclick, "function", "copy-link dalı kurulmalı");
  copyLink.onclick();
  assert.equal(page.clipboardWrites.length, 1, "copy-link App Store URL'sini yazmalı");
  assertAttribution(page.clipboardWrites[0], expectedCt, expectedLang);

  const fallbacks = [
    ["tryChrome", "googlechromes://"],
    ["tryFirefox", "firefox://open-url?url="],
    ["tryEdge", "microsoft-edge-https://"],
    ["tryOpera", "opera-https://"],
  ];
  for (const [id, scheme] of fallbacks) {
    const fallback = page.element(id);
    assert.equal(typeof fallback.onclick, "function", id + " şema linkini üretmeli");
    const before = page.locationAssignments.length;
    fallback.onclick();
    assert.equal(page.locationAssignments.length, before + 1);
    assert.ok(page.locationAssignments.at(-1).startsWith(scheme), id + " doğru şemayı kullanmalı");
    assertAttribution(page.locationAssignments.at(-1), expectedCt, expectedLang);
  }
}

const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const INSTAGRAM_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 350.0.0";
const TIKTOK_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 TikTok 36.0.0";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const DESKTOP_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";

const tests = [
  ["TikTok paid Spark kampanyası", () => {
    const page = createPage({ search: "?c=tiktok_paid_spark_a_us&lang=en", ua: INSTAGRAM_IOS });
    assertInAppLinks(page, "tiktok_paid_spark_a_us", "en");
  }],
  ["TikTok organik kampanya", () => {
    const page = createPage({ search: "?c=tiktok_organic_us&lang=en", ua: INSTAGRAM_IOS });
    assertInAppLinks(page, "tiktok_organic_us", "en");
  }],
  ["Instagram organik kampanya", () => {
    const page = createPage({ search: "?c=instagram_organic_us&lang=en", ua: INSTAGRAM_IOS });
    assertInAppLinks(page, "instagram_organic_us", "en");
  }],
  ["Parametresiz ve referrersız varsayılan", () => {
    const page = createPage({ ua: INSTAGRAM_IOS });
    assertInAppLinks(page, "website", "en");
  }],
  ["ChatGPT referrer attribution", () => {
    const page = createPage({ referrer: "https://chatgpt.com/c/example", ua: INSTAGRAM_IOS });
    assertInAppLinks(page, "ai_chatgpt", "en");
  }],
  ["c sanitizasyonu ve boş değer fallback'i", () => {
    const sanitized = createPage({ search: "?c=abc$%42;DROP&lang=en", ua: INSTAGRAM_IOS });
    assertInAppLinks(sanitized, "abcBDROP", "en");

    const emptied = createPage({ search: "?c=%24%25%3B%21&lang=en", ua: INSTAGRAM_IOS });
    assertInAppLinks(emptied, "website", "en");
  }],
  ["UA varyantları", () => {
    const variants = [
      { name: "iOS Safari", ua: IOS_SAFARI, inApp: false },
      { name: "Instagram in-app", ua: INSTAGRAM_IOS, inApp: true },
      { name: "TikTok in-app", ua: TIKTOK_IOS, inApp: true },
      { name: "Android", ua: ANDROID_CHROME, platform: "Linux armv8l", inApp: false },
      { name: "masaüstü", ua: DESKTOP_CHROME, platform: "MacIntel", inApp: false },
    ];

    for (const variant of variants) {
      const page = createPage({
        search: "?c=tiktok_organic_us&lang=en",
        ua: variant.ua,
        platform: variant.platform,
      });
      const btn = page.element("btn");
      assert.equal(btn.hrefHistory.length, 1, variant.name + " ana URL üretmeli");
      assertAttribution(btn.hrefHistory[0], "tiktok_organic_us", "en");

      if (variant.inApp) {
        assertInAppLinks(page, "tiktok_organic_us", "en");
        assert.equal(page.element("fallbacks").hidden, false, variant.name + " fallback alanını açmalı");
      } else {
        assert.equal(page.element("fallbacks").hidden, true, variant.name + " fallback alanını açmamalı");
        assert.equal(typeof page.element("copyLink").onclick, "undefined", variant.name + " copy-link üretmemeli");
      }
    }
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log("PASS " + name);
  } catch (error) {
    failures += 1;
    console.error("FAIL " + name + ": " + error.message);
  }
}

if (failures > 0) {
  console.error("\n" + failures + " senaryo başarısız.");
  process.exit(1);
}

console.log("\n7 senaryo başarılı.");
