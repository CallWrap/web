import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QueuePage } from './pages/QueuePage';
import { ReviewPage } from './pages/ReviewPage';
import { FollowupPage } from './pages/FollowupPage';
import { AdminPage } from './pages/AdminPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { ChartIcon, LoopIcon, TrayIcon } from './components/icons';

const TITLES: { match: (p: string) => boolean; title: string; crumb: string }[] = [
  { match: (p) => p.startsWith('/review'), title: '상담 검토', crumb: '검토 대기열 / 상담 검토' },
  { match: (p) => p.startsWith('/followups'), title: '후속처리', crumb: '후속처리 목록' },
  { match: (p) => p.startsWith('/admin'), title: '관리자 대시보드', crumb: '모니터링' },
  { match: () => true, title: '검토 대기열', crumb: '홈' },
];

function Topbar() {
  const { pathname } = useLocation();
  const meta = TITLES.find((t) => t.match(pathname))!;
  return (
    <div className="topbar">
      <h1>{meta.title}</h1>
      <span className="crumb">· {meta.crumb}</span>
      <div className="spacer" />
      <span className="today">2026년 7월 22일 (수)</span>
    </div>
  );
}

function Sidebar() {
  const calls = useCallStore((s) => s.calls);
  const pending = calls.filter((c) => c.status === 'analyzing' || c.status === 'review').length;
  const followups = calls.filter((c) => c.status === 'followup').length;
  const analyzing = calls.some((c) => c.status === 'analyzing');
  const todayDone = calls.filter((c) => c.status === 'confirmed' || c.status === 'followup').length;

  const nav = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <div className="brand">
        AfterCall
        <small>상담 후처리 AI · 데모</small>
      </div>

      <div className="nav-section">상담사</div>
      <NavLink to="/queue" className={nav}>
        <TrayIcon /> 검토 대기열
        {pending > 0 && (
          <span className={`badge ${analyzing ? 'alert' : ''}`}>{pending}</span>
        )}
      </NavLink>
      <NavLink to="/followups" className={nav}>
        <LoopIcon /> 후속처리
        {followups > 0 && <span className="badge">{followups}</span>}
      </NavLink>

      <div className="nav-section">관리자</div>
      <NavLink to="/admin" className={nav}>
        <ChartIcon /> 모니터링 대시보드
      </NavLink>

      <div className="agent">
        <div className="avatar">김</div>
        <div>
          <div className="name">김상담</div>
          <div className="role">복지 상담 2팀</div>
          <div className="today-count">오늘 {todayDone}건 처리</div>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
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
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
      <ToastHost />
    </div>
  );
}
