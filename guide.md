# web — 사보원 오프라인 셋업 가이드

## 상태: 설치는 이미 끝나 있음

`node_modules/`가 이미 설치되어 있고 `dist/`(프로덕션 빌드)도 만들어져 있다.
**`npm install`을 새로 할 필요 없다.**

## 실행 — `npm run build` + `npm run preview`가 아니라 `npm run dev`를 쓴다

```bash
npm run dev
```
`http://localhost:5173` 접속.

**왜 `dev`인가**: `vite.config.ts`의 API 프록시(`/api` → `http://localhost:8080`)가
`server.proxy`에만 설정되어 있고 `preview.proxy`에는 없다. 그래서 `npm run build` 결과물을
`npm run preview`로 띄우면 `/api` 요청이 Spring으로 안 넘어가고 깨진다. `npm run dev`는
이 프록시가 그대로 적용되므로 문제없이 동작한다.

## 필요 조건

- `server-spring`이 `http://localhost:8080`에 떠 있어야 로그인·데이터 조회가 된다 — [server-spring/guide.md](../server-spring/guide.md) 참고.
- 로그인 정보는 server-spring 가이드에서 만든 테스트 계정(`tester` / `test1234`)을 쓴다.

## 확인 포인트

- `/queue` — 대기열 화면, SSE로 실시간 갱신되는지(콜 상태 바뀔 때 새로고침 없이 반영)
- `/review/:callId` — 검토 화면, AI 판정값·전사·근거 하이라이트
- `/admin` — 관리자 대시보드. Spring이 최신 버전이면 정상 렌더링된다(과거 버전엔
  `hourlyThroughput`/`maliciousByCounselor` 필드 누락으로 하얗게 죽는 버그가 있었음 — 수정됨)

## 참고

전체 조합 실행 순서(인프라 → Spring → FastAPI → web)와 실제 통화 넣어보는 방법은
루트의 `사보원_테스트_가이드.md`를 따른다.
