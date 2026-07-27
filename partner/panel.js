/**
 * Fitly partner panel — shared auth + transport (PRD-21, ADR-015).
 *
 * No authorization decision is made in this file. Everything here is
 * presentation: the server decides via RLS and the is_admin check inside
 * affiliate-admin. Hiding a button is convenience, never a control.
 */
(function () {
    "use strict";

    var cfg = window.FITLY_CONFIG || {};
    var I18N = window.FITLY_I18N;

    var LANG_KEY = "fitly.partner.lang";
    var lang = (function () {
        try {
            var saved = localStorage.getItem(LANG_KEY);
            if (saved && I18N[saved]) return saved;
        } catch (e) { /* private mode */ }
        return (navigator.language || "tr").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
    })();

    function t(key) {
        return (I18N[lang] && I18N[lang][key]) || (I18N.tr && I18N.tr[key]) || key;
    }

    function setLang(next) {
        if (!I18N[next]) return;
        lang = next;
        try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
        document.documentElement.lang = t("htmlLang");
        window.dispatchEvent(new CustomEvent("fitly:lang"));
    }

    // HTTPS is required so the access token never crosses the wire in the
    // clear. Loopback is the one exception, for running the panel against a
    // local `supabase start` stack.
    function isAllowedOrigin(url) {
        if (typeof url !== "string") return false;
        if (url.indexOf("https://") === 0) return true;
        return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
    }

    var isConfigured =
        typeof cfg.PUBLISHABLE_KEY === "string" &&
        cfg.PUBLISHABLE_KEY.indexOf("REPLACE_ME") !== 0 &&
        isAllowedOrigin(cfg.SUPABASE_URL);

    var client = isConfigured
        ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.PUBLISHABLE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true },
        })
        : null;

    /**
     * Calls an edge function with the caller's access token. Returns
     * { ok, status, data }. Never throws, so callers can render a message
     * instead of leaving a spinner running forever.
     */
    async function callFunction(name, body) {
        try {
            var sessionResult = await client.auth.getSession();
            var token = sessionResult.data.session && sessionResult.data.session.access_token;
            if (!token) return { ok: false, status: 401, data: null };

            var res = await fetch(cfg.SUPABASE_URL + "/functions/v1/" + name, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    apikey: cfg.PUBLISHABLE_KEY,
                    Authorization: "Bearer " + token,
                },
                body: JSON.stringify(body || {}),
            });
            var data = await res.json().catch(function () { return null; });
            return { ok: res.ok, status: res.status, data: data };
        } catch (e) {
            return { ok: false, status: 0, data: null };
        }
    }

    /** True when the account still carries the owner-generated password. */
    function mustChangePassword(user) {
        return !!(user && user.user_metadata && user.user_metadata.must_change_password);
    }

    async function clearMustChangePassword() {
        await client.auth.updateUser({ data: { must_change_password: false } });
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /** Wires the TR/EN toggle and re-renders on change. */
    function mountLangToggle(el) {
        function paint() {
            el.innerHTML =
                '<button type="button" data-l="tr" aria-pressed="' + (lang === "tr") + '">TR</button>' +
                '<button type="button" data-l="en" aria-pressed="' + (lang === "en") + '">EN</button>';
        }
        el.addEventListener("click", function (ev) {
            var b = ev.target.closest("button[data-l]");
            if (b) setLang(b.getAttribute("data-l"));
        });
        window.addEventListener("fitly:lang", paint);
        paint();
    }

    window.FitlyPanel = {
        t: t,
        get lang() { return lang; },
        setLang: setLang,
        client: client,
        isConfigured: isConfigured,
        callFunction: callFunction,
        mustChangePassword: mustChangePassword,
        clearMustChangePassword: clearMustChangePassword,
        escapeHtml: escapeHtml,
        mountLangToggle: mountLangToggle,
    };

    document.documentElement.lang = t("htmlLang");
})();
