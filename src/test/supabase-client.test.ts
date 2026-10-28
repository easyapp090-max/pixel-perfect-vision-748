import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseConfig,
  isPublicSupabaseKey,
  isSecureBackendConfigured,
} from "@/lib/backend-config";
import { getSupabaseClient } from "@/lib/supabase";

const publishableKey = `sb_publishable_${"a".repeat(32)}`;

function legacyAnonKey(role: string) {
  const payload = btoa(JSON.stringify({ role }))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `header.${payload}.signature`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase configuration", () => {
  it("uses only the explicit staging variables in staging mode", () => {
    vi.stubEnv("MODE", "staging");
    vi.stubEnv("VITE_SUPABASE_URL", "https://production-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
    vi.stubEnv("VITE_SUPABASE_STAGING_URL", "https://staging-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_STAGING_PUBLISHABLE_KEY", publishableKey);
    vi.stubEnv("VITE_SUPABASE_STAGING_PROJECT_REF", "staging-project");

    expect(getSupabaseConfig()).toEqual({
      url: "https://staging-project.supabase.co",
      key: publishableKey,
      projectRef: "staging-project",
    });
    expect(isSecureBackendConfigured()).toBe(true);
  });

  it("fails closed when any staging variable is missing instead of falling back", () => {
    vi.stubEnv("MODE", "staging");
    vi.stubEnv("VITE_SUPABASE_URL", "https://production-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
    const stagingValues = {
      VITE_SUPABASE_STAGING_URL: "https://staging-project.supabase.co",
      VITE_SUPABASE_STAGING_PUBLISHABLE_KEY: publishableKey,
      VITE_SUPABASE_STAGING_PROJECT_REF: "staging-project",
    };

    for (const [variable, value] of Object.entries(stagingValues)) {
      vi.stubEnv(variable, value);
      vi.stubEnv(variable, "");
      expect(isSecureBackendConfigured()).toBe(false);
      vi.stubEnv(variable, value);
    }

    vi.stubEnv("VITE_SUPABASE_STAGING_URL", "");
    expect(getSupabaseConfig()).toEqual({
      url: "",
      key: publishableKey,
      projectRef: "staging-project",
    });
    expect(() => getSupabaseClient()).toThrow("Supabase is not configured.");
  });

  it("rejects malformed staging URLs and project-reference mismatches", () => {
    vi.stubEnv("MODE", "staging");
    vi.stubEnv("VITE_SUPABASE_STAGING_PUBLISHABLE_KEY", publishableKey);
    vi.stubEnv("VITE_SUPABASE_STAGING_PROJECT_REF", "staging-project");

    vi.stubEnv("VITE_SUPABASE_STAGING_URL", "http://staging-project.supabase.co");
    expect(isSecureBackendConfigured()).toBe(false);

    vi.stubEnv("VITE_SUPABASE_STAGING_URL", "https://other-project.supabase.co");
    expect(isSecureBackendConfigured()).toBe(false);
  });

  it("keeps the existing production/default variable behavior outside staging", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_SUPABASE_URL", "https://production-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);

    expect(getSupabaseConfig()).toEqual({
      url: "https://production-project.supabase.co",
      key: publishableKey,
      projectRef: "",
    });
    expect(isSecureBackendConfigured()).toBe(true);
  });

  it("prefers the recommended publishable key and supports the legacy anon key", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", legacyAnonKey("anon"));

    expect(getSupabaseConfig().key).toBe(publishableKey);
    expect(isSecureBackendConfigured()).toBe(true);

    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(getSupabaseConfig().key).toBe(legacyAnonKey("anon"));
    expect(isSecureBackendConfigured()).toBe(true);
  });

  it("accepts only publishable keys or legacy JWT keys with the anon role", () => {
    expect(isPublicSupabaseKey(publishableKey)).toBe(true);
    expect(isPublicSupabaseKey(legacyAnonKey("anon"))).toBe(true);
    expect(isPublicSupabaseKey(`sb_secret_${"a".repeat(32)}`)).toBe(false);
    expect(isPublicSupabaseKey(legacyAnonKey("service_role"))).toBe(false);
    expect(isPublicSupabaseKey("sb_unrecognized_key_format")).toBe(false);
    expect(isPublicSupabaseKey("header.bm90LWpzb24.signature")).toBe(false);
    expect(isPublicSupabaseKey("header.bnVsbA.signature")).toBe(false);
  });

  it("rejects malformed URL or key configuration", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "not-a-url");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", publishableKey);
    expect(isSecureBackendConfigured()).toBe(false);

    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", `sb_secret_${"a".repeat(32)}`);
    expect(isSecureBackendConfigured()).toBe(false);
  });

  it("does not fall back to demo authentication when public credentials are missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    expect(isSecureBackendConfigured()).toBe(false);
    expect(() => getSupabaseClient()).toThrow("Supabase is not configured.");
  });
});
