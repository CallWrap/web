import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────
   통합 검토 화면의 작은 조각들 — 아이콘 / 배지 / 오버레이 / 달력.
   ───────────────────────────────────────────────────────────── */

/** 드롭다운 화살표. 폰트 글리프(▾)가 아니라 벡터 삼각형 10 x 6.2 — 지침 2절. */
export function Caret() {
  return (
    <svg className="cw-caret" viewBox="0 0 10 6.2" aria-hidden>
      <path d="M0 0h10L5 6.2z" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="0.5" y="3" width="13" height="10.5" rx="1" stroke="currentColor" />
      <path d="M0.5 6.4h13" stroke="currentColor" />
      <path d="M4 0.6v3M10 0.6v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlayShape() {
  return (
    <svg width="8" height="9" viewBox="0 0 8 9" aria-hidden>
      <path d="M0 0l8 4.5L0 9z" />
    </svg>
  );
}

export function PauseShape() {
  return (
    <svg width="8" height="9" viewBox="0 0 8 9" aria-hidden>
      <rect x="0" y="0" width="2.8" height="9" />
      <rect x="5.2" y="0" width="2.8" height="9" />
    </svg>
  );
}

/* ── 상태 · 등급 배지 ─────────────────────────────────────── */

/** 화면에 보이는 3가지 진행 상황. DB CallStatus와는 별개다(아래 progressOf). */
export type Progress = '검토 대기' | '진행 중' | '완료';
export const PROGRESS_STEPS: Progress[] = ['검토 대기', '진행 중', '완료'];

const PROGRESS_CLASS: Record<Progress, string> = {
  '검토 대기': 'wait',
  '진행 중': 'prog',
  완료: 'done',
};

export function ProgressBadge({ value }: { value: Progress }) {
  return <span className={`cw-badge ${PROGRESS_CLASS[value]}`}>{value}</span>;
}

const GRADE_CLASS: Record<string, string> = {
  악성: 'bad',
  일반: 'normal',
  칭찬: 'praise',
};

export function GradeCount({ label, count }: { label: '악성' | '일반' | '칭찬'; count: number }) {
  return (
    <span className={`cw-badge ${GRADE_CLASS[label]}`}>
      {label} {count}
    </span>
  );
}

/* ── 오버레이 ─────────────────────────────────────────────
   네 가지 모두 다른 요소 위에 겹쳐 뜬다. 화면을 밀어내지 않는다 — 지침 10절.
   여는 요소를 `.cw-anchor`로 감싸고 그 안에 이걸 넣는다. */
export function Popover({
  onClose,
  align = 'left',
  className = '',
  children,
}: {
  onClose: () => void;
  /** 화면 오른쪽 끝을 넘는 자리면 'right'로 열어 왼쪽으로 밀어 붙인다. */
  align?: 'left' | 'right';
  className?: string;
  children: ReactNode;
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
      <button className="cw-scrim" onClick={onClose} aria-label="닫기" tabIndex={-1} />
      <div className={`cw-pop ${align === 'right' ? 'right' : ''} ${className}`}>{children}</div>
    </>
  );
}

/** 선택 목록 오버레이 — 현재 값에 체크 + 연노랑. 상태 필터와 분류 드롭다운이 공유한다. */
export function Menu<T extends string>({
  options,
  value,
  onPick,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="cw-menu" role="listbox">
      {options.map((opt) => (
        <button
          key={opt}
          role="option"
          aria-selected={opt === value}
          className={opt === value ? 'on' : ''}
          onClick={() => onPick(opt)}
        >
          <span className="ck">{opt === value ? '✓' : ''}</span>
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ── 달력 (w 224) ─────────────────────────────────────────── */

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 달력 한 판을 주 단위 배열로. 빈 칸은 null. */
function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * 기간 입력칸에서 여는 달력. 선택 구간은 옅은 남색, 시작일·종료일은 진한 남색.
 * `적용`을 눌러야 확정된다 — 날짜만 누르면 화면 안에서만 바뀐다.
 */
export function CalendarPop({
  value,
  from,
  to,
  onPick,
  onApply,
}: {
  /** 지금 고르고 있는 쪽의 날짜 (YYYY-MM-DD) */
  value: string;
  from: string;
  to: string;
  onPick: (iso: string) => void;
  onApply: () => void;
}) {
  // 팝업은 열 때마다 새로 마운트되므로 보여줄 달은 초기값 한 번만 잡으면 된다.
  const [shown, setShown] = useState(() => {
    const base = value ? new Date(value) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  function move(delta: number) {
    const d = new Date(shown.y, shown.m + delta, 1);
    setShown({ y: d.getFullYear(), m: d.getMonth() });
  }

  const weeks = monthGrid(shown.y, shown.m);

  return (
    <div className="cw-cal">
      <div className="cw-cal-head">
        <button onClick={() => move(-1)} aria-label="이전 달">◀</button>
        <span className="m">{shown.y}년 {shown.m + 1}월</span>
        <button onClick={() => move(1)} aria-label="다음 달">▶</button>
      </div>

      <div className="cw-cal-dow">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cw-cal-grid">
        {weeks.map((week, wi) => (
          <div className="cw-cal-week" key={wi}>
            {week.map((day, di) => {
              if (day == null) return <span className="cw-cal-day blank" key={di} />;
              const iso = toISODate(new Date(shown.y, shown.m, day));
              const isEdge = iso === from || iso === to;
              const inRange = from && to && iso > from && iso < to;
              return (
                <button
                  key={di}
                  className={`cw-cal-day ${di === 0 ? 'sun' : ''} ${isEdge ? 'edge' : inRange ? 'in' : ''}`}
                  onClick={() => onPick(iso)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cw-cal-foot">
        <button className="today" onClick={() => onPick(toISODate(new Date()))}>오늘</button>
        <span className="cw-rule" />
        <button className="apply" onClick={onApply}>적용</button>
      </div>
    </div>
  );
}

/* ── 드래그로 옮기는 팝업 ─────────────────────────────────── */

export interface PopPos {
  x: number;
  y: number;
}

/**
 * 근거 발화 팝업. `data-drag` 속성이 붙은 요소(헤더)를 잡고 끌면 움직인다.
 * 화면 밖으로는 못 나간다. 바깥을 클릭해도 닫히지 않는다 — 근거가 여러 개일 때
 * 순서대로 눌러가며 확인해야 하기 때문(지침 7절).
 */
export function DragPopover({
  pos,
  onMove,
  className = '',
  children,
}: {
  pos: PopPos;
  onMove: (p: PopPos) => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    function move(e: PointerEvent) {
      if (!grab.current) return;
      const el = ref.current;
      const w = el?.offsetWidth ?? 440;
      const h = el?.offsetHeight ?? 200;
      onMove({
        x: Math.min(Math.max(0, e.clientX - grab.current.dx), window.innerWidth - w),
        y: Math.min(Math.max(0, e.clientY - grab.current.dy), window.innerHeight - h),
      });
    }
    function up() {
      grab.current = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [onMove]);

  return (
    <div
      ref={ref}
      className={`cw-dragpop ${className}`}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-drag]')) return;
        grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      }}
    >
      {children}
    </div>
  );
}
