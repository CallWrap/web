import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BackendFaqEntry } from '../../api/backendTypes';
import type { Call } from '../../api/types';
import {
  discardFaqEntry,
  getFaqEntries,
  publishFaqEntry,
  triggerFaqBatch,
  updateFaqEntry,
} from '../../api/api';
import { useCallStore } from '../../store/callStore';
import { useToastStore } from '../../store/toastStore';
import { NO_DATA, fmtCallSeq } from '../../lib/format';
import { CallDetailModal } from './CallDetailModal';

/* ─────────────────────────────────────────────────────────────
   FAQ 검수 (Figma 19 · 지침 6절).
   좌: 초안 목록 560 (상태 탭 + 초안 생성)
   우: 초안 정보 58 / 질문과 답변 214 / 근거 콜 166 / 관련 기존 FAQ / 처리 방식 44
   ───────────────────────────────────────────────────────────── */

const LIST_COLS = '110px 1fr 62px 68px';
const SRC_COLS = '104px 72px 1fr 96px';
const SIM_COLS = '64px 1fr 120px 72px 90px 160px';

type StatusKey = 'DRAFT' | 'PUBLISHED' | 'DISCARDED';
const STATUS_TABS: { key: StatusKey; label: string }[] = [
  { key: 'DRAFT', label: '검수 대기' },
  { key: 'PUBLISHED', label: '게시됨' },
  { key: 'DISCARDED', label: '반려됨' },
];
const STATUS_LABEL: Record<StatusKey, string> = { DRAFT: '검수 대기', PUBLISHED: '게시됨', DISCARDED: '반려됨' };
const STATUS_CLASS: Record<StatusKey, string> = { DRAFT: 'prog', PUBLISHED: 'done', DISCARDED: 'normal' };

/** 처리 방식 3택 — `FAQ 업데이트`는 merge-into API가 없어 아직 못 쓴다 */
type Action = '신규 등록' | 'FAQ 업데이트' | '추가 안 함';

export function FaqTab() {
  const fetchCall = useCallStore((s) => s.fetchCall);
  const pushToast = useToastStore((s) => s.push);

  const [tab, setTab] = useState<StatusKey>('DRAFT');
  const [entries, setEntries] = useState<Record<StatusKey, BackendFaqEntry[]>>({
    DRAFT: [], PUBLISHED: [], DISCARDED: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [action, setAction] = useState<Action>('신규 등록');
  const [busy, setBusy] = useState<'load' | 'batch' | 'save' | null>(null);
  const [sourceCalls, setSourceCalls] = useState<Call[]>([]);
  const [detailOf, setDetailOf] = useState<Call | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    try {
      const [d, p, x] = await Promise.all([
        getFaqEntries('DRAFT'),
        getFaqEntries('PUBLISHED'),
        getFaqEntries('DISCARDED'),
      ]);
      setEntries({ DRAFT: d, PUBLISHED: p, DISCARDED: x });
    } catch {
      pushToast('FAQ 초안을 불러오지 못했습니다');
    }
    setBusy(null);
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = entries[tab];
  const selected = useMemo(
    () => rows.find((e) => e.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // 탭을 바꾸면 그 탭의 첫 항목을 연다
  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!rows.some((e) => e.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    setQuestion(selected?.question ?? '');
    setAnswer(selected?.answer ?? '');
    setAction('신규 등록');
  }, [selected]);

  // 근거 콜은 id만 오므로 상담번호·민원인을 알려면 상세를 받아야 한다(보통 서너 건).
  useEffect(() => {
    const ids = selected?.sampleCallIds ?? [];
    if (ids.length === 0) {
      setSourceCalls([]);
      return;
    }
    let alive = true;
    Promise.all(ids.slice(0, 10).map((id) => fetchCall(id)))
      .then((cs) => {
        if (alive) setSourceCalls(cs.filter((c): c is Call => Boolean(c)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [selected, fetchCall]);

  async function generate() {
    setBusy('batch');
    try {
      const r = await triggerFaqBatch();
      pushToast(`초안 ${r.entriesCreated}건 생성됨 (소분류 ${r.groupsProcessed}개)`);
      await load();
    } catch {
      pushToast('초안 생성에 실패했습니다');
    }
    setBusy(null);
  }

  async function save() {
    if (!selected) return;
    setBusy('save');
    try {
      // 질문·답변 수정은 어느 처리 방식이든 먼저 반영한다
      if (question !== selected.question || answer !== selected.answer) {
        await updateFaqEntry(selected.id, question, answer);
      }
      if (action === '신규 등록') {
        await publishFaqEntry(selected.id);
        pushToast('FAQ로 게시했습니다');
      } else if (action === '추가 안 함') {
        await discardFaqEntry(selected.id);
        pushToast('초안을 반려했습니다');
      } else {
        pushToast('FAQ 업데이트는 백엔드 병합 API가 필요합니다 · 질문·답변 수정만 저장했습니다');
      }
      await load();
    } catch {
      pushToast('저장에 실패했습니다 · 다시 시도해 주세요');
    }
    setBusy(null);
  }

  function reset() {
    setQuestion(selected?.question ?? '');
    setAnswer(selected?.answer ?? '');
    setAction('신규 등록');
  }

  return (
    <div className="aw-body">
      <section className="cw-panel aw-list">
        <div className="cw-phead">
          <i className="cw-tick" />
          <h2>FAQ 초안</h2>
          <span className="cw-rule" />
          <div className="cw-seg" style={{ height: 22 }}>
            {STATUS_TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)} style={{ width: 76 }}>
                {t.label} {entries[t.key].length}
              </button>
            ))}
          </div>
          <button className="cw-btn" style={{ width: 68, padding: 0 }} onClick={generate} disabled={busy !== null}>
            {busy === 'batch' ? '생성 중…' : '초안 생성'}
          </button>
        </div>

        <div className="aw-thead" style={{ gridTemplateColumns: LIST_COLS }}>
          <span>소분류</span>
          <span>질문</span>
          <span>근거 콜</span>
          <span>생성일</span>
        </div>

        <div className="aw-tbody">
          {busy === 'load' ? (
            <div className="aw-blank">불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className="aw-blank">{STATUS_LABEL[tab]} 상태의 초안이 없습니다.</div>
          ) : (
            rows.map((e) => (
              <button
                key={e.id}
                className={`aw-row ${e.id === selectedId ? 'sel' : ''}`}
                style={{ gridTemplateColumns: LIST_COLS }}
                onClick={() => setSelectedId(e.id)}
              >
                <span>{e.subcategory}</span>
                <span className="l" style={{ fontWeight: e.id === selectedId ? 700 : 400 }}>{e.question}</span>
                <span><span className="cw-badge wait">{e.sourceCallCount}건</span></span>
                <span className="cw-muted">{e.generatedAt.slice(5, 10)}</span>
              </button>
            ))
          )}
        </div>

        <div className="aw-tfoot">총 {rows.length}건</div>
      </section>

      {!selected ? (
        <div className="aw-detail">
          <section className="cw-panel" style={{ flex: 1 }}>
            <div className="aw-blank">왼쪽에서 초안을 선택하세요.</div>
          </section>
        </div>
      ) : (
        <div className="aw-detail">
          <section className="cw-panel" style={{ height: 58, flex: 'none' }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>초안 정보</h2>
            </div>
            <div className="aw-inforow">
              <div className="aw-infolabel" style={{ width: 78 }}>소분류</div>
              <div className="aw-infoval" style={{ width: 150, flex: 'none' }}>{selected.subcategory}</div>
              <div className="aw-infolabel" style={{ width: 68 }}>상태</div>
              <div className="aw-infoval" style={{ width: 110, flex: 'none' }}>
                <span className={`cw-badge ${STATUS_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
              <div className="aw-infolabel" style={{ width: 78 }}>근거 콜</div>
              <div className="aw-infoval" style={{ width: 100, flex: 'none' }}>{selected.sourceCallCount}건</div>
              <div className="aw-infolabel" style={{ width: 78 }}>생성일</div>
              <div className="aw-infoval" style={{ flex: 1 }}>{selected.generatedAt.slice(0, 10)}</div>
            </div>
          </section>

          <section className="cw-panel" style={{ height: 214, flex: 'none' }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>질문과 답변</h2>
            </div>
            <div className="cw-srow title">
              <div className="cw-slabel">질문</div>
              <div className="cw-sval">
                <input value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
            </div>
            <div className="cw-srow grow">
              <div className="cw-slabel">답변</div>
              <div className="cw-sval">
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="cw-panel" style={{ height: 166, flex: 'none' }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>근거 콜</h2>
              <span className="cw-sub">{selected.sourceCallCount}건</span>
            </div>
            <div className="aw-thead" style={{ gridTemplateColumns: SRC_COLS }}>
              <span>상담번호</span>
              <span>민원인</span>
              <span className="l">발화</span>
              <span />
            </div>
            <div className="aw-tbody">
              {sourceCalls.length === 0 ? (
                <div className="aw-blank">
                  {(selected.sampleCallIds ?? []).length === 0
                    ? '근거 콜 ID가 응답에 없습니다.'
                    : '근거 콜을 불러오지 못했습니다.'}
                </div>
              ) : (
                sourceCalls.map((c) => (
                  <div className="aw-row" style={{ gridTemplateColumns: SRC_COLS }} key={c.callId}>
                    <span className="aw-no">{fmtCallSeq(c)}</span>
                    <span className={c.complainant?.name ? '' : 'cw-muted'}>{c.complainant?.name || NO_DATA}</span>
                    {/* 어느 발화가 이 초안의 근거인지는 응답에 없다 — 콜 단위로만 온다 */}
                    <span className="l cw-muted">{NO_DATA}</span>
                    <span>
                      <button className="cw-btn" style={{ width: 84, padding: 0 }} onClick={() => setDetailOf(c)}>
                        전사문 보기
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="cw-panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="cw-phead">
              <i className="cw-tick" />
              <h2>관련 기존 FAQ</h2>
            </div>
            <div className="aw-thead" style={{ gridTemplateColumns: SIM_COLS }}>
              <span>유사도</span>
              <span className="l">등록된 질문</span>
              <span>소분류</span>
              <span>상태</span>
              <span>최종 수정</span>
              <span />
            </div>
            {/* 초안과 기존 FAQ의 유사도를 비교하는 API가 없다 */}
            <div className="aw-blank">유사도 대조 API가 없어 관련 FAQ를 찾을 수 없습니다.</div>
          </section>

          <div className="cw-actions">
            <span className="cw-lab">처리 방식</span>
            <div className="cw-seg">
              {(['신규 등록', 'FAQ 업데이트', '추가 안 함'] as Action[]).map((a) => (
                <button
                  key={a}
                  className={action === a ? 'on' : ''}
                  style={{ width: 96 }}
                  onClick={() => setAction(a)}
                  // 병합 대상 FAQ를 고를 수 없으니 업데이트도 고를 수 없다
                  disabled={a === 'FAQ 업데이트'}
                  title={a === 'FAQ 업데이트' ? '유사도 대조·병합 API가 필요합니다' : undefined}
                >
                  {a}
                </button>
              ))}
            </div>
            <span className="cw-rule" />
            <button className="cw-abtn" onClick={reset} disabled={busy !== null}>취소</button>
            <button className="cw-abtn primary" onClick={save} disabled={busy !== null}>
              {busy === 'save' ? '저장 중' : '저장'}
            </button>
          </div>
        </div>
      )}

      {detailOf && (
        <CallDetailModal
          callId={detailOf.callId}
          title={fmtCallSeq(detailOf)}
          onClose={() => setDetailOf(null)}
        />
      )}
    </div>
  );
}
