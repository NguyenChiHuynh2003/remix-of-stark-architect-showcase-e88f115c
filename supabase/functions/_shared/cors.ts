// Shared CORS configuration for edge functions
// Restricts access to allowed origins only

const ALLOWED_ORIGINS = [
  Deno.env.get("ALLOWED_ORIGIN") || "",
  "https://ykqehrfyikflsrgtroto.supabase.co",
  "https://lovable.dev",
  "https://app.lovable.dev",
].filter(Boolean);

// Add localhost origins for development
if (Deno.env.get("DENO_ENV") !== "production") {
  ALLOWED_ORIGINS.push("http://localhost:3000", "http://localhost:5173", "http://localhost:8080");
}

// Check if origin is a valid localhost URL (prevents domain confusion attacks)
function isValidLocalhost(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed =
    origin &&
    (ALLOWED_ORIGINS.some((allowed) => origin === allowed) ||
      origin.endsWith(".lovable.app") ||
      origin.endsWith(".lovableproject.com") ||
      isValidLocalhost(origin));

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0] || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow requests without origin (e.g., from Supabase itself)
  return (
    ALLOWED_ORIGINS.some((allowed) => origin === allowed) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    isValidLocalhost(origin)
  );
}

// Legacy support: static CORS headers for backward compatibility
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
