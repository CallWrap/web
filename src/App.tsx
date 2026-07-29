import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QueuePage } from './pages/QueuePage';
import { ReviewPage } from './pages/ReviewPage';
import { FollowupPage } from './pages/FollowupPage';
import { AdminPage } from './pages/AdminPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { ChartIcon, LoopIcon, TrayIcon } from './components/icons';

function Topbar() {
  return (
    <div className="topbar">
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

  const nav = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <aside className="sidebar">
      <NavLink to="/queue" className={nav} title="검토 대기열" aria-label="검토 대기열">
        <TrayIcon size={19} />
        {pending > 0 && (
          <span className={`icon-badge ${analyzing ? 'alert' : ''}`}>{pending}</span>
        )}
      </NavLink>
      <NavLink to="/followups" className={nav} title="후속처리" aria-label="후속처리">
        <LoopIcon size={19} />
        {followups > 0 && <span className="icon-badge">{followups}</span>}
      </NavLink>

      <div className="nav-divider" />

      <NavLink to="/admin" className={nav} title="모니터링 대시보드" aria-label="모니터링 대시보드">
        <ChartIcon size={19} />
      </NavLink>
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
