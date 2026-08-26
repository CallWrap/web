import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QueuePage } from './pages/QueuePage';
import { ReviewPage } from './pages/ReviewPage';
import { FollowupPage } from './pages/FollowupPage';
import { CompletedPage } from './pages/CompletedPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { useAuthStore } from './store/authStore';
import { ADMIN_TABS, ADMIN_TAB_ICONS } from './lib/adminTabs';
import { ChartIcon, CheckIcon, LogoMark, LoopIcon, TrayIcon } from './components/icons';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatToday(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** 자정을 넘기면 날짜가 자동으로 바뀌도록 1분 간격으로 재계산한다.
 * 상담사가 화면을 새로고침하지 않고 밤을 넘겨 켜 두는 경우를 위한 것이다. */
function useToday(): string {
  const [today, setToday] = useState(() => formatToday(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday(formatToday(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

function Topbar() {
  const today = useToday();
  return (
    <div className="topbar">
      <div className="spacer" />
      <span className="today">{today}</span>
    </div>
  );
}

/** 얇은 아이콘 레일 + "모니터" 클릭으로 여는 분류 패널("사이드바 안의 사이드바"). 대기열·후속·
 * 완료는 레일에 바로 있어 패널에 중복으로 안 넣는다 — 패널엔 모니터링 7개 탭만. */
function Sidebar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const calls = useCallStore((s) => s.calls);
  const pending = calls.filter((c) => c.status === 'analyzing' || c.status === 'review').length;
  const followups = calls.filter((c) => c.status === 'followup').length;
  // 대기열 상단의 "오늘 처리 완료" 카드와 같은 집합 — 후속 처리 건도 확정된 콜이다.
  const completed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup').length;
  const analyzing = calls.some((c) => c.status === 'analyzing');
  const inMonitoring = pathname.startsWith('/admin');

  function go() {
    setOpen(false);
  }

  return (
    <div className="sidebar-shell">
      <aside className="rail">
        <NavLink to="/queue" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} aria-label="검토 대기열">
          <TrayIcon size={18} />
          <span className="rlabel">대기열</span>
          {pending > 0 && <span className={`rail-badge ${analyzing ? 'alert' : ''}`}>{pending}</span>}
        </NavLink>
        <NavLink to="/followups" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} aria-label="후속 처리">
          <LoopIcon size={18} />
          <span className="rlabel">후속</span>
          {followups > 0 && <span className="rail-badge">{followups}</span>}
        </NavLink>
        <NavLink to="/completed" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} aria-label="처리 완료">
          <CheckIcon size={18} />
          <span className="rlabel">완료</span>
          {completed > 0 && <span className="rail-badge">{completed}</span>}
        </NavLink>

        <div className="rail-divider" />

        {/* 모니터 버튼 자체가 분류 패널 토글이다(따로 있던 햄버거 버튼 제거) */}
        <button
          className={`rail-item ${inMonitoring ? 'active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="모니터링 분류 열기"
          aria-expanded={open}
        >
          <ChartIcon size={18} />
          <span className="rlabel">모니터</span>
        </button>

        <div className="rail-spacer" />
        <LogoMark size={32} />
      </aside>

      {open && (
        <>
          <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="분류 패널 닫기" />
          <div className="flyout">
            <div className="flyout-group-label">모니터링</div>
            <NavLink to="/admin" end onClick={go} className={({ isActive }) => `flyout-item ${isActive ? 'active' : ''}`}>
              <ChartIcon size={15} />
              <span>개요</span>
            </NavLink>
            {ADMIN_TABS.filter((t) => t.key !== 'overview').map((t) => {
              const Icon = ADMIN_TAB_ICONS[t.key];
              return (
                <NavLink
                  key={t.key}
                  to={`/admin/${t.key}`}
                  onClick={go}
                  className={({ isActive }) => `flyout-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={15} />
                  <span>{t.short}</span>
                </NavLink>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AuthedApp() {
  const loadQueue = useCallStore((s) => s.loadQueue);
  const { pathname } = useLocation();
  const isReview = pathname.startsWith('/review');
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return (
    <div className="app">
      {!isReview && <Sidebar />}
      <div className="main">
        {!isReview && <Topbar />}
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/review/:callId" element={<ReviewPage />} />
          <Route path="/followups" element={<FollowupPage />} />
          <Route path="/completed" element={<CompletedPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/:tab" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
      </div>
      <ToastHost />
    </div>
  );
}

export default function App() {
  const status = useAuthStore((s) => s.status);
  const initialize = useAuthStore((s) => s.initialize);
  const { pathname } = useLocation();

  useEffect(() => {
    if (status === 'idle') initialize();
  }, [status, initialize]);

  if (status === 'idle' || status === 'checking') {
    return (
      <div className="login-page">
        <div className="spinner" style={{ width: 22, height: 22 }} />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    if (pathname === '/login') return <LoginPage />;
    return <Navigate to="/login" replace />;
  }

  if (pathname === '/login') return <Navigate to="/queue" replace />;

  return <AuthedApp />;
}
