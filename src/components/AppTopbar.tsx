import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { PROGRESS_STEPS, progressClass, toISODate } from './counselor/CounselorBits';
import { LogoMark } from './icons';
import '../styles.counselor.css';

/* ─────────────────────────────────────────────────────────────
   상담사·관리자 화면이 함께 쓰는 상단바 (Figma 14 / 17).
   [로고 CallWrap] ── [오늘의 현황 · 날짜 · 카운터 3개] ── [이름 역할 로그아웃]
   좌우가 같은 1fr이라 가운데 묶음이 화면 정중앙에 온다.
   ───────────────────────────────────────────────────────────── */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function todayLabel(): string {
  const d = new Date();
  return `${toISODate(d)} (${WEEKDAYS[d.getDay()]})`;
}

export interface TopbarCounters {
  '검토 대기': number;
  '진행 중': number;
  완료: number;
}

export function AppTopbar({ counters }: { counters: TopbarCounters }) {
  const counselor = useAuthStore((s) => s.counselor);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // 자정을 넘겨도 날짜가 따라가도록 1분마다 다시 계산한다 —
  // 상담사가 화면을 새로고침하지 않고 밤을 넘겨 켜 두는 경우를 위한 것.
  const [today, setToday] = useState(todayLabel);
  useEffect(() => {
    const id = setInterval(() => setToday(todayLabel()), 60_000);
    return () => clearInterval(id);
  }, []);

  const isAdmin = counselor?.role === 'ADMIN';
  const steps = useMemo(() => PROGRESS_STEPS, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="cw-top">
      <div className="cw-brand">
        <LogoMark size={26} />
        <span>CallWrap</span>
      </div>

      <div className="cw-status">
        <h1>오늘의 현황</h1>
        <span className="cw-date">{today}</span>
        <i className="cw-vline" />
        {steps.map((p) => (
          <span key={p} className={`cw-count ${progressClass(p)}`}>
            {p} <b>{counters[p]}</b> 건
          </span>
        ))}
      </div>

      <div className="cw-user">
        <div className="cw-who">
          <b>{counselor?.name ?? ''}</b>
          <span>{isAdmin ? '관리자' : '상담사'}</span>
        </div>
        <button className="cw-logout" onClick={handleLogout}>로그아웃</button>
      </div>
    </header>
  );
}
