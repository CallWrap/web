import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CounselorPage } from './pages/CounselorPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { ToastHost } from './store/toastStore';
import { useCallStore } from './store/callStore';
import { useAuthStore } from './store/authStore';

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

  // 관리자도 자체 상단바 + 탭 줄로 전체 화면을 쓴다 — 사이드바 없음(관리자 지침 1절).
  return (
    <>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:tab" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
      <ToastHost />
    </>
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
