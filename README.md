# web/

상담사 검토·승인 UI. 파이프라인의 ⑤.

**담당:** 이재혁

## 할 일

- F5: AI가 채운 후처리 폼을 상담사가 검토·수정·승인하는 화면
  - 신뢰도 3-tier 렌더링 — High(원클릭 승인) / Medium(근거 문장 하이라이트 + 수정 유도) / Low(직접 입력 안내)
  - `evidence_indices`로 전사 내 근거 발화 하이라이트
- F6: 통계 대시보드

# AfterCall — 상담 후처리 AI 데모

상담이 끝나면 AI가 후처리 폼을 자동으로 채우고, 상담사가 신뢰도(tier)에 따라
검토·승인하는 핵심 경험을 시연용으로 재현한 프론트엔드 데모입니다.
실제 STT·AI·백엔드 없이 **mock JSON + 상태 시뮬레이션**으로 전체 흐름을 보여주며,
실제 API가 붙을 때 **mock 레이어(`src/api/api.ts`)만 교체**하면 되도록 계약을 코드로 고정했습니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입체크 + 프로덕션 빌드
```

## 화면 (라우트)

| 경로 | 화면 | 핵심 |
| --- | --- | --- |
| `/queue` | 검토 대기열(홈) | 분석 중 → 검토 대기 상태 전이, 악성콜 강조, metric 카드 |
| `/review/:callId` | 상담 검토 | 2열(전사/폼), 신뢰도 3-tier, 근거 하이라이트, 검토 타이머 |
| `/followups` | 후속처리 목록 | 후속필요 콜 + 액션 체크리스트 |
| `/admin` | 관리자 대시보드 | 처리량·평균 검토시간·악성콜률·개방 후보, Recharts |

## 신뢰도 3-tier (`TriageForm.tsx`)

- **high (≥90%)** — 항목 접힘(한 줄 요약 + "근거 ▾" 토글로 펼치면 전체 카드), 일괄 승인 배너로 한 번에 처리
- **medium (60~90%)** — 항상 펼침, 값 편집 가능 + 근거 문장 링크(클릭 시 좌측 전사로 스크롤·플래시)
- **low (<60%)** — 항상 펼침, "직접 판단 필요" 안내 + 빈 입력
- 세 tier 모두 언제나 수정 가능 — 접힘/펼침만 신뢰도로 결정

## API 계약 = 교체 지점

- `src/api/types.ts` — 응답 스키마(= 백엔드 합의 기준). `Call`, `CallFields`, `FormFieldData`, `Tier` 등.
- `src/api/api.ts` — mock 구현. `getQueue()`, `getCall(id)`, `saveCall(id, payload)`.
  **실제 전환 시 이 파일의 함수 본문만 `fetch` 호출로 교체**하고 시그니처는 유지합니다.
- `src/mock/calls.json` — 콜 5건(악성콜 1건, low 항목 포함 1건). 이 JSON 형태가 곧 API 응답 형태입니다.
- `tier`는 `confidence`에서 파생 가능하지만, 캘리브레이션이 백엔드 책임이므로 응답에 포함하는 계약으로 둡니다
  (`deriveTier()`는 백엔드가 tier를 안 줄 때의 프론트 fallback).

## 상태 머신 (콜)

```
transcribing → quality_check → analyzing → review → confirmed
                                             └→ (후속필요) → followup
```

`analyzing` 상태와 그 UI(스피너·비활성 행)는 실제 백엔드가 분석 중인 콜을 내려줄 때를 위해 남겨두되,
데모 목업에서는 인위적으로 상태를 전이시키는 연출 없이 모든 콜이 처음부터 `review`(검토 대기)로 표시됩니다.

## 시연 스크립트

1. **대기열** — 검토 대기 콜 목록(좌측 red 보더 = 악성콜)
2. **검토** — high 일괄 승인, medium/low 근거 클릭해 좌측 발화 하이라이트, 요약 수정(수정 건수 = 재학습 데이터 축적)
3. **저장** — 검토 타이머 기록 → 대기열에서 사라지고 후속 탭 배지 +1, 다음 검토 대기 콜로 자동 이동
4. **대시보드** — 처리량·악성콜률·개방 후보·평균 검토시간(실측 반영)

## 기술 스택

React 18 + TypeScript + Vite · React Router · zustand · Recharts · CSS 디자인 토큰

## 구조

```
src/
├── api/       types.ts(계약) · api.ts(mock↔real 교체 지점)
├── mock/      calls.json
├── store/     callStore(콜 상태·분석 시뮬레이션) · toastStore
├── lib/       format(라벨·포맷)
├── components/ TriageForm · TranscriptPanel · StatusBadge · QueueRow
└── pages/     QueuePage · ReviewPage · FollowupPage · AdminPage
```
