import { useEffect, useState } from 'react';
import { useCallStore } from '../store/callStore';

// 서버(Spring)가 콜 상태 변경을 SSE로 밀어준다 — 대기열을 몇 초마다 다시 긁어오는 폴링 대신,
// 상태가 실제로 바뀌었을 때만 refreshQueue()를 부른다.
//
// 네이티브 EventSource는 Authorization 헤더를 못 보낸다(브라우저 표준 제약). RBAC 도입 후에도
// 이 엔드포인트(GET /api/reviews/stream)는 SecurityConfig에서 의도적으로 permitAll로 열어뒀다 —
// 보내는 데이터가 {callId, status}뿐이고 상담사별 필터링도 없어 인증할 실익이 없기 때문이다.
// 다른 데이터를 태우게 되면 그때는 쿠키 기반 인증이나 fetch-event-source 같은 라이브러리로
// 바꿔야 한다. 연결이 끊기면 EventSource가 브라우저 표준 동작으로 알아서 재연결을 시도한다 —
// 재연결 자체는 자동이지만, 그 사이엔 실시간 반영이 멈춘다는 걸 화면에 보여줘야 해서
// connected 상태를 반환한다.
export function useReviewStream(): { connected: boolean } {
  const refreshQueue = useCallStore((s) => s.refreshQueue);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const source = new EventSource('/api/reviews/stream', { withCredentials: true });

    source.addEventListener('call-status-changed', () => {
      refreshQueue();
    });
    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));

    return () => source.close();
  }, [refreshQueue]);

  return { connected };
}
