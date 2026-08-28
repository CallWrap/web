import { useEffect, useMemo, useRef, useState } from 'react';
import type { Call, CallFields, FieldKey, SummaryValue, Utterance } from '../../api/types';
import { ApiError } from '../../api/http';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_GRADES,
  CONSULTATION_TYPES,
  getSubcategoryOptions,
  normalizeSubcategoryForCategory,
} from '../../lib/classificationOptions';
import { NO_DATA, fmtCallSeq, fmtStamp } from '../../lib/format';
import { FIELD_ORDER, type Values } from '../../pages/ReviewPage';
import { TranscriptBlock, type TranscriptHandle } from './TranscriptBlock';
import {
  AnchoredMenu,
  anchorRectOf,
  Caret,
  DragPopover,
  GradeHistory,
  PROGRESS_STEPS,
  progressOf,
  type AnchorRect,
  type PopPos,
  type Progress,
} from './CounselorBits';

/* ─────────────────────────────────────────────────────────────
   콜 한 건의 상세 편집 패널.
   상담사 통합 검토 화면의 우측(Figma 14)과 관리자 상담대장의 `상세 보기`
   팝업(Figma 24)이 **같은 화면**이라 한 컴포넌트로 둔다 —
   관리자도 요약·분류·후속 처리를 그대로 수정할 수 있다(관리자 지침 3절).
   ───────────────────────────────────────────────────────────── */

/** 분류·등급 5행. FAQ 요청만 boolean이라 표시 변환이 따로 붙는다. */
const CLASS_ROWS: { key: FieldKey; label: string }[] = [
  { key: 'type', label: '상담유형' },
  { key: 'category', label: '중분류' },
  { key: 'subcategory', label: '소분류' },
  { key: 'grade', label: '상담등급' },
  { key: 'faq', label: 'FAQ 요청' },
];

const FAQ_OPTIONS = ['필요', '불필요'] as const;

/** 근거 발화 팝업을 옮겨둔 자리. 사람마다 선호가 달라 브라우저에 남긴다. */
const EV_POS_KEY = 'callwrap.evidencePopupPos';

function readEvPos(): PopPos | null {
  try {
    const raw = localStorage.getItem(EV_POS_KEY);
    return raw ? (JSON.parse(raw) as PopPos) : null;
  } catch {
    return null; // 사생활 보호 모드 등 — 저장 못 해도 화면은 정상 동작해야 한다
  }
}

interface Props {
  callId: string | null;
  /** 아직 아무것도 안 골랐을 때 보여줄 문구 */
  emptyText?: string;
  /** 저장이 끝났을 때. 목록 쪽에서 배지를 갱신하는 용도 */
  onSaved?: (saved: Call) => void;
}

export function CallDetailPane({ callId, emptyText = '왼쪽 목록에서 상담을 선택하세요.', onSaved }: Props) {
  const fetchCall = useCallStore((s) => s.fetchCall);
  const approveCall = useCallStore((s) => s.approveCall);
  const createFollowupNote = useCallStore((s) => s.createFollowupNote);
  const counselor = useAuthStore((s) => s.counselor);
  const pushToast = useToastStore((s) => s.push);

  const [detail, setDetail] = useState<Call | undefined>();
  const [values, setValues] = useState<Values | null>(null);
  const [progress, setProgress] = useState<Progress>('검토 대기');
  // 새로 쓰는 한 줄. null이면 입력칸 자체가 없다(기존 이력은 detail.followupNotes).
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const enterTime = useRef(Date.now());

  const [selectPop, setSelectPop] = useState<FieldKey | null>(null);
  const [selectRect, setSelectRect] = useState<AnchorRect | null>(null);
  const [evidencePop, setEvidencePop] = useState<FieldKey | null>(null);
  const [evPos, setEvPos] = useState<PopPos | null>(readEvPos);

  const transcriptRef = useRef<TranscriptHandle | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!callId) {
      setDetail(undefined);
      setValues(null);
      return;
    }
    let alive = true;
    setDetail(undefined);
    setValues(null);
    setSaving(false);
    fetchCall(callId).then((c) => {
      if (!alive) return;
      setDetail(c);
      if (c) {
        const v = {} as Record<FieldKey, Values[FieldKey]>;
        FIELD_ORDER.forEach((k) => (v[k] = c.fields[k].value));
        setValues(v as Values);
        setProgress(progressOf(c.status));
        setDraft(null);
        enterTime.current = Date.now();
      }
    });
    return () => {
      alive = false;
    };
  }, [callId, fetchCall]);

  const notes = detail?.followupNotes ?? [];

  const transcriptById = useMemo(() => {
    const m = new Map<string, Utterance>();
    detail?.transcript.forEach((u) => m.set(u.id, u));
    return m;
  }, [detail]);

  /** 기본 자리 — 패널 왼쪽 경계에 걸치게. 옮긴 적이 있으면 그 자리를 그대로 쓴다. */
  function openEvidence(key: FieldKey) {
    if (evidencePop === key) {
      setEvidencePop(null);
      return;
    }
    if (!evPos) {
      const pane = paneRef.current?.getBoundingClientRect();
      const sum = summaryRef.current?.getBoundingClientRect();
      setEvPos({
        x: Math.round((pane ? pane.left : 572) - 220), // 폭 440의 절반만큼 왼쪽으로
        y: Math.round(sum ? sum.top : 400),
      });
    }
    setEvidencePop(key);
  }

  function moveEvidence(p: PopPos) {
    setEvPos(p);
    try {
      localStorage.setItem(EV_POS_KEY, JSON.stringify(p));
    } catch {
      // 저장만 못 할 뿐, 이번 세션 동안은 옮긴 자리가 유지된다
    }
  }

  function setValue(k: FieldKey, v: Values[FieldKey]) {
    setValues((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  function optionsFor(key: FieldKey): readonly string[] {
    switch (key) {
      case 'type': return CONSULTATION_TYPES;
      case 'category': return CONSULTATION_CATEGORIES;
      case 'subcategory': return getSubcategoryOptions(String(values?.category ?? ''));
      case 'grade': return CONSULTATION_GRADES;
      case 'faq': return FAQ_OPTIONS;
      default: return [];
    }
  }

  function displayOf(key: FieldKey): string {
    if (!values) return '';
    if (key === 'faq') return values.faq ? '필요' : '불필요';
    return String(values[key] ?? '');
  }

  function pickOption(key: FieldKey, opt: string) {
    if (key === 'faq') {
      setValue('faq', opt === '필요');
    } else if (key === 'category') {
      // 중분류가 바뀌면 소분류는 그 중분류에 속한 값으로 다시 맞춘다.
      const next = normalizeSubcategoryForCategory(opt, String(values?.subcategory ?? ''));
      setValue('category', opt);
      setValue('subcategory', next || getSubcategoryOptions(opt)[0] || '');
    } else {
      setValue(key, opt);
    }
    setSelectPop(null);
  }

  const summary = (values?.summary ?? { title: '', inquiry: '', resolution: '' }) as SummaryValue;
  function patchSummary(part: Partial<SummaryValue>) {
    setValue('summary', { ...summary, ...part });
  }

  /** 입력칸의 내용을 확정 저장한다. 비어 있으면 그냥 입력칸만 닫는다. */
  async function commitDraft() {
    const content = (draft ?? '').trim();
    if (!detail || !content) {
      setDraft(null);
      return;
    }
    try {
      await createFollowupNote(detail.callId, content);
      // 방금 쓴 줄까지 포함된 목록을 서버에서 다시 받아 온다
      const fresh = await fetchCall(detail.callId);
      if (fresh) setDetail(fresh);
      setDraft(null);
    } catch {
      pushToast('후속 처리 저장에 실패했습니다 · 다시 시도해 주세요');
    }
  }

  function resetEdits() {
    if (!detail) return;
    const v = {} as Record<FieldKey, Values[FieldKey]>;
    FIELD_ORDER.forEach((k) => (v[k] = detail.fields[k].value));
    setValues(v as Values);
    setProgress(progressOf(detail.status));
    setDraft(null);
  }

  async function handleSave() {
    if (!detail || !values) return;
    if (progress === '검토 대기') {
      // 확정(confirm) 말고는 상태를 쓸 API가 없어서 `검토 대기`로 되돌릴 방법이 없다.
      pushToast('검토 대기로는 저장할 수 없습니다 · 진행 중 또는 완료를 선택해 주세요');
      return;
    }
    setSaving(true);
    const reviewSec = Math.max(1, Math.floor((Date.now() - enterTime.current) / 1000));
    const newFields = {} as Record<FieldKey, CallFields[FieldKey]>;
    FIELD_ORDER.forEach((k) => {
      newFields[k] = { ...detail.fields[k], value: values[k] } as CallFields[FieldKey];
    });
    const followupNeeded = progress === '진행 중';
    try {
      const saved = await approveCall(detail.callId, {
        fields: { ...(newFields as CallFields), followup: { ...detail.fields.followup, value: followupNeeded } },
        editedFields: FIELD_ORDER.filter(
          (k) => JSON.stringify(values[k]) !== JSON.stringify(detail.fields[k].value),
        ),
        reviewSec,
        followupNeeded,
      });
      setDetail(saved);
      onSaved?.(saved);
      pushToast(`${fmtCallSeq(detail)} 저장됨 · ${progress}`);
    } catch (err) {
      // 재확정 차단(409)은 "다시 시도"로 풀리지 않는다 — 백엔드가 콜당 1회만 확정을
      // 허용하기 때문(ReviewConfirmService). 원인을 그대로 알려준다.
      pushToast(
        err instanceof ApiError && err.code === 'REVIEW_ALREADY_CONFIRMED'
          ? '이미 확정된 상담입니다 · 진행 상황을 다시 바꾸려면 백엔드 재확정 지원이 필요합니다'
          : '저장에 실패했습니다 · 다시 시도해 주세요',
      );
    }
    setSaving(false);
  }

  const evidenceIds = evidencePop && detail ? detail.fields[evidencePop].evidence : [];
  const evidenceLabel = evidencePop
    ? `${CLASS_ROWS.find((r) => r.key === evidencePop)?.label} · ${displayOf(evidencePop)}`
    : '';

  if (!detail || !values) {
    return (
      <section className="cw-detail empty">
        <div className="cw-blank">{callId ? '상담 내용을 불러오는 중…' : emptyText}</div>
      </section>
    );
  }

  return (
    <>
      <div className="cw-detail" ref={paneRef}>
        {/* 민원인 정보 (h 62) */}
        <section className="cw-panel cw-person">
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>민원인 정보</h2>
          </div>
          <div className="cw-prow">
            <div className="cw-plabel">이름</div>
            <div className="cw-pvalue name">
              {detail.complainant?.name || <span className="cw-empty">{NO_DATA}</span>}
            </div>
            <div className="cw-plabel">전화번호</div>
            <div className="cw-pvalue tel">
              {detail.complainant?.phone || <span className="cw-empty">{NO_DATA}</span>}
            </div>
            <div className="cw-plabel">소속</div>
            <div className="cw-pvalue org">
              {detail.complainant?.org || <span className="cw-empty">{NO_DATA}</span>}
            </div>
            <div className="cw-plabel">상담 이력</div>
            <div className="cw-pvalue hist">
              {detail.complainant?.gradeCounts ? (
                <GradeHistory counts={detail.complainant.gradeCounts} />
              ) : (
                <span className="cw-empty">이력 정보 없음</span>
              )}
            </div>
          </div>
        </section>

        {/* 전사문 */}
        <TranscriptBlock
          key={detail.callId}
          ref={transcriptRef}
          transcript={detail.transcript}
          audioUrl={detail.audioUrl ?? null}
          durationSec={detail.durationSec}
        />

        {/* 요약 · 분류 */}
        <div className="cw-mid">
          <section className="cw-panel cw-summary" ref={summaryRef}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>요약</h2>
            </div>
            <div className="cw-srow title">
              <div className="cw-slabel">제목</div>
              <div className="cw-sval">
                <input value={summary.title} onChange={(e) => patchSummary({ title: e.target.value })} />
              </div>
            </div>
            <div className="cw-srow grow">
              <div className="cw-slabel">민원 내용</div>
              <div className="cw-sval">
                <textarea value={summary.inquiry} onChange={(e) => patchSummary({ inquiry: e.target.value })} />
              </div>
            </div>
            <div className="cw-srow grow">
              <div className="cw-slabel">처리 내용</div>
              <div className="cw-sval">
                <textarea value={summary.resolution} onChange={(e) => patchSummary({ resolution: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="cw-panel cw-classify">
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>분류 · 등급</h2>
            </div>
            <div className="cw-crows">
              {CLASS_ROWS.map(({ key, label }) => (
                <div className="cw-crow" key={key}>
                  <div className="cw-clabel">{label}</div>
                  <div className="cw-cval">
                    <button
                      className={`cw-select ${selectPop === key ? 'on' : ''}`}
                      onClick={(e) => {
                        if (selectPop === key) {
                          setSelectPop(null);
                          return;
                        }
                        setSelectRect(anchorRectOf(e.currentTarget));
                        setSelectPop(key);
                      }}
                    >
                      <span className={displayOf(key) ? '' : 'cw-empty'}>{displayOf(key) || '선택 필요'}</span>
                      <Caret />
                    </button>

                    <button
                      className="cw-evbtn"
                      disabled={detail.fields[key].evidence.length === 0}
                      title={detail.fields[key].evidence.length === 0 ? '근거 발화가 없습니다' : undefined}
                      onClick={() => openEvidence(key)}
                    >
                      근거 발화
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 후속 처리 */}
        <section className="cw-panel cw-followup">
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>후속 처리</h2>
            <span className="cw-sub">{notes.length}건</span>
            <span className="cw-rule" />
            <button
              className="cw-btn"
              style={{ width: 56, padding: 0 }}
              onClick={() => setDraft('')}
              disabled={draft !== null}
            >
              + 추가
            </button>
          </div>
          <div className="cw-flist">
            {draft === null && notes.length === 0 ? (
              <div className="cw-fempty">등록된 후속 처리가 없습니다.</div>
            ) : (
              <>
                {draft !== null && (
                  <div className="cw-frow new">
                    <span className="cw-fdate">{fmtStamp(new Date())}</span>
                    <span className="cw-fbody">
                      <input
                        autoFocus
                        value={draft}
                        placeholder="후속 처리 내용을 입력하세요"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitDraft();
                          if (e.key === 'Escape') setDraft(null);
                        }}
                        onBlur={() => void commitDraft()}
                      />
                    </span>
                    <span className="cw-fwho">{counselor?.name ?? ''}</span>
                  </div>
                )}
                {notes.map((n) => (
                  <div className="cw-frow" key={n.id}>
                    <span className="cw-fdate">{fmtStamp(new Date(n.createdAt))}</span>
                    <span className="cw-fbody">
                      <span className="cw-ftext">{n.content}</span>
                    </span>
                    <span className="cw-fwho">{n.counselorName}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* 액션바 */}
        <div className="cw-actions">
          <span className="cw-lab">진행 상황</span>
          <div className="cw-seg">
            {PROGRESS_STEPS.map((p) => (
              <button key={p} className={progress === p ? 'on' : ''} onClick={() => setProgress(p)}>
                {p}
              </button>
            ))}
          </div>
          <span className="cw-rule" />
          <button className="cw-abtn" onClick={resetEdits} disabled={saving}>취소</button>
          <button className="cw-abtn primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>

      {/* 분류·등급 드롭다운 — 패널 overflow에 갇히지 않게 화면 기준으로 띄운다 */}
      {selectPop && selectRect && (
        <AnchoredMenu
          rect={selectRect}
          options={optionsFor(selectPop)}
          value={displayOf(selectPop)}
          onPick={(opt) => pickOption(selectPop, opt)}
          onClose={() => setSelectPop(null)}
        />
      )}

      {/* 근거 발화 팝업 — 드래그로 옮길 수 있고, 옮긴 자리를 기억한다.
          바깥 클릭으로 닫지 않는다: 근거를 여러 개 눌러가며 확인해야 하므로. */}
      {evidencePop && evPos && (
        <DragPopover pos={evPos} onMove={moveEvidence} className="cw-ev-pop">
          <div className="cw-phead" data-drag>
            <i className="cw-tick" />
            <h2>근거 발화</h2>
            <span className="cw-sub">{evidenceLabel}</span>
            <span className="cw-rule" />
            <button className="x" onClick={() => setEvidencePop(null)} aria-label="닫기">✕</button>
          </div>
          <div className="cw-ev-body">
            {evidenceIds.length === 0 ? (
              <div className="cw-ev-none">근거 발화가 없습니다.</div>
            ) : (
              evidenceIds.map((id) => {
                const u = transcriptById.get(id);
                return (
                  <button
                    key={id}
                    className="cw-ev-utt"
                    onClick={() => transcriptRef.current?.scrollToUtterance(id)}
                  >
                    <span className={`cw-utt-who ${u?.speaker === 'client' ? 'client' : 'agent'}`}>
                      <span className="r">{u?.speaker === 'client' ? '민원인' : '상담사'}</span>
                      <span className="t">{id.toUpperCase()}</span>
                    </span>
                    <span className="cw-utt-text">{u?.text ?? '전사문에서 찾을 수 없는 발화입니다.'}</span>
                  </button>
                );
              })
            )}
          </div>
        </DragPopover>
      )}
    </>
  );
}
