// ─────────────────────────────────────────────────────────────
// fetch 래퍼. 인증 헤더 부착 + 401 시 refresh 후 1회 재시도 + 서버 에러 포맷 파싱을 한 곳에서.
// 경로는 상대경로(/api/...)로 호출한다 — dev에서는 vite.config.ts의 proxy가 8080으로
// 넘겨주므로 브라우저 입장에서는 동일 출처라 CORS 설정이 아예 필요 없다.
// ─────────────────────────────────────────────────────────────

import type { BackendErrorResponse, BackendTokenRefreshResponse } from './backendTypes';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// 여러 요청이 동시에 401을 맞아도 refresh 호출은 한 번만 나가도록 in-flight promise를 공유한다.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const body: BackendTokenRefreshResponse = await res.json();
        setAccessToken(body.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** refresh 재시도 자체가 401을 맞았을 때 무한루프 방지용 — 내부에서만 쓴다 */
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  const doFetch = () =>
    fetch(path, {
      method,
      credentials: 'include', // refreshToken(HttpOnly 쿠키) 자동 전송
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = `요청에 실패했습니다 (${res.status})`;
    try {
      const body: BackendErrorResponse = await res.json();
      code = body.code ?? code;
      message = body.message ?? message;
    } catch {
      // Spring 기본 에러 페이지처럼 우리 ErrorResponse 포맷이 아닌 경우 — 기본 메시지 사용
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
