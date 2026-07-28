import { forwardRef } from 'react';
import type { Utterance } from '../api/types';
import { fmtDuration } from '../lib/format';

interface Props {
  transcript: Utterance[];
  evidenceIds: Set<string>; // 현재 강조할 근거 발화 id
  flashId: string | null; // 근거 링크 클릭 시 잠깐 플래시할 발화
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

export const TranscriptPanel = forwardRef<HTMLDivElement, Props>(function TranscriptPanel(
  { transcript, evidenceIds, flashId, registerRef },
  scrollRef,
) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>화자 분리 전사</h3>
        <span className="hint">음영 = AI 판단 근거 발화</span>
      </div>
      <div className="transcript" ref={scrollRef}>
        {transcript.map((u) => {
          const isEv = evidenceIds.has(u.id);
          const isFlash = flashId === u.id;
          return (
            <div
              key={u.id}
              ref={(el) => registerRef(u.id, el)}
              className={`utt ${u.speaker} ${isEv ? 'evidence' : ''} ${isFlash ? 'flash' : ''}`}
            >
              <div className="who">{u.speaker === 'client' ? '민원인' : '상담사'}</div>
              <div className="body">
                <div className="ts">
                  {fmtDuration(u.ts)} · {u.id.toUpperCase()}
                </div>
                <div className="text">{u.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
