import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { QueuePage } from './pages/QueuePage';
import { ReviewPage } from './pages/ReviewPage';
import { FollowupPage } from './pages/FollowupPage';
import { AdminPage } from './pages/AdminPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { ADMIN_TABS } from './lib/adminTabs';

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
      <NavLink to="/queue" className={nav} aria-label="검토 대기열">
        검토 대기열
        {pending > 0 && (
          <span className={`icon-badge ${analyzing ? 'alert' : ''}`}>{pending}</span>
        )}
      </NavLink>
      <NavLink to="/followups" className={nav} aria-label="후속처리">
        후속처리
        {followups > 0 && <span className="icon-badge">{followups}</span>}
      </NavLink>

      <div className="nav-divider" />

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
          <Route path="/admin/:tab" element={<AdminPage />} />
        </Routes>
      </div>
      <ToastHost />
    </div>
  );
}
