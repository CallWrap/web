import { useEffect } from 'react';
import { CallDetailPane } from '../counselor/CallDetailPane';

/* ─────────────────────────────────────────────────────────────
   상세 보기 팝업 (Figma 24 · 관리자 지침 3절).
   어두운 막 위 1120 x 806 모달. 본문은 상담사 화면 우측을 그대로 옮긴 것이라
   CallDetailPane을 그대로 쓴다 — 관리자도 같은 방식으로 수정·저장한다.
   ───────────────────────────────────────────────────────────── */

export function CallDetailModal({
  callId,
  title,
  subtitle,
  onClose,
}: {
  callId: string;
  /** 상담번호 */
  title: string;
  /** 시각 */
  subtitle?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button className="aw-scrim" onClick={onClose} aria-label="닫기" tabIndex={-1} />
      <div className="aw-modal" role="dialog" aria-modal="true">
        <div className="aw-modal-head">
          <i className="cw-tick" />
          <h2>상세 보기</h2>
          <span className="aw-no">{title}</span>
          {subtitle && <span className="cw-sub">{subtitle}</span>}
          <span className="cw-rule" />
          <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <CallDetailPane callId={callId} />
      </div>
    </>
  );
}
