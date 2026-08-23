import { useEffect, useState } from 'react';
import type { BackendFaqEntry } from '../api/backendTypes';
import { discardFaqEntry, getFaqEntries, publishFaqEntry, triggerFaqBatch, updateFaqEntry } from '../api/api';
import { useToastStore } from '../store/toastStore';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'DISCARDED';

const STATUS_LABEL: Record<BackendFaqEntry['status'], string> = {
  DRAFT: '검수 대기',
  PUBLISHED: '게시됨',
  DISCARDED: '반려됨',
};

/** 근거 콜이 이 값 이상 누적된 FAQ는 "많이 문의된" 것으로 보고 배지로 추천 표시한다.
 * 목록 자체는 서버(GET /api/faq-entries)가 이미 sourceCallCount 내림차순으로 정렬해서 주므로,
 * 여기서는 그중 어디까지가 "추천"인지 시각적으로 구분만 한다. */
const RECOMMEND_THRESHOLD = 5;

/**
 * EXAONE이 needs_faq=true로 쌓인 콜을 소분류별로 합성한 FAQ 초안 검수 화면.
 * DRAFT는 반드시 사람이 승인해야 PUBLISHED가 된다 — TriageForm의 "AI 확신도 낮으면
 * 사람이 확인" 원칙과 같은 이유로, LLM이 지어낸 답변이 검증 없이 나가면 안 되기 때문.
 */
export function FaqReviewPanel() {
  const [entries, setEntries] = useState<BackendFaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('DRAFT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);

  async function reload() {
    setLoading(true);
    try {
      const status = filter === 'ALL' ? undefined : filter;
      setEntries(await getFaqEntries(status));
    } catch {
      pushToast('FAQ 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await triggerFaqBatch();
      pushToast(`FAQ 생성 완료 · 소분류 ${result.groupsProcessed}건 처리 · ${result.entriesCreated}건 생성`);
      await reload();
    } catch {
      pushToast('FAQ 배치 생성에 실패했습니다 · FastAPI(api 서비스) 상태를 확인해 주세요');
    } finally {
      setGenerating(false);
    }
  }

  function startEdit(entry: BackendFaqEntry) {
    setEditingId(entry.id);
    setDraftQuestion(entry.question);
    setDraftAnswer(entry.answer);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const updated = await updateFaqEntry(id, draftQuestion, draftAnswer);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingId(null);
      pushToast('수정 사항을 저장했습니다');
    } catch {
      pushToast('저장에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePublish(id: string) {
    setBusyId(id);
    try {
      const updated = await publishFaqEntry(id);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      pushToast('FAQ를 게시했습니다');
    } catch {
      pushToast('게시에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDiscard(entry: BackendFaqEntry) {
    // 이미 게시된 글에 이 버튼을 누르면 "반려"가 아니라 "게시 취소"다 — 검수 전 초안을
    // 거절하는 것과 지식베이스에 이미 나가 있는 걸 내리는 건 결과가 다르니 문구도 갈라야 한다.
    const isRetract = entry.status === 'PUBLISHED';
    setBusyId(entry.id);
    try {
      const updated = await discardFaqEntry(entry.id);
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
      pushToast(isRetract ? 'FAQ 게시를 취소했습니다' : 'FAQ 초안을 반려했습니다');
    } catch {
      pushToast(isRetract ? '게시 취소에 실패했습니다' : '반려 처리에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  }

  const draftCount = entries.filter((e) => e.status === 'DRAFT').length;

  return (
    <>
      <div className="dense-head">
        <h2>FAQ 검수</h2>
        <p>
          needs_faq=true로 쌓인 콜을 소분류별로 모아 EXAONE이 합성한 초안입니다. 검증 없이 지식베이스에
          바로 올라가지 않도록 <strong>승인(PUBLISHED) 전까지는 초안일 뿐</strong>입니다.
        </p>
      </div>

      <div className="ledger-toolbar">
        <div className="admin-tabs" style={{ marginBottom: 0 }}>
          {(['DRAFT', 'PUBLISHED', 'DISCARDED', 'ALL'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              className={`admin-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'ALL' ? '전체' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <button className="btn primary sm" onClick={handleGenerate} disabled={generating}>
          {generating ? '생성 중… (수십 초 걸릴 수 있음)' : 'FAQ 배치 생성'}
        </button>
      </div>

      {filter === 'DRAFT' && draftCount > 0 && (
        <div className="info-note">
          <span>ℹ</span>
          <span>검수 대기 중인 초안 {draftCount}건 — 승인해야 지식베이스에 실제로 노출됩니다.</span>
        </div>
      )}

      {loading ? (
        <div className="empty">
          <div className="spinner" style={{ width: 20, height: 20 }} />
          <p>불러오는 중…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty">
          <h3>표시할 FAQ가 없습니다</h3>
          <p>
            {filter === 'DRAFT'
              ? '오른쪽 위 "FAQ 배치 생성"을 눌러 needs_faq 후보로 초안을 만들어 보세요.'
              : '다른 상태 필터를 선택해 보세요.'}
          </p>
        </div>
      ) : (
        <div className="ledger">
          {entries.map((entry) => {
            const isEditing = editingId === entry.id;
            const busy = busyId === entry.id;
            return (
              <div key={entry.id} className="ledger-item">
                <div className="ledger-detail" style={{ display: 'block' }}>
                  <div className="fhead" style={{ marginBottom: 8 }}>
                    <span className="tier-badge medium">{entry.subcategory}</span>
                    <span className={`tier-badge ${entry.status === 'PUBLISHED' ? 'high' : entry.status === 'DISCARDED' ? 'low' : 'medium'}`}>
                      {STATUS_LABEL[entry.status]}
                    </span>
                    <span className="hint">근거 콜 {entry.sourceCallCount}건</span>
                    {entry.sourceCallCount >= RECOMMEND_THRESHOLD && (
                      <span className="tier-badge high" title={`근거 콜 ${RECOMMEND_THRESHOLD}건 이상 누적 — 우선 검수 추천`}>
                        추천
                      </span>
                    )}
                    <span className="spacer" />
                    <span className="hint">
                      {entry.status === 'PUBLISHED' && entry.publishedAt
                        ? `게시 ${new Date(entry.publishedAt).toLocaleString('ko-KR')}`
                        : `생성 ${new Date(entry.generatedAt).toLocaleString('ko-KR')}`}
                    </span>
                  </div>

                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={draftQuestion}
                        onChange={(e) => setDraftQuestion(e.target.value)}
                        style={{ width: '100%', marginBottom: 8, fontWeight: 600 }}
                      />
                      <textarea
                        rows={4}
                        value={draftAnswer}
                        onChange={(e) => setDraftAnswer(e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <div className="floating-toolbar" style={{ position: 'static', marginTop: 10, boxShadow: 'none', padding: 0 }}>
                        <button className="btn ghost sm" onClick={cancelEdit} disabled={busy}>
                          취소
                        </button>
                        <button className="btn primary sm" onClick={() => saveEdit(entry.id)} disabled={busy}>
                          저장
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ fontWeight: 600, marginBottom: 6 }}>Q. {entry.question}</p>
                      <p style={{ color: 'var(--text-2)' }}>A. {entry.answer}</p>
                    </>
                  )}

                  {/* DISCARDED는 되돌릴 API가 없어 액션을 안 보여준다. DRAFT/PUBLISHED는 둘 다
                      "수정"이 가능하고(백엔드가 상태로 막지 않음), 나머지 한 버튼만 상태에 따라
                      갈린다 — 검수 전 초안 거절(반려) vs 이미 나간 글 내리기(게시 취소). */}
                  {!isEditing && entry.status !== 'DISCARDED' && (
                    <div className="floating-toolbar" style={{ position: 'static', marginTop: 12, boxShadow: 'none', padding: 0 }}>
                      <button className="btn ghost sm" onClick={() => startEdit(entry)} disabled={busy}>
                        수정
                      </button>
                      <button className="btn ghost sm" onClick={() => handleDiscard(entry)} disabled={busy}>
                        {busy ? '처리 중…' : entry.status === 'PUBLISHED' ? '게시 취소' : '반려'}
                      </button>
                      {entry.status === 'DRAFT' && (
                        <button className="btn primary sm" onClick={() => handlePublish(entry.id)} disabled={busy}>
                          {busy ? '처리 중…' : '승인'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
