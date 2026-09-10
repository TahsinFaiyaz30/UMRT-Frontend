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
  return <CoreTeamFilter />;
}
