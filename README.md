# CallWrap — Web

상담사 검토·승인 화면과 관리자 대시보드. 파이프라인의 마지막 단계 — AI가 채운 후처리 폼을
상담사가 검토·수정·확정하고, 관리자는 처리 현황과 FAQ를 관리한다.

**담당:** 이재혁

## 개요

상담이 끝나면 Spring이 비동기로 처리한 AI 분석 결과를 이 화면이 받아, 신뢰도(tier)에 따라
다르게 보여준다. 확신도가 높은 항목은 한 번의 클릭으로 일괄 승인하고, 낮은 항목은 상담사가
직접 판단해 채운다. 이 검토·확정 흐름이 상담 후처리 시간을 줄이는 핵심 경험이다.

`src/api/api.ts`가 실제 Spring API(`/api/reviews`, `/api/reviews/stats`, `/api/auth/*` 등)를
호출한다 — 초기 프로토타입 단계의 mock 계층은 실제 연동으로 교체됐다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드
```

Spring(`server-spring`)이 `http://localhost:8080`에 떠 있어야 로그인·데이터 조회가 정상 동작한다.

## 화면 (라우트)

| 경로 | 화면 | 핵심 |
| --- | --- | --- |
| `/login` | 로그인 | JWT 발급, 미인증 시 자동 리다이렉트 |
| `/queue` | 검토 대기열(홈) | 분석 중 → 검토 대기 상태 전이, 악성콜 강조 |
| `/review/:callId` | 상담 검토 | 2열(전사/폼), 신뢰도 3-tier, 근거 하이라이트, 검토 타이머 |
| `/followups` | 후속처리 목록 | 후속필요 콜 + 액션 체크리스트 |
| `/completed` | 처리 완료 목록 | 확정된 콜(후속필요 포함) 전체 |
| `/admin` | 관리자 대시보드 — 개요 | 처리량·평균 검토시간·악성콜률, Recharts |
| `/admin/measure` | 관리자 — 측정 결과 | 모델 선정 비교, 파이프라인 지표(내부/제한 검증 라벨) |
| `/admin/grade` | 관리자 — 등급·분포 | 상담등급 성능, 상담유형 분포 |
| `/admin/ledger` | 관리자 — 상담대장 | 전체 콜 목록, 검색, CSV 내려받기 |
| `/admin/quality` | 관리자 — 상담품질 자동평가 | 배점 체계(사보원 공식 기준) 노출, 자동채점 연동 전 |
| `/admin/holdout` | 관리자 — 홀드아웃 검증 | 홀드아웃 재측정 결과(측정 완료분만) |
| `/admin/faq` | 관리자 — FAQ 검수 | AI 생성 FAQ 초안 검수(수정/게시/폐기) |

## 인증

로그인하면 액세스 토큰 + HttpOnly 리프레시 쿠키를 받는다(`useAuthStore`). 미인증 상태에서 보호된
경로에 접근하면 `/login`으로 리다이렉트된다. 토큰 갱신·만료 처리는 `store/authStore`가 담당한다.

## 신뢰도 3-tier (`TriageForm.tsx`)

- **high (≥90%)** — 항목 접힘(한 줄 요약 + "근거 ▾" 토글로 펼치면 전체 카드), 일괄 승인 배너로 한 번에 처리
- **medium (60~90%)** — 항상 펼침, 값 편집 가능 + 근거 문장 링크(클릭 시 좌측 전사로 스크롤·플래시)
- **low (<60%)** — 항상 펼침, "AI 신뢰도가 낮습니다 — 직접 판단해 입력해 주세요" 안내
- 세 tier 모두 언제나 수정 가능 — 접힘/펼침만 신뢰도로 결정

low 항목의 안내 문구는 원인(모델 자체가 아직 없는지, 확신도만 낮은지)을 구분해서 보여주지 않는다 —
상담사 입장에서는 "직접 채워야 한다"는 사실만 중요하고, 어떤 내부 사정 때문인지는 몰라도 되는
정보이기 때문이다. 원인별 추적은 `failures` 필드로 내부적으로만 유지한다.

## 빈 상태·미측정 지표 표시 원칙

- 값이 없는 자리는 `'—'`나 `(없음)` 같은 무의미한 자리표시 대신, `lib/format.ts`의 `EMPTY` 상수로
  원인이 읽히는 문구를 쓴다("접수 처리 중", "요약 정리 중" 등).
- 실측치가 없는 지표는 `components/PendingMetric.tsx`로 "측정 예정 — 무엇이 필요한지"를 보여준다.
  "미구현" 같은 개발 내부 용어는 사용자 화면에 노출하지 않는다.
- 실제 측정된 지표는 항상 "내부/제한 검증" 라벨과 함께 노출한다 — 재현(합성) 데이터 기준이며
  실제 상담 녹취로 재검증되지 않았다는 뜻이다.

## API 계약

- `src/api/types.ts` — 프론트 내부에서 쓰는 도메인 타입(`Call`, `CallFields`, `FormFieldData`, `Tier` 등)
- `src/api/backendTypes.ts` — Spring 응답 원본 스키마(snake_case가 아니라 Spring이 이미 camelCase로 내려줌)
- `src/api/adapt.ts` — 백엔드 응답을 프론트 도메인 타입으로 변환(`GRADE_MAP` 등 라벨 매핑 포함)
- `src/api/api.ts` — 실제 fetch 호출(`getQueue`, `getCall`, `saveCall`, `getReviewStats` 등)

## 상태 머신 (콜)

```
UPLOADED → PROCESSING → (DONE / NEEDS_HUMAN_REVIEW / FAILED) → CONFIRMED
                                                        └→ (후속필요) → followup
```

화면에서는 `분석 중(analyzing) → 검토 대기(review) → 확정(confirmed)`, 후속 필요 시
`review → followup`으로 표시된다. `server-spring` README의 6단계 상태와 1:1로 대응한다.

## 기술 스택

React 18 + TypeScript + Vite · React Router · zustand · Recharts · CSS 디자인 토큰

## 구조

```
src/
├── api/         types(프론트 도메인) · backendTypes(Spring 응답) · adapt(변환) · api(fetch 호출)
├── data/        measuredMetrics(AI-model 실측치, 내부/제한 검증 라벨)
├── mock/        qualityScores(상담품질 배점 체계 — 통화별 채점은 미연동)
├── store/       callStore · authStore · toastStore
├── hooks/       useReviewStream(SSE 실시간 대기열 갱신, 연결 끊김 상태 노출)
├── lib/         format(라벨·포맷·EMPTY 상수) · classificationOptions · exportCsv · adminTabs
├── components/  TriageForm · TranscriptPanel · StatusBadge · QueueRow · FaqReviewPanel · PendingMetric
└── pages/       QueuePage · ReviewPage · FollowupPage · CompletedPage · AdminPage · LoginPage
```
