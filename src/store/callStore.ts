import { create } from 'zustand';
import { getQueue, getCall, saveCall } from '../api/api';
import type { Call, SaveCallPayload } from '../api/types';

interface CallState {
  calls: Call[];
  loaded: boolean;
  loadError: string | null;
  totalReviewSec: number; // 저장된 콜들의 누적 검토 시간 (대시보드 평균 계산용)

  loadQueue: () => Promise<void>;
  fetchCall: (id: string) => Promise<Call | undefined>;
  approveCall: (id: string, payload: SaveCallPayload) => Promise<Call>;
  toggleFollowupAction: (callId: string, actionId: string) => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  calls: [],
  loaded: false,
  loadError: null,
  totalReviewSec: 0,

  loadQueue: async () => {
    // 이미 로드됐다면 상태 유지 (검토 후 돌아왔을 때 대기열이 리셋되지 않도록)
    if (get().loaded) return;
    set({ loadError: null });
    try {
      const queue = await getQueue();
      set({ calls: queue, loaded: true });
    } catch (err) {
      set({ loadError: err instanceof Error ? err.message : '대기열을 불러오지 못했습니다.' });
    }
  },

  fetchCall: async (id) => {
    // 대기열 캐시(calls)는 목록 API에서 온 placeholder(fields 비어있음)라 재사용하면 안 된다 —
    // 검토 화면은 항상 상세 API로 실제 필드를 받아온다.
    try {
      return await getCall(id);
    } catch {
      return undefined;
    }
  },

  approveCall: async (id, payload) => {
    const saved = await saveCall(id, payload);
    set((s) => ({
      calls: s.calls.map((c) => (c.callId === id ? saved : c)),
      totalReviewSec: s.totalReviewSec + payload.reviewSec,
    }));
    return saved;
  },

  toggleFollowupAction: (callId, actionId) => {
    set((s) => ({
      calls: s.calls.map((c) =>
        c.callId === callId
          ? {
              ...c,
              followupActions: (c.followupActions ?? []).map((a) =>
                a.id === actionId ? { ...a, done: !a.done } : a,
              ),
            }
          : c,
      ),
    }));
  },
}));
