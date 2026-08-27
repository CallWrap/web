import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Call, CallFields, CallStatus, FieldKey, SummaryValue, Utterance } from '../api/types';
import { ApiError } from '../api/http';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useReviewStream } from '../hooks/useReviewStream';
import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_GRADES,
  CONSULTATION_TYPES,
  getSubcategoryOptions,
  normalizeSubcategoryForCategory,
} from '../lib/classificationOptions';
import { FIELD_ORDER, type Values } from './ReviewPage';
import { LogoMark } from '../components/icons';
import { TranscriptBlock, type TranscriptHandle } from '../components/counselor/TranscriptBlock';
import {
  CalendarIcon,
  CalendarPop,
  Caret,
  DragPopover,
  Menu,
  Popover,
  ProgressBadge,
  progressClass,
  PROGRESS_STEPS,
  toISODate,
  type PopPos,
  type Progress,
} from '../components/counselor/CounselorBits';
import '../styles.counselor.css';

/* ─────────────────────────────────────────────────────────────
   상담사 통합 검토 화면 — Figma "14 상담사 통합 검토 화면 / 15 오버레이 동작".
   기존 /queue(검토 대기열)와 /review/:id(콜 검토)를 한 화면으로 합쳤다.
   좌측 목록에서 콜을 고르면 우측이 그 콜의 내용으로 채워진다.
   ───────────────────────────────────────────────────────────── */

/** 백엔드가 아직 안 주는 값. 지어내지 않고 비어 있다는 사실을 그대로 보여준다. */
const NO_DATA = '정보 없음';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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

/** 후속 처리 이력 한 건. 백엔드에 저장 경로가 없어 화면 안에서만 산다. */
interface Memo {
  id: string;
  at: string; // MM-DD HH:mm
  text: string;
  who: string;
  fresh: boolean; // true면 입력칸, false면 글자만
}

/**
 * DB CallStatus → 화면의 진행 상황 3단계.
 * `진행 중`은 DB에 없는 상태라 기존 CONFIRMED+needsFollowup(= web의 followup)을 그대로 쓴다
 * (지침 9절·16 설계 노트의 미결 항목 중 "기존 FOLLOWUP 재사용" 쪽).
 */
function progressOf(status: CallStatus): Progress {
  if (status === 'confirmed') return '완료';
  if (status === 'followup') return '진행 중';
  return '검토 대기';
}

/** 목록에 찍는 상담번호. Figma 표기(2026-0273) 그대로 — 접수 순번에 연도를 붙인다. */
function callSeq(call: Call): string {
  if (call.callNo == null) return NO_DATA;
  const year = (call.startedAt ?? call.confirmedAt ?? '').slice(0, 4) || `${new Date().getFullYear()}`;
  return `${year}-${`${call.callNo}`.padStart(4, '0')}`;
}

function todayISO(): string {
  return toISODate(new Date());
}

function monthStartISO(): string {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function stamp(d: Date): string {
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CounselorPage() {
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();

  const calls = useCallStore((s) => s.calls);
  const loaded = useCallStore((s) => s.loaded);
  const loadError = useCallStore((s) => s.loadError);
  const loadQueue = useCallStore((s) => s.loadQueue);
  const fetchCall = useCallStore((s) => s.fetchCall);
  const approveCall = useCallStore((s) => s.approveCall);
  const counselor = useAuthStore((s) => s.counselor);
  const logout = useAuthStore((s) => s.logout);
  const pushToast = useToastStore((s) => s.push);

  useReviewStream();

  // ── 목록 조건 ──────────────────────────────────────────
  // 기간은 `조회`를 눌러야 반영된다. 상태 필터는 고르는 즉시 걸린다(지침 4절).
  const [draftFrom, setDraftFrom] = useState(monthStartISO);
  const [draftTo, setDraftTo] = useState(todayISO);
  const [range, setRange] = useState(() => ({ from: monthStartISO(), to: todayISO() }));
  const [statusFilter, setStatusFilter] = useState<'전체' | Progress>('전체');

  // ── 오버레이 4종 ───────────────────────────────────────
  const [datePop, setDatePop] = useState<'from' | 'to' | null>(null);
  const [filterPop, setFilterPop] = useState(false);
  const [selectPop, setSelectPop] = useState<FieldKey | null>(null);
  const [evidencePop, setEvidencePop] = useState<FieldKey | null>(null);

  // ── 선택된 콜 ──────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(routeCallId ?? null);
  const [detail, setDetail] = useState<Call | undefined>();
  const [values, setValues] = useState<Values | null>(null);
  const [progress, setProgress] = useState<Progress>('검토 대기');
  const [memos, setMemos] = useState<Memo[]>([]);
  const [saving, setSaving] = useState(false);
  const enterTime = useRef(Date.now());

  const transcriptRef = useRef<TranscriptHandle | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const [evPos, setEvPos] = useState<PopPos | null>(readEvPos);

  /** 기본 자리 — 목록과 요약에 반반 걸치게. 옮긴 적이 있으면 그 자리를 그대로 쓴다. */
  function openEvidence(key: FieldKey) {
    if (evidencePop === key) {
      setEvidencePop(null);
      return;
    }
    if (!evPos) {
      const list = listRef.current?.getBoundingClientRect();
      const sum = summaryRef.current?.getBoundingClientRect();
      setEvPos({
        x: Math.round((list ? list.right : 572) - 220), // 폭 440의 절반만큼 왼쪽으로
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

  const today = useMemo(() => {
    const d = new Date();
    return `${toISODate(d)} (${WEEKDAYS[d.getDay()]})`;
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // ── 목록 필터링 ────────────────────────────────────────
  const rows = useMemo(() => {
    return calls.filter((c) => {
      if (statusFilter !== '전체' && progressOf(c.status) !== statusFilter) return false;
      // 시작 시각이 없는 콜은 기간으로 판단할 수 없어 걸러내지 않는다.
      const day = c.startedAt?.slice(0, 10);
      if (day && (day < range.from || day > range.to)) return false;
      return true;
    });
  }, [calls, statusFilter, range]);

  // 첫 진입 시 목록의 첫 콜을 자동으로 연다 — 우측이 빈 채로 남지 않게.
  useEffect(() => {
    if (selectedId || rows.length === 0) return;
    setSelectedId(rows[0].callId);
  }, [rows, selectedId]);

  // ── 선택된 콜 상세 로드 ────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDetail(undefined);
    setValues(null);
    setSaving(false);
    fetchCall(selectedId).then((c) => {
      if (!alive) return;
      setDetail(c);
      if (c) {
        const v = {} as Record<FieldKey, Values[FieldKey]>;
        FIELD_ORDER.forEach((k) => (v[k] = c.fields[k].value));
        setValues(v as Values);
        setProgress(progressOf(c.status));
        setMemos([]);
        enterTime.current = Date.now();
      }
    });
    return () => {
      alive = false;
    };
  }, [selectedId, fetchCall]);

  const counters = useMemo(() => {
    const c: Record<Progress, number> = { '검토 대기': 0, '진행 중': 0, 완료: 0 };
    calls.forEach((call) => (c[progressOf(call.status)] += 1));
    return c;
  }, [calls]);

  const transcriptById = useMemo(() => {
    const m = new Map<string, Utterance>();
    detail?.transcript.forEach((u) => m.set(u.id, u));
    return m;
  }, [detail]);

  // ── 편집 ───────────────────────────────────────────────
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

  // ── 후속 처리 ──────────────────────────────────────────
  function addMemo() {
    setMemos((prev) => [
      { id: `m${Date.now()}`, at: stamp(new Date()), text: '', who: counselor?.name ?? '', fresh: true },
      // 기존 최신 건은 지난 건 형식으로 내려간다
      ...prev.map((m) => ({ ...m, fresh: false })),
    ]);
  }

  // ── 저장 / 취소 ────────────────────────────────────────
  function resetEdits() {
    if (!detail) return;
    const v = {} as Record<FieldKey, Values[FieldKey]>;
    FIELD_ORDER.forEach((k) => (v[k] = detail.fields[k].value));
    setValues(v as Values);
    setProgress(progressOf(detail.status));
    setMemos([]);
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
      setMemos((prev) => prev.map((m) => ({ ...m, fresh: false })));
      pushToast(`${callSeq(detail)} 저장됨 · ${progress}`);
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

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const evidenceIds = evidencePop && detail ? detail.fields[evidencePop].evidence : [];
  const evidenceLabel = evidencePop
    ? `${CLASS_ROWS.find((r) => r.key === evidencePop)?.label} · ${displayOf(evidencePop)}`
    : '';

  return (
    <div className="cw">
      {/* ── 상단바 (h 44) ───────────────────────────────── */}
      <header className="cw-top">
        <div className="cw-brand">
          <LogoMark size={26} />
          <span>CallWrap</span>
        </div>

        <div className="cw-status">
          <h1>오늘의 현황</h1>
          <span className="cw-date">{today}</span>
          <i className="cw-vline" />
          {PROGRESS_STEPS.map((p) => (
            <span key={p} className={`cw-count ${progressClass(p)}`}>
              {p} <b>{counters[p]}</b> 건
            </span>
          ))}
        </div>

        <div className="cw-user">
          <div className="cw-who">
            <b>{counselor?.name ?? NO_DATA}</b>
            <span>{counselor?.role === 'ADMIN' ? '관리자' : '상담사'}</span>
          </div>
          <button className="cw-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <div className="cw-body">
        {/* ── 좌측 목록 (w 560) ─────────────────────────── */}
        <section className="cw-panel cw-list" ref={listRef}>
          <div className="cw-phead">
            <i className="cw-tick" />
            <h2>목록</h2>
            <span className="cw-rule" />

            <div className="cw-range">
              <span className="cw-anchor">
                <button
                  className={`cw-datebtn ${datePop === 'from' ? 'on' : ''}`}
                  onClick={() => setDatePop(datePop === 'from' ? null : 'from')}
                >
                  {draftFrom}
                  <CalendarIcon />
                </button>
                {datePop === 'from' && (
                  <Popover onClose={() => setDatePop(null)}>
                    <CalendarPop
                      value={draftFrom}
                      from={draftFrom}
                      to={draftTo}
                      onPick={setDraftFrom}
                      onApply={() => setDatePop(null)}
                    />
                  </Popover>
                )}
              </span>

              <span className="cw-tilde">~</span>

              <span className="cw-anchor">
                <button
                  className={`cw-datebtn ${datePop === 'to' ? 'on' : ''}`}
                  onClick={() => setDatePop(datePop === 'to' ? null : 'to')}
                >
                  {draftTo}
                  <CalendarIcon />
                </button>
                {datePop === 'to' && (
                  <Popover onClose={() => setDatePop(null)} align="right">
                    <CalendarPop
                      value={draftTo}
                      from={draftFrom}
                      to={draftTo}
                      onPick={setDraftTo}
                      onApply={() => setDatePop(null)}
                    />
                  </Popover>
                )}
              </span>
            </div>

            <button
              className="cw-btn primary"
              style={{ width: 48, padding: 0 }}
              onClick={() => setRange({ from: draftFrom, to: draftTo })}
            >
              조회
            </button>

            <span className="cw-anchor">
              <button className={`cw-filter ${filterPop ? 'on' : ''}`} onClick={() => setFilterPop((v) => !v)}>
                {statusFilter}
                <Caret />
              </button>
              {filterPop && (
                <Popover onClose={() => setFilterPop(false)} align="right" className="cw-filter-pop">
                  <Menu
                    options={['전체', ...PROGRESS_STEPS] as const}
                    value={statusFilter}
                    onPick={(v) => {
                      setStatusFilter(v);
                      setFilterPop(false);
                    }}
                  />
                </Popover>
              )}
            </span>
          </div>

          <div className="cw-thead">
            <span>상담번호</span>
            <span>민원인</span>
            <span>소속</span>
            <span>전화번호</span>
            <span>상태</span>
          </div>

          <div className="cw-tbody">
            {loadError ? (
              <div className="cw-blank">목록을 불러오지 못했습니다 · {loadError}</div>
            ) : !loaded ? (
              <div className="cw-blank">목록을 불러오는 중…</div>
            ) : rows.length === 0 ? (
              <div className="cw-blank">조건에 맞는 상담이 없습니다.</div>
            ) : (
              rows.map((c) => (
                <button
                  key={c.callId}
                  className={`cw-row ${c.callId === selectedId ? 'sel' : ''}`}
                  onClick={() => setSelectedId(c.callId)}
                >
                  <span>{callSeq(c)}</span>
                  <span className="cw-muted">{NO_DATA}</span>
                  <span className="cw-muted">{NO_DATA}</span>
                  <span className="cw-muted">{NO_DATA}</span>
                  <span><ProgressBadge value={progressOf(c.status)} /></span>
                </button>
              ))
            )}
          </div>

          <div className="cw-tfoot">
            <span className="cw-rule" />
            <span>총 {calls.length}건 중 1-{rows.length}</span>
          </div>
        </section>

        {/* ── 우측 상세 ─────────────────────────────────── */}
        {!detail || !values ? (
          <section className="cw-detail empty">
            <div className="cw-blank">{selectedId ? '상담 내용을 불러오는 중…' : '왼쪽 목록에서 상담을 선택하세요.'}</div>
          </section>
        ) : (
          <div className="cw-detail">
            {/* 민원인 정보 (h 62) */}
            <section className="cw-panel cw-person">
              <div className="cw-phead">
                <i className="cw-tick" />
                <h2>민원인 정보</h2>
              </div>
              <div className="cw-prow">
                <div className="cw-plabel">이름</div>
                <div className="cw-pvalue name"><span className="cw-empty">{NO_DATA}</span></div>
                <div className="cw-plabel">전화번호</div>
                <div className="cw-pvalue tel"><span className="cw-empty">{NO_DATA}</span></div>
                <div className="cw-plabel">소속</div>
                <div className="cw-pvalue org"><span className="cw-empty">{NO_DATA}</span></div>
                <div className="cw-plabel">상담 이력</div>
                <div className="cw-pvalue hist"><span className="cw-empty">이력 정보 없음</span></div>
              </div>
            </section>

            {/* 전사문 (h 268) */}
            <TranscriptBlock
              key={detail.callId}
              ref={transcriptRef}
              transcript={detail.transcript}
              audioUrl={detail.audioUrl ?? null}
              durationSec={detail.durationSec}
            />

            {/* 요약 · 분류 (h 268) */}
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
                        <span className="cw-anchor" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                          <button
                            className={`cw-select ${selectPop === key ? 'on' : ''}`}
                            onClick={() => setSelectPop(selectPop === key ? null : key)}
                          >
                            <span className={displayOf(key) ? '' : 'cw-empty'}>{displayOf(key) || '선택 필요'}</span>
                            <Caret />
                          </button>
                          {selectPop === key && (
                            <Popover onClose={() => setSelectPop(null)} className="cw-select-pop">
                              <Menu
                                options={optionsFor(key)}
                                value={displayOf(key)}
                                onPick={(opt) => pickOption(key, opt)}
                              />
                            </Popover>
                          )}
                        </span>

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

            {/* 후속 처리 (h 150) */}
            <section className="cw-panel cw-followup">
              <div className="cw-phead">
                <i className="cw-tick" />
                <h2>후속 처리</h2>
                <span className="cw-sub">{memos.length}건</span>
                <span className="cw-rule" />
                <button className="cw-btn" style={{ width: 56, padding: 0 }} onClick={addMemo}>+ 추가</button>
              </div>
              <div className="cw-flist">
                {memos.length === 0 ? (
                  <div className="cw-fempty">등록된 후속 처리가 없습니다.</div>
                ) : (
                  memos.map((m) => (
                    <div className={`cw-frow ${m.fresh ? 'new' : ''}`} key={m.id}>
                      <span className="cw-fdate">{m.at}</span>
                      <span className="cw-fbody">
                        {m.fresh ? (
                          <input
                            autoFocus
                            value={m.text}
                            placeholder="후속 처리 내용을 입력하세요"
                            onChange={(e) =>
                              setMemos((prev) => prev.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))
                            }
                          />
                        ) : (
                          <span className="cw-ftext">{m.text}</span>
                        )}
                      </span>
                      <span className="cw-fwho">{m.who}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 액션바 (h 44) */}
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
        )}
      </div>

      {/* 근거 발화 팝업 — 드래그로 옮길 수 있고, 옮긴 자리를 기억한다.
          바깥 클릭으로 닫지 않는다: 근거를 여러 개 눌러가며 확인해야 하므로. */}
      {evidencePop && detail && evPos && (
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
                    <span className="cw-utt-who">
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
    </div>
  );
}
