const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;
const legacyAnonKeyPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isPublicSupabaseKey(key: string) {
  if (publishableKeyPattern.test(key)) return true;
  if (!legacyAnonKeyPattern.test(key)) return false;

  try {
    const payload = key.split(".")[1];
    if (!payload) return false;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims: unknown = JSON.parse(decoded);
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return false;
    return "role" in claims && claims.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseConfig() {
  if (import.meta.env.MODE === "staging") {
    return {
      url: import.meta.env["VITE_SUPABASE_STAGING_URL"]?.trim() ?? "",
      key: import.meta.env["VITE_SUPABASE_STAGING_PUBLISHABLE_KEY"]?.trim() ?? "",
      projectRef: import.meta.env["VITE_SUPABASE_STAGING_PROJECT_REF"]?.trim() ?? "",
    };
  }

  const url = import.meta.env["VITE_SUPABASE_URL"]?.trim() ?? "";
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"]?.trim() ?? "";
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim() ?? "";

  return {
    url,
    key: publishableKey || anonKey,
    projectRef: "",
  };
}

export function isSecureBackendConfigured() {
  const { url, key, projectRef } = getSupabaseConfig();
  if (!url || !key) return false;

  try {
    const parsed = new URL(url);
    if (import.meta.env.MODE === "staging") {
      const match = parsed.hostname.match(/^([a-z0-9][a-z0-9-]*)\.supabase\.co$/);
      return (
        parsed.protocol === "https:" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.port &&
        !parsed.pathname.replace(/\/$/, "") &&
        !parsed.search &&
        !parsed.hash &&
        Boolean(projectRef) &&
        match?.[1] === projectRef &&
        isPublicSupabaseKey(key)
      );
    }

    const validProtocol = parsed.protocol === "https:" || parsed.hostname === "localhost";
    return validProtocol && isPublicSupabaseKey(key);
  } catch {
    return false;
  }
}

export function getSecureBackendStatus() {
  return {
    configured: isSecureBackendConfigured(),
    mode: isSecureBackendConfigured() ? "supabase" : "not-configured",
    requiresServerRules: !isSecureBackendConfigured(),
  };
}
