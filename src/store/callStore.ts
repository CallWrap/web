import { create } from 'zustand';
import { getQueue, getCall, saveCall } from '../api/api';
import type { Call, CallFields, SaveCallPayload } from '../api/types';

interface CallState {
  calls: Call[];
  loaded: boolean;
  totalReviewSec: number; // 저장된 콜들의 누적 검토 시간 (대시보드 평균 계산용)

  loadQueue: () => Promise<void>;
  fetchCall: (id: string) => Promise<Call | undefined>;
  approveCall: (id: string, payload: SaveCallPayload) => Promise<Call>;
  toggleFollowupAction: (callId: string, actionId: string) => void;
}

/** 데모용: 대기열 진입 시 일부 콜을 analyzing으로 두고 setTimeout으로 review 전이 */
function simulateAnalysis(
  calls: Call[],
  set: (fn: (s: CallState) => Partial<CallState>) => void,
): Call[] {
  // 악성콜(2841)을 '분석 중'으로 시작 → 발표 시 상태 전이를 눈으로 보여줌
  const analyzingIds = ['2841'];
  const staged = calls.map((c) =>
    analyzingIds.includes(c.callId) ? { ...c, status: 'analyzing' as const } : c,
  );

  analyzingIds.forEach((id, i) => {
    setTimeout(
      () => {
        set((s) => ({
          calls: s.calls.map((c) =>
            c.callId === id && c.status === 'analyzing'
              ? { ...c, status: 'review' as const }
              : c,
          ),
        }));
      },
      3500 + i * 1500,
    );
  });

  return staged;
}

export const useCallStore = create<CallState>((set, get) => ({
  calls: [],
  loaded: false,
  totalReviewSec: 0,

  loadQueue: async () => {
    // 이미 로드됐다면 상태 유지 (검토 후 돌아왔을 때 대기열이 리셋되지 않도록)
    if (get().loaded) return;
    const queue = await getQueue();
    const staged = simulateAnalysis(queue, set);
    set(() => ({ calls: staged, loaded: true }));
  },

  fetchCall: async (id) => {
    const local = get().calls.find((c) => c.callId === id);
    if (local) return local;
    return getCall(id);
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
