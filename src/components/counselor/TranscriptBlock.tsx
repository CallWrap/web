import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import type { Utterance } from '../../api/types';
import { PauseShape, PlayShape } from './CounselorBits';

/** 전사문 패널이 밖에 열어주는 동작 — 지침 6절 `scrollToUtterance`. */
export interface TranscriptHandle {
  scrollToUtterance: (utteranceId: string) => void;
}

interface Props {
  transcript: Utterance[];
  /** 짧게 살아있는 프리사인 GET URL. null이면 재생 자체가 불가능한 콜이다. */
  audioUrl: string | null;
  durationSec: number | null;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
}

/* 한 칸 = 한 줄. 긴 발화는 칸을 두껍게 하지 않고 같은 화자로 다음 칸에 이어 붙인다.
   글자 폭을 실제로 재야 하므로 canvas measureText를 쓴다(문자 수 어림은 한글/영문이 섞이면 어긋난다). */
let measureCtx: CanvasRenderingContext2D | null = null;

function fitLines(text: string, maxWidth: number, font: string): string[] {
  if (maxWidth <= 0) return [text];
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return [text];
  measureCtx.font = font;

  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (line && measureCtx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch === ' ' ? '' : ch; // 줄 첫 글자가 공백이 되지 않게
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

/** 행에서 글자가 실제로 쓸 수 있는 폭 = 전체 - (좌우 padding 20 + 화자 46 + 시각 62 + gap 20) */
const ROW_CHROME = 148;

function durationLabel(sec: number | null): string {
  if (sec == null) return '통화 길이 미기록';
  return `통화 ${Math.floor(sec / 60)}분 ${`${Math.floor(sec % 60)}`.padStart(2, '0')}초`;
}

export const TranscriptBlock = forwardRef<TranscriptHandle, Props>(function TranscriptBlock(
  { transcript, audioUrl, durationSec },
  ref,
) {
  const [query, setQuery] = useState('');
  const [hitIdx, setHitIdx] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0); // 0~1
  const [audioLen, setAudioLen] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const uttRefs = useRef(new Map<string, HTMLDivElement>());
  const flashTimer = useRef<number | undefined>(undefined);
  const [textWidth, setTextWidth] = useState(0);
  const [font, setFont] = useState('11.5px sans-serif');

  // 패널 폭이 바뀌면 줄 나눔을 다시 계산한다 (모니터·창 크기에 따라 달라진다)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setFont(`${cs.fontSize} ${cs.fontFamily}`);
    const ro = new ResizeObserver(() => setTextWidth(el.clientWidth - ROW_CHROME));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 발화를 화면 폭에 맞춰 여러 줄로 펼친 목록. 첫 줄에만 시각·발화ID를 찍는다. */
  const lines = useMemo(
    () =>
      transcript.flatMap((u) =>
        fitLines(u.text, textWidth, font).map((text, i) => ({ u, text, first: i === 0, key: `${u.id}-${i}` })),
      ),
    [transcript, textWidth, font],
  );

  // 검색 일치 발화 — 이미 받아온 배열을 문자열 비교로 거른다(통신 없음, 지침 12절).
  const hits = useMemo(() => {
    const q = query.trim();
    if (!q) return [] as string[];
    return transcript.filter((u) => u.text.includes(q)).map((u) => u.id);
  }, [query, transcript]);

  const hitSet = useMemo(() => new Set(hits), [hits]);

  /** 지침 6절: 해당 발화로 부드럽게 스크롤 → 1.5초 강조 → 전사문 영역만 움직인다.
   *  검색의 ▲▼와 근거 발화 팝업 클릭이 이 동작을 공유한다. */
  function scrollToUtterance(utteranceId: string) {
    const el = uttRefs.current.get(utteranceId);
    if (!el) return;
    // 이미 보이는 발화면 스크롤 없이 강조만 한다.
    const box = scrollRef.current?.getBoundingClientRect();
    const target = el.getBoundingClientRect();
    const visible = box && target.top >= box.top && target.bottom <= box.bottom;
    if (!visible) el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    window.clearTimeout(flashTimer.current);
    setFlashId(null);
    requestAnimationFrame(() => setFlashId(utteranceId));
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500);
  }

  useImperativeHandle(ref, () => ({ scrollToUtterance }), []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // 콜이 바뀌면 검색·재생 상태를 버린다.
  useEffect(() => {
    setQuery('');
    setHitIdx(0);
    setPlaying(false);
    setPos(0);
  }, [audioUrl, transcript]);

  // 검색어가 바뀌면 첫 일치로 이동
  useEffect(() => {
    if (hits.length === 0) return;
    setHitIdx(0);
    scrollToUtterance(hits[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function stepHit(dir: 1 | -1) {
    if (hits.length === 0) return;
    const next = (hitIdx + dir + hits.length) % hits.length;
    setHitIdx(next);
    scrollToUtterance(hits[next]);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.MouseEvent<HTMLButtonElement>) {
    const el = audioRef.current;
    if (!el || !audioLen) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * audioLen;
    setPos(ratio);
  }

  return (
    <section className="cw-panel cw-transcript">
      <div className="cw-phead">
        <i className="cw-tick" />
        <h2>전사문</h2>
        <span className="cw-sub">{durationLabel(durationSec ?? (audioLen || null))}</span>

        <button
          className="cw-play"
          onClick={togglePlay}
          disabled={!audioUrl}
          aria-label={playing ? '일시정지' : '재생'}
          title={audioUrl ? undefined : '녹음 파일을 재생할 수 없습니다'}
        >
          {playing ? <PauseShape /> : <PlayShape />}
        </button>

        {/* 막대 폭 184 고정 — 재생이 진행돼도 버튼은 절대 움직이지 않는다 */}
        <button
          className="cw-seek"
          onClick={seek}
          disabled={!audioUrl}
          aria-label="재생 위치"
        >
          <i style={{ width: `${pos * 100}%` }} />
          <b style={{ left: `${pos * 100}%` }} />
        </button>

        <span className="cw-rule" />

        {hits.length > 0 && (
          <>
            <span className="cw-hits">{hitIdx + 1} / {hits.length}</span>
            <button className="cw-step" onClick={() => stepHit(-1)} aria-label="이전 일치">▲</button>
            <button className="cw-step" onClick={() => stepHit(1)} aria-label="다음 일치">▼</button>
          </>
        )}
        {query.trim() && hits.length === 0 && <span className="cw-hits">0 / 0</span>}

        <input
          className="cw-input"
          style={{ width: 200 }}
          placeholder="전사문 내용 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {audioUrl && (
        // key로 audioUrl을 걸어 콜이 바뀔 때 이전 콜의 재생 상태가 남지 않게 한다.
        <audio
          key={audioUrl}
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setAudioLen(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setPos(el.currentTime / el.duration);
          }}
          onEnded={() => setPlaying(false)}
          hidden
        />
      )}

      <div className="cw-utts" ref={scrollRef}>
        {transcript.length === 0 ? (
          <div className="cw-blank">전사문이 아직 없습니다.</div>
        ) : (
          lines.map(({ u, text, first, key }) => (
            <div
              key={key}
              // 스크롤 이동은 발화의 첫 줄을 기준으로 한다
              ref={
                first
                  ? (el) => {
                      if (el) uttRefs.current.set(u.id, el);
                      else uttRefs.current.delete(u.id);
                    }
                  : undefined
              }
              className={`cw-line ${u.speaker} ${hitSet.has(u.id) ? 'hit' : ''} ${flashId === u.id ? 'flash' : ''}`}
            >
              {/* 화자는 이어지는 칸에도 매번 찍는다 — 누구 말인지 칸마다 보여야 한다.
                  시각·발화ID만 첫 칸에 한 번. */}
              <span className="cw-line-who">{u.speaker === 'client' ? '민원인' : '상담사'}</span>
              <span className="cw-line-text">{text}</span>
              <span className="cw-line-meta">
                {first && (
                  <>
                    <i>{mmss(u.ts)}</i>
                    <i>{u.id.toUpperCase()}</i>
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
});
