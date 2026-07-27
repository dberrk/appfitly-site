/**
 * Fitly partner panel — deployment config (PRD-21, ADR-015).
 *
 * SAFE TO PUBLISH. This repo is public and these two values are public by
 * design: the publishable ("anon") key only ever grants what Row Level Security
 * already allows, and every authorization decision for this panel is made
 * server-side (RLS policies plus the is_admin check inside affiliate-admin).
 *
 * NEVER put a service-role key, a webhook secret, or any function secret in
 * this file or anywhere else in this repository.
 *
 * OWNER: replace PUBLISHABLE_KEY below with the production publishable key.
 * It is the same value the iOS app ships as SUPABASE_PUBLISHABLE_KEY in
 * Secrets.Release.xcconfig, and it starts with `sb_publishable_`.
 */
window.FITLY_CONFIG = {
    SUPABASE_URL: "https://ayjyxoemxrzjvuvwlxcv.supabase.co",
    PUBLISHABLE_KEY: "REPLACE_ME_sb_publishable_key",
};
