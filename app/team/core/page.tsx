'use client';

import dynamic from 'next/dynamic';

const CoreTeamFilter = dynamic(
  () => import('@/components/team/CoreTeamFilter').then((mod) => mod.CoreTeamFilter),
  {
    ssr: false,
    loading: () => (
      <div className="team-tree-loader">
        <div className="team-tree-loader-inner">
          <span>SYS_CORE // LOADING</span>
          <div className="team-tree-loader-bar" />
        </div>
      </div>
    ),
  }
);

export default function CoreTeamPage() {
  return (
    <div className="team-page-content" style={{ gap: 0, paddingBottom: '4rem' }}>
      <CoreTeamFilter />
    </div>
  );
}
