import { useState } from 'react';
import type { CallFields, FieldKey, SummaryValue, Tier } from '../api/types';
import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_TYPES,
  getSubcategoryOptions,
  normalizeSubcategoryForCategory,
} from '../lib/classificationOptions';
import { fieldLabel, tierLabel } from '../lib/format';
import { type Values } from '../pages/ReviewPage';

interface Props {
  fields: CallFields;
  values: Values;
  editedKeys: FieldKey[];
  failures: string[];
  onChange: (key: FieldKey, value: Values[FieldKey]) => void;
  onEvidenceClick: (uttId: string) => void;
}

const tierIcon: Record<Tier, string> = { high: '✓', medium: '◈', low: '✎' };
const TIER_RANK: Record<Tier, number> = { high: 2, medium: 1, low: 0 };
const CLASSIFY_KEYS: FieldKey[] = ['type', 'category', 'subcategory'];
type ClassifyStep = 1 | 2 | 3;

function worstTier(a: Tier, b: Tier, c: Tier): Tier {
  return [a, b, c].reduce((worst, t) => (TIER_RANK[t] < TIER_RANK[worst] ? t : worst));
}

// textarea가 담긴 내용 길이에 맞춰 자동으로 늘어나게 한다. 글자수로 줄 수를 어림하면
// (특히 한글은) 실제 줄바꿈보다 적게 잡혀 내용이 잘려 보인다 — 실제 렌더 높이
// (scrollHeight)를 그대로 읽어와 맞춘다.
function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function AiNote({ text }: { text: string }) {
  return (
    <div className="ai-note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export function TriageForm({ fields, values, editedKeys, onChange, onEvidenceClick }: Props) {
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [step, setStep] = useState<ClassifyStep>(1);

  const classifyTier = worstTier(fields.type.tier, fields.category.tier, fields.subcategory.tier);
  const classifyEdited = CLASSIFY_KEYS.some((k) => editedKeys.includes(k));
  const classifyEvidence = Array.from(
    new Set([...fields.type.evidence, ...fields.category.evidence, ...fields.subcategory.evidence]),
  );
  const subcategoryOptions = getSubcategoryOptions(String(values.category));

  function openClassify() {
    setClassifyOpen(true);
    setStep(1);
  }

  // 세 분류는 서로 독립적으로 고른다 — 하나 골랐다고 다음 탭으로 자동으로 넘어가지 않는다.
  function changeType(type: string) {
    onChange('type', type);
  }

  function changeCategory(category: string) {
    const nextSubcategory = normalizeSubcategoryForCategory(category, String(values.subcategory));
    onChange('category', category);
    onChange('subcategory', nextSubcategory || getSubcategoryOptions(category)[0] || '');
  }

  function changeSubcategory(subcategory: string) {
    onChange('subcategory', subcategory);
  }

  const s = values.summary as SummaryValue;
  function patchSummary(part: Partial<SummaryValue>) {
    onChange('summary', { ...s, ...part });
  }

  return (
    <div className="form-list">
      {/* ── 상담분류: 유형 → 중분류 → 소분류 단계 위저드 ── */}
      <div className={`field tier-${classifyTier}`}>
        <div className="fhead">
          <span className="flabel">상담분류</span>
          <span className={`tier-badge ${classifyTier}`}>
            {tierIcon[classifyTier]} {tierLabel[classifyTier]}
          </span>
          <span className="spacer" />
          {classifyEdited && <span className="edited-tag">수정됨</span>}
          {classifyOpen ? (
            <button className="toggle" onClick={() => setClassifyOpen(false)}>접기 ▴</button>
          ) : (
            <button className="classify-edit-btn" onClick={openClassify}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              수정하기
            </button>
          )}
        </div>
        <div className="fbody">
          {!classifyOpen ? (
            <>
              {classifyTier !== 'high' && (
                <AiNote text="AI가 예측한 분류예요. 정확하지 않다면 수정해 주세요." />
              )}
              <div className="classify-chips">
                <div className="classify-chip"><span className="k">유형</span><span className="v">{String(values.type) || '미선택'}</span></div>
                <div className="classify-chip"><span className="k">중분류</span><span className="v">{String(values.category) || '미선택'}</span></div>
                <div className="classify-chip"><span className="k">소분류</span><span className="v">{String(values.subcategory) || '미선택'}</span></div>
              </div>
              {classifyEvidence.length > 0 && (
                <div className="evidence-links">
                  <span className="ev-note">AI 판단 근거:</span>
                  {classifyEvidence.map((id) => (
                    <button key={id} className="ev-link" onClick={() => onEvidenceClick(id)}>
                      {id.toUpperCase()} 발화 보기
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="wz-step-label">유형 · 중분류 · 소분류를 각각 눌러 따로 고를 수 있어요.</p>
              <div className="wz-breadcrumb">
                {([1, 2, 3] as ClassifyStep[]).map((n) => (
                  <button
                    key={n}
                    className={`wz-crumb ${step === n ? 'active' : ''}`}
                    onClick={() => setStep(n)}
                  >
                    <span className="n">{n}</span>
                    {n === 1 ? '유형' : n === 2 ? '중분류' : '소분류'}
                  </button>
                ))}
              </div>

              {step === 1 && (
                <>
                  <p className="wz-step-label"><strong>{fieldLabel.type}</strong>을 선택하세요</p>
                  <div className="choice-group" role="radiogroup" aria-label={fieldLabel.type}>
                    {CONSULTATION_TYPES.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`choice-chip ${values.type === opt ? 'selected' : ''}`}
                        role="radio"
                        aria-checked={values.type === opt}
                        onClick={() => changeType(opt)}
                      >
                        {values.type === opt && <span aria-hidden="true">✓</span>}
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <p className="wz-step-label"><strong>{fieldLabel.category}</strong>를 선택하세요</p>
                  <div className="choice-group" role="radiogroup" aria-label={fieldLabel.category}>
                    {CONSULTATION_CATEGORIES.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`choice-chip ${values.category === opt ? 'selected' : ''}`}
                        role="radio"
                        aria-checked={values.category === opt}
                        onClick={() => changeCategory(opt)}
                      >
                        {values.category === opt && <span aria-hidden="true">✓</span>}
                        {opt}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <p className="wz-step-label"><strong>{fieldLabel.subcategory}</strong>를 선택하세요</p>
                  {subcategoryOptions.length === 0 ? (
                    <p className="choice-hint">중분류를 먼저 선택해 주세요.</p>
                  ) : (
                    <div className="choice-group" role="radiogroup" aria-label={fieldLabel.subcategory}>
                      {subcategoryOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`choice-chip ${values.subcategory === opt ? 'selected' : ''}`}
                          role="radio"
                          aria-checked={values.subcategory === opt}
                          onClick={() => changeSubcategory(opt)}
                        >
                          {values.subcategory === opt && <span aria-hidden="true">✓</span>}
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="wz-nav">
                <span />
                <button className="btn primary sm" onClick={() => setClassifyOpen(false)}>확인</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 문의·처리내용 요약 ── */}
      <div className={`field tier-${fields.summary.tier}`}>
        <div className="fhead">
          <span className="flabel">{fieldLabel.summary}</span>
          <span className={`tier-badge ${fields.summary.tier}`}>
            {tierIcon[fields.summary.tier]} {tierLabel[fields.summary.tier]}
          </span>
          <span className="conf">{Math.round(fields.summary.confidence * 100)}%</span>
          <span className="spacer" />
          {editedKeys.includes('summary') && <span className="edited-tag">수정됨</span>}
        </div>
        <div className="fbody">
          {fields.summary.tier !== 'high' && (
            <AiNote text="AI가 통화 내용을 요약했어요. 정확하지 않은 부분만 고쳐 주세요." />
          )}
          <div className="summary-fields">
            <label>
              <span>요청제목</span>
              <input
                type="text"
                value={s.title}
                onChange={(e) => patchSummary({ title: e.target.value })}
              />
            </label>
            <label>
              <span>문의내용</span>
              <textarea
                ref={autosize}
                rows={2}
                value={s.inquiry}
                onChange={(e) => {
                  patchSummary({ inquiry: e.target.value });
                  autosize(e.target);
                }}
              />
            </label>
            <label>
              <span>처리내용</span>
              <textarea
                ref={autosize}
                rows={2}
                value={s.resolution}
                onChange={(e) => {
                  patchSummary({ resolution: e.target.value });
                  autosize(e.target);
                }}
              />
            </label>
          </div>
          {fields.summary.evidence.length > 0 && (
            <div className="evidence-links">
              <span className="ev-note">AI 판단 근거:</span>
              {fields.summary.evidence.map((id) => (
                <button key={id} className="ev-link" onClick={() => onEvidenceClick(id)}>
                  {id.toUpperCase()} 발화 보기
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
