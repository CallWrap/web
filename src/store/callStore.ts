import { create } from 'zustand';
import { getQueue, getCall, saveCall } from '../api/api';
import type { Call, CallFields, SaveCallPayload } from '../api/types';

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
    const local = get().calls.find((c) => c.callId === id);
    if (local) return local;
    try {
      return await getCall(id);
    } catch {
      return undefined;
    }
  },

  approveCall: async (id, payload) => {
    const saved = await saveCall(id, payload);
    set((s) => ({
      calls: s.calls.map((c) => (c.callId === id ? { ...saved, followupActions: c.followupActions } : c)),
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

/** confidence → tier 파생 (백엔드가 tier를 안 줄 때의 프론트 fallback) */
export function deriveTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

export type { CallFields };
