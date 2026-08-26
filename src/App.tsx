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
import { ADMIN_TABS } from './lib/adminTabs';

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

// 관리자 화면 = 모니터링(+하위 탭)뿐. 상담사 화면 = 검토 대기열/후속 처리/처리 완료뿐 — 서로 겹치지 않는다.
function AdminSidebar() {
  const nav = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;
  return (
    <aside className="sidebar">
      <NavLink to="/admin" end className={nav} aria-label="모니터링 대시보드">
        모니터링
      </NavLink>
      <div className="nav-sub">
        {ADMIN_TABS.filter((t) => t.key !== 'overview').map((t) => (
          <NavLink
            key={t.key}
            to={`/admin/${t.key}`}
            className={({ isActive }) => `nav-subitem ${isActive ? 'active' : ''}`}
            title={t.label}
            aria-label={t.label}
          >
            {t.short}
          </NavLink>
        ))}
      </div>
    </aside>
  );
}

function CounselorSidebar() {
  const calls = useCallStore((s) => s.calls);
  const pending = calls.filter((c) => c.status === 'analyzing' || c.status === 'review').length;
  const followups = calls.filter((c) => c.status === 'followup').length;
  // 대기열 상단의 "오늘 처리 완료" 카드와 같은 집합 — 후속 처리 건도 확정된 콜이다.
  const completed = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup').length;
  const analyzing = calls.some((c) => c.status === 'analyzing');

  const nav = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <NavLink to="/queue" className={nav} aria-label="검토 대기열">
        검토 대기열
        {pending > 0 && (
          <span className={`icon-badge ${analyzing ? 'alert' : ''}`}>{pending}</span>
        )}
      </NavLink>
      <NavLink to="/followups" className={nav} aria-label="후속 처리">
        후속 처리
        {followups > 0 && <span className="icon-badge">{followups}</span>}
      </NavLink>
      <NavLink to="/completed" className={nav} aria-label="처리 완료">
        처리 완료
        {completed > 0 && <span className="icon-badge">{completed}</span>}
      </NavLink>
    </aside>
  );
}

function AuthedApp() {
  const loadQueue = useCallStore((s) => s.loadQueue);
  const counselor = useAuthStore((s) => s.counselor);
  const { pathname } = useLocation();
  const isReview = pathname.startsWith('/review');
  const isAdmin = counselor?.role === 'ADMIN';
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 화면을 철저히 분리한다 — 관리자는 /admin 밖으로, 상담사는 /admin 안으로 못 들어간다
  // (사이드바에서 링크를 안 보여주는 것만으로는 주소창 직접 입력을 못 막는다).
  if (isAdmin && !pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />;
  }
  if (!isAdmin && pathname.startsWith('/admin')) {
    return <Navigate to="/queue" replace />;
  }

  return (
    <div className="app">
      {!isReview && (isAdmin ? <AdminSidebar /> : <CounselorSidebar />)}
      <div className="main">
        {!isReview && <Topbar />}
        <Routes>
          {isAdmin ? (
            <>
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/:tab" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<QueuePage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/review/:callId" element={<ReviewPage />} />
              <Route path="/followups" element={<FollowupPage />} />
              <Route path="/completed" element={<CompletedPage />} />
              <Route path="*" element={<Navigate to="/queue" replace />} />
            </>
          )}
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
