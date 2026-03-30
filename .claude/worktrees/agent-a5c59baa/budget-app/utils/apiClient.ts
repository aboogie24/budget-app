import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL =
  Constants.expoConfig?.extra?.API_URL ??
  (Constants as any).manifest?.extra?.API_URL ??
  'http://localhost:8080';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const json = await AsyncStorage.getItem('budgetAppSession');
    if (json) {
      const session = JSON.parse(json);
      if (session?.token) {
        return { Authorization: `Bearer ${session.token}` };
      }
    }
  } catch {
    // no-op
  }
  return {};
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    const json = await AsyncStorage.getItem('budgetAppSession');
    if (json) {
      const session = JSON.parse(json);
      return session?.id ?? null;
    }
  } catch {
    // no-op
  }
  return null;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number>;
};

// Attempt to refresh the JWT token by calling the backend refresh endpoint.
// Returns the new token on success, or null if refresh fails.
async function tryRefreshToken(): Promise<string | null> {
  try {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.Authorization) return null;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (data?.token) {
      // Persist the new token in AsyncStorage.
      const raw = await AsyncStorage.getItem('budgetAppSession');
      if (raw) {
        const session = JSON.parse(raw);
        session.token = data.token;
        await AsyncStorage.setItem('budgetAppSession', JSON.stringify(session));
      }
      return data.token as string;
    }
  } catch {
    // refresh failed — caller should treat as auth failure
  }
  return null;
}

let isRefreshing = false;

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  const authHeaders = await getAuthHeaders();

  let url = `${API_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      qs.set(k, String(v));
    }
    url += `?${qs.toString()}`;
  }

  const headers: Record<string, string> = { ...authHeaders };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  // On 401 (Unauthorized), attempt a single token refresh and retry.
  if (res.status === 401 && !isRefreshing && path !== '/auth/refresh') {
    isRefreshing = true;
    const newToken = await tryRefreshToken();
    isRefreshing = false;

    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const retryRes = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retryRes.ok) {
        const text = await retryRes.text().catch(() => '');
        throw new ApiError(retryRes.status, text || `Request failed: ${retryRes.status}`);
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ─── Convenience methods ────────────────────────────────────────

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number>) =>
    request<T>(path, { params }),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),

  delete: <T = unknown>(path: string, params?: Record<string, string | number>) =>
    request<T>(path, { method: 'DELETE', params }),

  getBaseUrl: () => API_URL,
  getUserId: getCurrentUserId,
};
