import { useState } from 'react';
import type { CallFields, FieldKey, SummaryValue, Tier } from '../api/types';
import {
  CONSULTATION_CATEGORIES,
  CONSULTATION_GRADES,
  CONSULTATION_TYPES,
  getSubcategoryOptions,
  normalizeSubcategoryForCategory,
} from '../lib/classificationOptions';
import { fieldLabel, tierLabel } from '../lib/format';
import { FIELD_ORDER, type Values } from '../pages/ReviewPage';

interface Props {
  fields: CallFields;
  values: Values;
  editedKeys: FieldKey[];
  failures: string[];
  onChange: (key: FieldKey, value: Values[FieldKey]) => void;
  onEvidenceClick: (uttId: string) => void;
}

const tierIcon: Record<Tier, string> = { high: '✓', medium: '◈', low: '✎' };

/**
 * FieldKey → 이 필드를 채우는 AI 모듈명(들). analysis.failures에 이 이름이 있으면
 * "확신도가 낮음"이 아니라 "이 항목 자체가 아직 AI에 연결 안 됨"이라는 뜻이라 문구를 다르게 보여준다.
 * type(유형)은 상담유형 전용 SR모델이 아직 analyze()에 안 붙어서(별도 레포/리뷰 진행 중) 항상
 * ETC 고정값만 나온다 — AI-model이 failures에 반영해주면(예: "classify_type") 그 키를 여기 추가한다.
 */
const FIELD_FAILURE_MODULES: Partial<Record<FieldKey, string[]>> = {
  category: ['classify_category'],
  subcategory: ['classify_subcategory', 'subcategory_hierarchy'],
  grade: ['grade'],
  summary: ['summarize'],
  followup: ['needs_followup'],
  faq: ['needs_faq'],
};

function isUnimplemented(key: FieldKey, failures: string[]): boolean {
  return (FIELD_FAILURE_MODULES[key] ?? []).some((m) => failures.includes(m));
}

export function TriageForm({ fields, values, editedKeys, failures, onChange, onEvidenceClick }: Props) {
  const highKeys = FIELD_ORDER.filter((k) => fields[k].tier === 'high');
  const restKeys = FIELD_ORDER.filter((k) => fields[k].tier !== 'high');

  const [bulkApproved, setBulkApproved] = useState(false);
  const [subcategoryReset, setSubcategoryReset] = useState(false);
  // 신뢰도로 결정되는 것은 "기본 표시 상태"뿐 — 수정 가능 여부는 항상 열려 있다.
  const [openHigh, setOpenHigh] = useState<Set<FieldKey>>(new Set());

  function toggleOpen(key: FieldKey) {
    setOpenHigh((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function changeCategory(category: string) {
    const nextSubcategory = normalizeSubcategoryForCategory(category, String(values.subcategory));
    const categoryChanged = category !== values.category;
    onChange('category', category);
    if (nextSubcategory !== values.subcategory) {
      onChange('subcategory', nextSubcategory);
    }
    if (categoryChanged && nextSubcategory === '') {
      setSubcategoryReset(true);
    }
  }

  function renderChoiceGroup(key: 'type' | 'category' | 'subcategory' | 'grade') {
    const options =
      key === 'type'
        ? CONSULTATION_TYPES
        : key === 'category'
          ? CONSULTATION_CATEGORIES
          : key === 'subcategory'
            ? getSubcategoryOptions(String(values.category))
            : CONSULTATION_GRADES;
    const selected = String(values[key]);
    const hasUnknownValue = selected !== '' && !options.includes(selected);

    if (key === 'subcategory' && options.length === 0) {
      return <p className="choice-hint">중분류를 먼저 선택해 주세요.</p>;
    }

    return (
      <div>
        {hasUnknownValue && (
          <p className="choice-hint warning">
            현재 값 ‘{selected}’은 선택한 분류 체계에 없습니다. 아래에서 다시 선택해 주세요.
          </p>
        )}
        {key === 'subcategory' && subcategoryReset && selected === '' && (
          <p className="choice-hint warning">중분류가 변경되어 소분류를 다시 선택해 주세요.</p>
        )}
        <div className="choice-group" role="radiogroup" aria-label={fieldLabel[key]}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`choice-chip ${selected === option ? 'selected' : ''}`}
              role="radio"
              aria-checked={selected === option}
              onClick={() => {
                if (key === 'category') changeCategory(option);
                else {
                  onChange(key, option);
                  if (key === 'subcategory') setSubcategoryReset(false);
                }
              }}
            >
              {selected === option && <span aria-hidden="true">✓</span>}
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderInput(key: FieldKey) {
    const f = fields[key];
    const value = values[key];
    if (key === 'followup' || key === 'faq') {
      const label = key === 'followup' ? '후속 처리가 필요합니다' : 'FAQ/지식베이스에 반영이 필요합니다';
      return (
        <div className="check-row">
          <input
            id={`t-${key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(key, e.target.checked)}
          />
          <label htmlFor={`t-${key}`}>{label}</label>
        </div>
      );
    }
    if (key === 'summary') {
      // 상담시스템 폼과 같은 세 칸이다. 합쳐서 하나로 받으면 확정할 때 구조가 깨진다.
      const s = value as SummaryValue;
      const patch = (part: Partial<SummaryValue>) => onChange(key, { ...s, ...part });
      return (
        <div className="summary-fields">
          <label>
            <span>요청제목</span>
            <input
              type="text"
              value={s.title}
              placeholder={f.tier === 'low' ? '한 줄 제목을 입력하세요' : ''}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label>
            <span>문의내용</span>
            <textarea
              rows={3}
              value={s.inquiry}
              placeholder={f.tier === 'low' ? '고객이 무엇을 문의했는지 입력하세요' : ''}
              onChange={(e) => patch({ inquiry: e.target.value })}
            />
          </label>
          <label>
            <span>처리내용</span>
            <textarea
              rows={3}
              value={s.resolution}
              placeholder={f.tier === 'low' ? '상담사가 어떻게 처리했는지 입력하세요' : ''}
              onChange={(e) => patch({ resolution: e.target.value })}
            />
          </label>
        </div>
      );
    }
    if (key === 'type' || key === 'category' || key === 'subcategory' || key === 'grade') {
      return renderChoiceGroup(key);
    }
    return (
      <input
        type="text"
        value={String(value)}
        placeholder={f.tier === 'low' ? '항목을 직접 선택·입력하세요' : ''}
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  }

  function renderCard(key: FieldKey, onCollapse?: () => void) {
    const f = fields[key];
    const edited = editedKeys.includes(key);
    return (
      <div key={key} className={`field tier-${f.tier}`}>
        <div className="fhead">
          <span className="flabel">{fieldLabel[key]}</span>
          <span className={`tier-badge ${f.tier}`}>
            {tierIcon[f.tier]} {tierLabel[f.tier]}
          </span>
          <span className="conf">{Math.round(f.confidence * 100)}%</span>
          {edited && <span className="edited-tag">수정됨</span>}
          {onCollapse && (
            <>
              <span className="spacer" />
              <button className="toggle" onClick={onCollapse}>
                접기 ▴
              </button>
            </>
          )}
        </div>
        <div className="fbody">
          {f.tier === 'low' && isUnimplemented(key, failures) && (
            <div className="low-hint unimplemented">
              <span>🛠</span> 이 항목은 아직 AI 분석에 연결되지 않았습니다. 상담사가 직접 입력해 주세요.
            </div>
          )}
          {f.tier === 'low' && !isUnimplemented(key, failures) && (
            <div className="low-hint">
              <span>✎</span> AI 신뢰도가 낮습니다. 상담사가 직접 판단해 입력해 주세요.
            </div>
          )}
          {renderInput(key)}
          {f.evidence.length > 0 && (
            <div className="evidence-links">
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>
                AI 판단 근거:
              </span>
              {f.evidence.map((id) => (
                <button key={id} className="ev-link" onClick={() => onEvidenceClick(id)}>
                  {id.toUpperCase()} 발화 보기
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderQuietRow(key: FieldKey) {
    const edited = editedKeys.includes(key);
    const isChoiceField = key === 'type' || key === 'category' || key === 'subcategory' || key === 'grade';
    return (
      <div key={key} className={`triage-quiet-row ${bulkApproved ? 'done' : ''}`}>
        <span className="k">{fieldLabel[key]}</span>
        <div className="quiet-value-cell">
          {key === 'followup' || key === 'faq' ? (
            <label className={`quiet-check ${Boolean(values[key]) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(values[key])}
                onChange={(e) => onChange(key, e.target.checked)}
              />
              필요
            </label>
          ) : key === 'summary' ? (
            // 접힌 줄에서는 제목만 고친다. 본문까지 편집하려면 "근거 ▾"로 펼친다.
            <input
              className="quiet-input"
              type="text"
              value={(values[key] as SummaryValue).title}
              placeholder="요청제목"
              onChange={(e) => onChange(key, { ...(values[key] as SummaryValue), title: e.target.value })}
            />
          ) : (
            <span className={`quiet-value ${isChoiceField ? 'value-chip' : ''}`}>
              {String(values[key]) || '선택 필요'}
            </span>
          )}
          {edited && <span className="edited-tag">수정됨</span>}
        </div>
        <button className="quiet-toggle" onClick={() => toggleOpen(key)}>
          {isChoiceField ? '수정 ▾' : '근거 ▾'}
        </button>
      </div>
    );
  }

  return (
    <div className="form-list">
      {highKeys.length > 0 && (
        <section className="triage-confidence-card" aria-label="AI 확신 항목">
          {bulkApproved ? (
            <div className="triage-bulk done">
              <span className="txt">✓ AI 확신 항목 {highKeys.length}개 일괄 승인됨</span>
            </div>
          ) : (
            <div className="triage-bulk">
              <span className="txt">
                AI 확신 항목 {highKeys.length}/{FIELD_ORDER.length}
              </span>
              <button className="btn high sm" onClick={() => setBulkApproved(true)}>
                {highKeys.length}개 일괄 승인
              </button>
            </div>
          )}
          <div className="triage-quiet">
            {highKeys.map((k) =>
              openHigh.has(k) ? renderCard(k, () => toggleOpen(k)) : renderQuietRow(k),
            )}
          </div>
        </section>
      )}

      {restKeys.length > 0 && (
        <>
          <div className="triage-divider">
            <span>직접 확인 필요 · {restKeys.length}건</span>
            <span className="line" />
          </div>
          <div className="triage-rest-list">{restKeys.map((k) => renderCard(k))}</div>
        </>
      )}
    </div>
  );
}
