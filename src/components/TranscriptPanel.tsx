import { forwardRef } from 'react';
import type { Utterance } from '../api/types';
import { fmtDuration } from '../lib/format';

interface Props {
  transcript: Utterance[];
  evidenceIds: Set<string>; // 현재 강조할 근거 발화 id
  flashId: string | null; // 근거 링크 클릭 시 잠깐 플래시할 발화
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  /** 녹음 재생용 프리사인 URL. 짧게 살아있으므로 새로고침 없이 오래 켜둔 화면에선 만료될 수 있다.
   * null이면 audioPath가 없거나 형식이 이상해서 재생 자체가 불가능한 콜이다. */
  audioUrl: string | null;
}

export const TranscriptPanel = forwardRef<HTMLDivElement, Props>(function TranscriptPanel(
  { transcript, evidenceIds, flashId, registerRef, audioUrl },
  scrollRef,
) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>화자 분리 전사</h3>
        <span className="hint">음영 = AI 판단 근거 발화</span>
      </div>
      {audioUrl ? (
        <div className="transcript-audio">
          {/* key로 audioUrl을 걸어 콜이 바뀔 때(같은 컴포넌트 재사용) 이전 콜의 재생 상태가
              남지 않도록 한다 — ReviewPage는 다음 콜로 넘어갈 때 같은 라우트 컴포넌트를 재사용한다. */}
          <audio key={audioUrl} controls preload="none" src={audioUrl} />
        </div>
      ) : (
        <div className="transcript-audio empty">녹음 파일을 재생할 수 없습니다</div>
      )}
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
