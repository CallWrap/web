import { useState } from 'react';
import type { CallFields, FieldKey, Tier } from '../api/types';
import { fieldLabel, tierLabel } from '../lib/format';
import { FIELD_ORDER, type Values } from '../pages/ReviewPage';

interface Props {
  fields: CallFields;
  values: Values;
  editedKeys: FieldKey[];
  onChange: (key: FieldKey, value: string | boolean) => void;
  onEvidenceClick: (uttId: string) => void;
}

const tierIcon: Record<Tier, string> = { high: '✓', medium: '◈', low: '✎' };

export function TriageForm({ fields, values, editedKeys, onChange, onEvidenceClick }: Props) {
  const highKeys = FIELD_ORDER.filter((k) => fields[k].tier === 'high');
  const restKeys = FIELD_ORDER.filter((k) => fields[k].tier !== 'high');

  const [bulkApproved, setBulkApproved] = useState(false);
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

  function renderInput(key: FieldKey) {
    const f = fields[key];
    const value = values[key];
    if (key === 'followup') {
      return (
        <div className="check-row">
          <input
            id={`t-${key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(key, e.target.checked)}
          />
          <label htmlFor={`t-${key}`}>후속처리가 필요합니다</label>
        </div>
      );
    }
    if (key === 'summary') {
      return (
        <textarea
          rows={4}
          value={String(value)}
          placeholder={f.tier === 'low' ? '상담 내용을 직접 요약해 입력하세요' : ''}
          onChange={(e) => onChange(key, e.target.value)}
        />
      );
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
          {f.tier === 'low' && (
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
    return (
      <div key={key} className={`triage-quiet-row ${bulkApproved ? 'done' : ''}`}>
        <span className="ck">{bulkApproved ? '✓' : ''}</span>
        <span className="k">{fieldLabel[key]}</span>
        {key === 'followup' ? (
          <label className="quiet-check">
            <input
              type="checkbox"
              checked={Boolean(values[key])}
              onChange={(e) => onChange(key, e.target.checked)}
            />
            필요
          </label>
        ) : key === 'summary' ? (
          <textarea
            className="quiet-textarea"
            rows={2}
            value={String(values[key])}
            onChange={(e) => onChange(key, e.target.value)}
          />
        ) : (
          <input
            className="quiet-input"
            type="text"
            value={String(values[key])}
            onChange={(e) => onChange(key, e.target.value)}
          />
        )}
        {edited && <span className="edited-tag">수정됨</span>}
        <button className="quiet-toggle" onClick={() => toggleOpen(key)}>
          근거 ▾
        </button>
      </div>
    );
  }

  return (
    <div className="form-list">
      {highKeys.length > 0 &&
        (bulkApproved ? (
          <div className="triage-bulk done">
            <span className="txt">✓ 확신 항목 {highKeys.length}건 일괄 승인됨</span>
          </div>
        ) : (
          <div className="triage-bulk">
            <span className="txt">
              AI 확신 {highKeys.length}/{FIELD_ORDER.length} 항목 — 근거 확인 완료
            </span>
            <button className="btn high sm" onClick={() => setBulkApproved(true)}>
              일괄 승인
            </button>
          </div>
        ))}

      {highKeys.length > 0 && (
        <div className="triage-quiet">
          {highKeys.map((k) =>
            openHigh.has(k) ? renderCard(k, () => toggleOpen(k)) : renderQuietRow(k),
          )}
        </div>
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
