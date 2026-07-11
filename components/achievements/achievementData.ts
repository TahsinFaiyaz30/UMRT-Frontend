export type AchievementCategory =
  | 'Foundation'
  | 'Engineering'
  | 'Competition'
  | 'Award'
  | 'Innovation';

export type AchievementMilestone = {
  year: string;
  title: string;
  description: string;
  code: string;
  category: AchievementCategory;
};

export type AchievementStat = {
  label: string;
  value: string;
};

/**
 * The archive moves forward in time so the final frame is the team's strongest
 * result, rather than asking the visitor to scroll backwards through its story.
 */
export const ACHIEVEMENT_MILESTONES: readonly AchievementMilestone[] = [
  {
    year: '2020',
    title: 'Team Founded',
    description:
      'A small multidisciplinary group committed to building beyond the classroom.',
    code: 'M-01',
    category: 'Foundation',
  },
  {
    year: '2021',
    title: 'First Prototype',
    description:
      'The first rover moved under its own power — a rough machine with a clear future.',
    code: 'M-02',
    category: 'Engineering',
  },
  {
    year: '2022',
    title: 'URC Qualification',
    description:
      'The first qualification transformed a workshop ambition into a global mission.',
    code: 'M-03',
    category: 'Competition',
  },
  {
    year: '2022',
    title: 'Best Rookie Team',
    description:
      'The team arrived as a newcomer and left as one of the competition’s revelations.',
    code: 'M-04',
    category: 'Award',
  },
  {
    year: '2023',
    title: 'ERC Poland',
    description:
      'UMRT carried its engineering to Europe and finished among the top fifteen.',
    code: 'M-05',
    category: 'Competition',
  },
  {
    year: '2024',
    title: 'URC Top 10',
    description:
      'A complete rover system proved itself at the Mars Desert Research Station.',
    code: 'M-06',
    category: 'Competition',
  },
  {
    year: '2024',
    title: 'Technical Innovation',
    description:
      'Autonomous navigation turned uncertain terrain into decisive movement.',
    code: 'M-07',
    category: 'Innovation',
  },
  {
    year: '2025',
    title: 'URC Top 5',
    description:
      'A top-five finish on the world stage — our strongest complete mission run yet.',
    code: 'M-08',
    category: 'Competition',
  },
] as const;

export const ACHIEVEMENT_STATS: readonly AchievementStat[] = [
  { label: 'Competitions', value: '15+' },
  { label: 'Awards won', value: '8' },
  { label: 'Team members', value: '50+' },
  { label: 'Years active', value: '5' },
] as const;
