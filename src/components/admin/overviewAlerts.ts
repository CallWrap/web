import type {
  BackendCounselorSummary,
  BackendCustomerSummary,
  BackendReviewStats,
} from '../../api/backendTypes';

/* ─────────────────────────────────────────────────────────────
   개요 탭 알림 패널 (피그마 17 우측 상단).

   별도 알림 테이블이나 API를 만들지 않았다. 피그마에 그려진 알림 문구가 전부
   이미 있는 집계(상담사 현황·민원인 현황·통계)에서 그대로 계산되는 것들이라,
   테이블을 새로 파면 같은 수치를 두 곳에서 관리하게 되고 둘이 어긋난다.
   여기서 파생시키면 화면의 다른 패널과 항상 같은 숫자를 말한다.

   문구를 지어내지 않는 것이 이 파일의 규칙이다 — 근거가 되는 수치가 없으면
   그 알림은 만들지 않는다(빈 목록이면 패널이 "알림 없음"을 그대로 보여준다).
   ───────────────────────────────────────────────────────────── */

export type AlertKind = '상담사' | '민원인' | 'FAQ';

export interface OverviewAlert {
  id: string;
  kind: AlertKind;
  text: string;
  /** 심각한 것부터 위로. 같은 순위면 만들어진 순서를 지킨다. */
  weight: number;
}

/** 악성콜이 한 상담사에게 이만큼 몰리면 배정 편중으로 본다. */
const MALICIOUS_CONCENTRATION = 0.4;
/** 팀 평균 통화 시간 대비 이만큼 길면 알린다. */
const LONG_CALL_RATIO = 1.25;
/** 민원인 재문의 알림 기준. */
const REPEAT_CALL_THRESHOLD = 5;

export function buildOverviewAlerts(
  stats: BackendReviewStats | null,
  counselors: BackendCounselorSummary[],
  customers: BackendCustomerSummary[],
  draftFaqCount: number,
): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];

  // ── 상담사: 휴식 권장 / 주의 상태 ─────────────────────────
  counselors
    .filter((c) => c.state === '휴식 권장' || c.state === '주의')
    .sort((a, b) => b.maliciousCalls - a.maliciousCalls)
    .forEach((c) => {
      alerts.push({
        id: `state-${c.id}`,
        kind: '상담사',
        text: `${c.name} 부정 발화가 올라 ${c.state} 상태입니다.`,
        weight: c.state === '휴식 권장' ? 0 : 2,
      });
    });

  // ── 상담사: 악성콜 배정 편중 ──────────────────────────────
  const malicious = Object.entries(stats?.maliciousByCounselor ?? {});
  const maliciousTotal = malicious.reduce((sum, [, n]) => sum + n, 0);
  const top = malicious.sort((a, b) => b[1] - a[1])[0];
  if (top && maliciousTotal > 0 && top[1] / maliciousTotal >= MALICIOUS_CONCENTRATION) {
    alerts.push({
      id: 'malicious-skew',
      kind: '상담사',
      text: `악성콜 ${maliciousTotal}건 중 ${top[1]}건이 ${top[0]}에게 배정되었습니다.`,
      weight: 1,
    });
  }

  // ── 상담사: 팀 평균보다 긴 통화 ───────────────────────────
  // 통화를 한 건도 안 받은 사람은 평균을 왜곡하므로 뺀다.
  const active = counselors.filter((c) => c.totalCalls > 0 && c.avgCallSec > 0);
  if (active.length >= 3) {
    const teamAvg = active.reduce((sum, c) => sum + c.avgCallSec, 0) / active.length;
    active
      .filter((c) => c.avgCallSec >= teamAvg * LONG_CALL_RATIO)
      .forEach((c) => {
        const pct = Math.round(((c.avgCallSec - teamAvg) / teamAvg) * 100);
        alerts.push({
          id: `longcall-${c.id}`,
          kind: '상담사',
          text: `${c.name} 평균 통화 시간이 팀 평균보다 ${pct}% 깁니다.`,
          weight: 4,
        });
      });
  }

  // ── 민원인: 반복 문의 / 연속 악성콜 ───────────────────────
  customers
    .filter((c) => c.maliciousCalls >= 2)
    .sort((a, b) => b.maliciousCalls - a.maliciousCalls)
    .slice(0, 2)
    .forEach((c) => {
      alerts.push({
        id: `cust-mal-${c.id}`,
        kind: '민원인',
        text: `${c.name ?? '이름 미상'} 민원인의 상담이 악성콜로 ${c.maliciousCalls}회 판정됐습니다.`,
        weight: 3,
      });
    });

  customers
    .filter((c) => c.totalCalls >= REPEAT_CALL_THRESHOLD)
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, 2)
    .forEach((c) => {
      alerts.push({
        id: `cust-repeat-${c.id}`,
        kind: '민원인',
        text: `${c.name ?? '이름 미상'} 민원인이 ${c.totalCalls}번째 문의했습니다.`,
        weight: 5,
      });
    });

  // ── FAQ: 검수 대기 초안 ───────────────────────────────────
  if (draftFaqCount > 0) {
    alerts.push({
      id: 'faq-draft',
      kind: 'FAQ',
      text: `검수 대기 중인 FAQ 초안이 ${draftFaqCount}건 쌓였습니다.`,
      weight: 6,
    });
  }

  return alerts.sort((a, b) => a.weight - b.weight);
}
