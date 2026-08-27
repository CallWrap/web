import { create } from 'zustand';
import { getQueue, getCall, saveCall, addFollowupNote } from '../api/api';
import type { Call, SaveCallPayload } from '../api/types';

interface CallState {
  calls: Call[];
  loaded: boolean;
  loadError: string | null;
  /** 마지막으로 조회한 기간. SSE 실시간 갱신이 이 조건을 유지하도록 들고 있는다 —
   *  안 그러면 이벤트가 올 때마다 사용자가 건 기간 필터가 풀린다. */
  range: { from: string; to: string } | null;
  totalReviewSec: number; // 저장된 콜들의 누적 검토 시간 (대시보드 평균 계산용)

  loadQueue: () => Promise<void>;
  refreshQueue: (range?: { from: string; to: string }) => Promise<void>;
  createFollowupNote: (callId: string, content: string) => Promise<void>;
  fetchCall: (id: string) => Promise<Call | undefined>;
  approveCall: (id: string, payload: SaveCallPayload) => Promise<Call>;
  toggleFollowupAction: (callId: string, actionId: string) => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  calls: [],
  loaded: false,
  loadError: null,
  range: null,
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

  // loadQueue()와 달리 loaded 여부와 상관없이 항상 다시 받아온다 — SSE로 콜 상태 변경
  // 이벤트가 왔을 때(useReviewStream) 대기열을 실시간으로 갱신하는 용도.
  refreshQueue: async (range) => {
    // 인자가 있으면 새 조건으로 조회하고 기억한다. 없으면(SSE 갱신) 직전 조건을 그대로 쓴다.
    const next = range ?? get().range ?? undefined;
    try {
      const queue = await getQueue(next);
      set({ calls: queue, loaded: true, loadError: null, range: next ?? null });
    } catch (err) {
      // 실시간 갱신 실패는 조용히 넘어간다 — 다음 이벤트나 다음 수동 새로고침에서 다시 시도된다.
      // 여기서 loadError를 세우면 정상 작동 중인 화면이 갑자기 에러 화면으로 바뀔 수 있다.
      console.warn('실시간 대기열 갱신 실패:', err);
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

  createFollowupNote: async (callId, content) => {
    await addFollowupNote(callId, content);
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
