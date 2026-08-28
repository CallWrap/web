import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BackendReviewStats } from '../api/backendTypes';
import { getReviewStats } from '../api/api';
import { useCallStore } from '../store/callStore';
import { ADMIN_TABS, isAdminTab, type AdminTab } from '../lib/adminTabs';
import { AppTopbar, type TopbarCounters } from '../components/AppTopbar';
import { OverviewTab } from '../components/admin/OverviewTab';
import { LedgerTab } from '../components/admin/LedgerTab';
import { CounselorsTab } from '../components/admin/CounselorsTab';
import { CustomersTab } from '../components/admin/CustomersTab';
import { FaqTab } from '../components/admin/FaqTab';
import '../styles.counselor.css';
import '../styles.admin.css';

/* ─────────────────────────────────────────────────────────────
   관리자 화면 (Figma 17~24 · 관리자_화면_구현_지침.md).
   상단바 44 + 탭 줄 34 + 본문. 상담사 화면과 같은 디자인 언어를 쓰므로
   루트에 `.cw`를 함께 걸어 토큰·패널·표 스타일을 그대로 물려받는다.
   ───────────────────────────────────────────────────────────── */

const EMPTY_COUNTERS: TopbarCounters = { '검토 대기': 0, '진행 중': 0, 완료: 0 };

export function AdminPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const loadAdminQueue = useCallStore((s) => s.loadAdminQueue);

  const [stats, setStats] = useState<BackendReviewStats | null>(null);

  const active: AdminTab = isAdminTab(tab) ? tab : 'overview';

  useEffect(() => {
    loadAdminQueue();
  }, [loadAdminQueue]);

  // 상단바 카운터와 개요 탭이 같은 집계를 쓰므로 한 번만 받아 나눠 쓴다.
  // 관리자는 목록(useCallStore.calls)이 본인 배정 콜만 와서 비어 있으므로 집계 API가 유일한 출처다.
  useEffect(() => {
    let alive = true;
    getReviewStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      // 집계 실패로 화면 전체를 막지 않는다 — 카운터가 0으로 보일 뿐이다.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const counters: TopbarCounters = stats
    ? {
        // 검토 대기 = NEEDS_HUMAN_REVIEW + DONE (둘 다 상담사 확인을 기다리는 상태)
        '검토 대기': (stats.statusCounts.NEEDS_HUMAN_REVIEW ?? 0) + (stats.statusCounts.DONE ?? 0),
        '진행 중': stats.inProgressCount ?? 0,
        완료: stats.completedCount ?? 0,
      }
    : EMPTY_COUNTERS;

  return (
    <div className="cw aw">
      <AppTopbar counters={counters} />

      <nav className="aw-tabs">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            className={`aw-tab ${active === t.key ? 'on' : ''}`}
            onClick={() => navigate(t.key === 'overview' ? '/admin' : `/admin/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === 'overview' && <OverviewTab stats={stats} />}
      {active === 'ledger' && <LedgerTab />}
      {active === 'counselors' && <CounselorsTab />}
      {active === 'customers' && <CustomersTab />}
      {active === 'faq' && <FaqTab />}
    </div>
  );
}
