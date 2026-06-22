/**
 * API client with automatic auth token injection.
 *
 * The CLI Express server requires a Bearer token for all /api/* routes.
 * This module fetches the key once from /api/auth/key and attaches it
 * to every outgoing request via apiFetch(). SSE EventSource calls use
 * getApiKey() to send the token as a query parameter.
 */

let apiKeyPromise: Promise<string> | null = null;

async function fetchApiKey(): Promise<string> {
  const res = await fetch('/api/auth/key');
  if (!res.ok) {
    throw new Error(`Failed to get API key: ${res.status}`);
  }
  const data: { apiKey: string } = await res.json();
  return data.apiKey;
}

/** Returns a cached promise that resolves to the server API key. */
export function getApiKey(): Promise<string> {
  if (!apiKeyPromise) {
    apiKeyPromise = fetchApiKey();
  }
  return apiKeyPromise;
}

/**
 * Thin wrapper around fetch() that automatically attaches the
 * Authorization: Bearer header for all API requests.
 *
 * Falls back to an unauthenticated fetch if the key cannot be obtained,
 * so the server's own 401 handling still works.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const apiKey = await getApiKey();
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    return fetch(input, { ...init, headers });
  } catch {
    return fetch(input, init);
  }
}
