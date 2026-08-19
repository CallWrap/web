import { useEffect } from 'react';
import { useCallStore } from '../store/callStore';

// 서버(Spring)가 콜 상태 변경을 SSE로 밀어준다 — 대기열을 몇 초마다 다시 긁어오는 폴링 대신,
// 상태가 실제로 바뀌었을 때만 refreshQueue()를 부른다.
//
// 네이티브 EventSource는 Authorization 헤더를 못 보낸다(브라우저 표준 제약). 지금은
// SecurityConfig가 데모 단계라 permitAll이라 문제가 안 되지만, 실제 인가를 붙이면
// 쿠키 기반 인증으로 바꾸거나 fetch-event-source 같은 라이브러리로 교체해야 한다.
// 연결이 끊기면 EventSource가 브라우저 표준 동작으로 알아서 재연결을 시도한다.
export function useReviewStream() {
  const refreshQueue = useCallStore((s) => s.refreshQueue);

  useEffect(() => {
    const source = new EventSource('/api/reviews/stream', { withCredentials: true });

    source.addEventListener('call-status-changed', () => {
      refreshQueue();
    });

    return () => source.close();
  }, [refreshQueue]);
}
