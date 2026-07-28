// ─────────────────────────────────────────────────────────────
// Mock API 레이어
// 실제 API 전환 시 이 파일의 함수 구현부만 fetch 호출로 교체한다.
// 함수 시그니처(계약)는 유지.
// ─────────────────────────────────────────────────────────────
import rawCalls from '../mock/calls.json';
import type { Call, SaveCallPayload } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 후속처리 액션 기본 체크리스트 (콜별 후속필요 시 부여) */
function defaultFollowupActions(callId: string) {
  return [
    { id: `${callId}-f1`, label: '타 기관 자료 연계 결과 확인', done: false },
    { id: `${callId}-f2`, label: '처리 완료 후 민원인에게 문자 안내', done: false },
    { id: `${callId}-f3`, label: '상담 이력 시스템 등록', done: false },
  ];
}

// deep copy로 원본 mock 오염 방지
const seed: Call[] = (rawCalls as Call[]).map((c) => ({
  ...structuredClone(c),
  followupActions: defaultFollowupActions(c.callId),
}));

/** 대기열 조회 */
export async function getQueue(): Promise<Call[]> {
  await delay(300);
  return structuredClone(seed);
}

/** 단일 콜 조회 */
export async function getCall(id: string): Promise<Call | undefined> {
  await delay(200);
  const call = seed.find((c) => c.callId === id);
  return call ? structuredClone(call) : undefined;
}

/** 저장 (승인) — 상태를 confirmed 또는 followup으로 전이 */
export async function saveCall(id: string, payload: SaveCallPayload): Promise<Call> {
  await delay(500);
  const call = seed.find((c) => c.callId === id);
  if (!call) throw new Error(`call ${id} not found`);
  call.fields = payload.fields;
  call.editCount = payload.editCount;
  call.reviewSec = payload.reviewSec;
  call.status = payload.followupNeeded ? 'followup' : 'confirmed';
  return structuredClone(call);
}
