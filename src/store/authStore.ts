import { create } from 'zustand';
import { ApiError, apiFetch, setAccessToken } from '../api/http';
import type { BackendCounselorMe, BackendLoginResponse, BackendTokenRefreshResponse } from '../api/backendTypes';

interface AuthState {
  status: 'idle' | 'checking' | 'authenticated' | 'unauthenticated';
  counselor: BackendCounselorMe | null;
  error: string | null;

  /** 새로고침 대응 — refreshToken은 HttpOnly 쿠키라 서버가 자동으로 받으니 조용히 재로그인 시도 */
  initialize: () => Promise<void>;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

async function fetchMe(): Promise<BackendCounselorMe> {
  return apiFetch<BackendCounselorMe>('/api/users/me');
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  counselor: null,
  error: null,

  initialize: async () => {
    set({ status: 'checking' });
    try {
      const res = await apiFetch<BackendTokenRefreshResponse>('/api/auth/refresh', {
        method: 'POST',
        skipAuthRetry: true,
      });
      setAccessToken(res.accessToken);
      const me = await fetchMe();
      set({ status: 'authenticated', counselor: me, error: null });
    } catch {
      setAccessToken(null);
      set({ status: 'unauthenticated', counselor: null });
    }
  },

  login: async (loginId, password) => {
    set({ error: null });
    try {
      const res = await apiFetch<BackendLoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { loginId, password },
        skipAuthRetry: true,
      });
      setAccessToken(res.accessToken);
      const me = await fetchMe();
      set({ status: 'authenticated', counselor: me, error: null });
    } catch (err) {
      // 서버 원문(에러 코드·경로 등)을 그대로 화면에 뿌리지 않는다 — 로그인 실패는
      // 원인이 무엇이든 사용자에겐 "아이디/비밀번호가 틀렸다" 하나로만 보여야 한다.
      // 서버에 아예 못 닿은 경우만 예외로 네트워크 안내를 그대로 살린다.
      const message =
        err instanceof ApiError && err.code === 'NETWORK_ERROR'
          ? err.message
          : '아이디 또는 비밀번호가 틀립니다.';
      set({ status: 'unauthenticated', error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 로그아웃 API가 실패해도 클라이언트 쪽 세션은 정리한다
    }
    setAccessToken(null);
    set({ status: 'unauthenticated', counselor: null });
  },
}));
