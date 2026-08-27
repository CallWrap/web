import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { CounselorPage } from './pages/CounselorPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { useAuthStore } from './store/authStore';
import { ADMIN_TABS, ADMIN_TAB_ICONS } from './lib/adminTabs';
import { ChartIcon, CheckIcon, LogoMark, LoopIcon, TrayIcon } from './components/icons';
import { AppTopbar, type TopbarCounters } from './components/AppTopbar';
import { getReviewStats } from './api/api';

/** 얇은 아이콘 레일 + "모니터" 클릭으로 여는 분류 패널("사이드바 안의 사이드바"). 대기열·후속·
 * 완료는 레일에 바로 있어 패널에 중복으로 안 넣는다 — 패널엔 모니터링 7개 탭만.
 * role로 완전히 갈린다 — 관리자는 모니터 버튼만, 상담사는 대기열/후속/완료만 보인다(서로 겹치지 않음). */
function Sidebar({ isAdmin }: { isAdmin: boolean }) {
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
        {!isAdmin && (
          <>
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
          </>
        )}

        {isAdmin && (
          // 모니터 버튼 자체가 분류 패널 토글이다(따로 있던 햄버거 버튼 제거). 관리자는 이 버튼이
          // 레일의 유일한 메뉴다 — 대기열/후속/완료는 상담사 전용이라 아예 렌더하지 않는다.
          <button
            className={`rail-item ${inMonitoring ? 'active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="모니터링 분류 열기"
            aria-expanded={open}
          >
            <ChartIcon size={18} />
            <span className="rlabel">모니터</span>
          </button>
        )}

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

/**
 * 관리자 상단바. 상담사와 달리 목록(useCallStore.calls)이 상담사별로 필터링돼 비어 있으므로
 * 카운터는 전체 집계 API(/api/reviews/stats)에서 받는다.
 * 검토 대기 = NEEDS_HUMAN_REVIEW + DONE (둘 다 상담사 확인 대기 상태),
 * 진행 중 / 완료 = 확정된 콜을 후속 처리 필요 여부로 나눈 값.
 */
function AdminTopbar() {
  const [counters, setCounters] = useState<TopbarCounters>({ '검토 대기': 0, '진행 중': 0, 완료: 0 });

  useEffect(() => {
    let alive = true;
    getReviewStats()
      .then((s) => {
        if (!alive) return;
        setCounters({
          '검토 대기': (s.statusCounts.NEEDS_HUMAN_REVIEW ?? 0) + (s.statusCounts.DONE ?? 0),
          '진행 중': s.inProgressCount ?? 0,
          완료: s.completedCount ?? 0,
        });
      })
      // 집계 실패는 조용히 넘어간다 — 0으로 두면 되고, 화면 전체를 막을 이유가 없다.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return <AppTopbar counters={counters} />;
}

function AuthedApp() {
  const loadQueue = useCallStore((s) => s.loadQueue);
  const counselor = useAuthStore((s) => s.counselor);
  const { pathname } = useLocation();
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

  // 상담사는 통합 검토 화면 하나로 끝난다 — 대기열·검토·후속·완료가 한 화면에 합쳐졌고,
  // 그 화면이 자체 상단바를 들고 전체 화면을 쓰므로 앱 껍데기(사이드바·상단바)를 씌우지 않는다.
  if (!isAdmin) {
    return (
      <>
        <Routes>
          <Route path="/queue" element={<CounselorPage />} />
          <Route path="/review/:callId" element={<CounselorPage />} />
          <Route path="*" element={<CounselorPage />} />
        </Routes>
        <ToastHost />
      </>
    );
  }

  return (
    <div className="app admin-shell">
      <div className="cw-bar admin-topbar">
        <AdminTopbar />
      </div>
      <Sidebar isAdmin={isAdmin} />
      <div className="main">
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/:tab" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
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
