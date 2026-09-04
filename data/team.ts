/**
 * Team data layer — TypeScript interfaces and mock dataset.
 *
 * Every array is dynamic: the UI renders N items, not a fixed count.
 * Replace placeholder names with real personnel when ready.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  email?: string;
  website?: string;
}

export interface TeamMember {
  /** Unique identifier. */
  id: string;
  /** Full display name. */
  name: string;
  /** Short role title. */
  role: string;
  /** Monospace tag, e.g. "[SYS_LEAD: MECHANICAL]". */
  roleTag: string;
  /** Which department this person belongs to (matches Department.id). */
  departmentId: string;
  /** Optional avatar image src — `undefined` triggers the placeholder. */
  avatarUrl?: string;
  /** Focus areas or project assignments. */
  focus?: string[];
  /** External links. */
  socials?: SocialLinks;
}

export interface DepartmentSpec {
  label: string;
  value: string;
}

export interface Department {
  /** Unique machine key. */
  id: string;
  /** Telemetry system code, e.g. "SYS-01". */
  sysCode: string;
  /** Human-readable title. */
  name: string;
  /** One-paragraph mission description. */
  description: string;
  /** Bulleted engineering highlights. */
  highlights: string[];
  /** Compact telemetry spec pills. */
  specs: DepartmentSpec[];
  /** Icon glyph hint for the frontend. */
  iconHint: 'gear' | 'code' | 'zap' | 'flask' | 'briefcase' | 'camera';
}

export interface TeamData {
  advisors: TeamMember[];
  teamLeader: TeamMember;
  coTeamLeader: TeamMember;
  seniorLead: TeamMember;
  departments: Department[];
  /** Sub-team leads keyed by department ID. */
  subTeamLeads: TeamMember[];
  /** General members keyed by department ID. */
  generalMembers: TeamMember[];
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function member(
  id: string,
  name: string,
  role: string,
  roleTag: string,
  departmentId: string,
  focus?: string[],
): TeamMember {
  return { id, name, role, roleTag, departmentId, focus };
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export const departments: Department[] = [
  {
    id: 'mechanical',
    sysCode: 'SYS-01',
    name: 'Mechanical Subsystem',
    iconHint: 'gear',
    description:
      'Designs, fabricates, and validates all structural and kinematic assemblies — from the 6-DOF manipulator arm to the rocker-bogie chassis and custom airless tires.',
    highlights: [
      '6-DOF Carbon Fiber Manipulator with end-effector tool changer',
      'Rocker-bogie suspension for 45° terrain traversal',
      '3D-printed flexible airless tires (TPU lattice)',
      'CNC-machined 7075-T6 aluminium structural nodes',
      'FEA-validated chassis rated for 2G dynamic loads',
    ],
    specs: [
      { label: 'ARM DOF', value: '6-DOF' },
      { label: 'CHASSIS', value: 'AL-7075' },
      { label: 'MASS', value: '< 50 kg' },
      { label: 'GRADE', value: '45°' },
    ],
  },
  {
    id: 'software',
    sysCode: 'SYS-02',
    name: 'Software & Autonomous Navigation',
    iconHint: 'code',
    description:
      'Develops the full autonomy stack — from stereo depth perception and SLAM to path planning and mission-level decision-making on ROS2.',
    highlights: [
      'ROS2 Humble navigation stack with Nav2 integration',
      'Stereo depth point-cloud fusion + terrain classification',
      'RTK-GPS and visual-inertial odometry for localization',
      'Autonomous GNSS waypoint traversal with obstacle avoidance',
      'React-based mission control ground station UI',
    ],
    specs: [
      { label: 'STACK', value: 'ROS2' },
      { label: 'LIDAR', value: '16-CH' },
      { label: 'NAV', value: 'RTK-GPS' },
      { label: 'FPS', value: '30 Hz' },
    ],
  },
  {
    id: 'electrical',
    sysCode: 'SYS-03',
    name: 'Electrical & Power Systems',
    iconHint: 'zap',
    description:
      'Engineers the power distribution architecture, telemetry backbone, and embedded firmware that keeps the rover alive and responsive under harsh field conditions.',
    highlights: [
      'Custom 4-layer PCB power distribution board',
      'CAN bus telemetry backbone (1 Mbps)',
      'Emergency stop & failsafe kill circuit system',
      '6S LiPo battery management with cell balancing',
      'Ruggedized Deutsch connectors for field serviceability',
    ],
    specs: [
      { label: 'BUS', value: 'CAN 2.0B' },
      { label: 'POWER', value: '22.2V' },
      { label: 'LAYERS', value: '4-PCB' },
      { label: 'RUNTIME', value: '2 hrs' },
    ],
  },
  {
    id: 'science',
    sysCode: 'SYS-04',
    name: 'Science & Astrobiology',
    iconHint: 'flask',
    description:
      'Conducts in-situ geological and biological analysis — designing sample collection tools, wet-chemistry assays, and spectroscopy workflows for bio-signature detection.',
    highlights: [
      'In-situ Raman spectrometry for mineral identification',
      'Wet-chemistry soil pH, moisture, and nutrient assays',
      'Bio-signature evaluation protocols (UV fluorescence)',
      'Automated sample coring and caching subsystem',
      'On-board data logging and real-time telemetry uplink',
    ],
    specs: [
      { label: 'RAMAN', value: '785 nm' },
      { label: 'ASSAYS', value: '5-type' },
      { label: 'CORE', value: '10 cm' },
      { label: 'MASS', value: '< 5 kg' },
    ],
  },
  {
    id: 'management',
    sysCode: 'SYS-05',
    name: 'Management & Operations',
    iconHint: 'briefcase',
    description:
      'Coordinates cross-functional logistics, sponsor relations, competition registrations, flight-readiness reviews, and internal project management for the entire team.',
    highlights: [
      'Sprint-based project planning with milestone tracking',
      'Sponsor acquisition and partnership management',
      'International competition registration and logistics',
      'Flight-readiness and system-readiness review protocols',
      'Cross-functional resource allocation and budgeting',
    ],
    specs: [
      { label: 'SPRINTS', value: 'Bi-weekly' },
      { label: 'SPONSORS', value: '8+' },
      { label: 'EVENTS', value: 'URC/ERC' },
      { label: 'BUDGET', value: 'Tracked' },
    ],
  },
  {
    id: 'media',
    sysCode: 'SYS-06',
    name: 'Media & Outreach',
    iconHint: 'camera',
    description:
      'Produces cinematic documentation, manages social presence, and drives public engagement to expand UMRT\'s reach and inspire the next generation of aerospace engineers.',
    highlights: [
      'Cinematic rover documentary production (4K)',
      'Social media strategy across 5 platforms',
      'University and school outreach workshop programs',
      'Brand identity design and merchandise production',
      'Event photography and live competition coverage',
    ],
    specs: [
      { label: 'VIDEO', value: '4K HDR' },
      { label: 'REACH', value: '50K+' },
      { label: 'PLATFORMS', value: '5' },
      { label: 'WORKSHOPS', value: '12/yr' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Personnel
// ---------------------------------------------------------------------------

const advisors: TeamMember[] = [
  {
    id: 'adv-1',
    name: 'Dr. Mahfuzul Hoq',
    role: 'Faculty Advisor',
    roleTag: '[FAC_ADV: PRIMARY]',
    departmentId: 'advisory',
    focus: ['Robotics & Control Systems', 'Embedded Systems Design'],
    socials: { email: 'marsrover@uiu.ac.bd' },
  },
  {
    id: 'adv-2',
    name: 'Dr. Nusrat Jahan',
    role: 'Faculty Co-Advisor',
    roleTag: '[FAC_ADV: SECONDARY]',
    departmentId: 'advisory',
    focus: ['Machine Learning', 'Computer Vision'],
    socials: { email: 'marsrover@uiu.ac.bd' },
  },
];

const teamLeader: TeamMember = {
  id: 'tl-1',
  name: 'Arif Rahman Khan',
  role: 'Team Leader',
  roleTag: '[CMD: TEAM_LEAD]',
  departmentId: 'command',
  focus: ['Strategic Planning', 'Systems Integration', 'Competition Strategy'],
};

const coTeamLeader: TeamMember = {
  id: 'ctl-1',
  name: 'Fariha Tasnim',
  role: 'Co-Team Leader',
  roleTag: '[CMD: CO_LEAD]',
  departmentId: 'command',
  focus: ['Operations Coordination', 'Cross-team Liaison', 'Quality Assurance'],
};

const seniorLead: TeamMember = {
  id: 'sl-1',
  name: 'Tahsin Faiyaz',
  role: 'Overall Senior Lead',
  roleTag: '[CMD: SR_LEAD]',
  departmentId: 'command',
  focus: ['Technical Architecture', 'System Design Review', 'Mentorship'],
};

const subTeamLeads: TeamMember[] = [
  member('stl-mech', 'Raihan Kabir',       'Mechanical Lead',    '[SYS_LEAD: MECHANICAL]',  'mechanical',  ['Manipulator Design', 'Structural FEA']),
  member('stl-soft', 'Nafisa Akter',        'Software Lead',      '[SYS_LEAD: SOFTWARE]',    'software',    ['ROS2 Navigation', 'SLAM Pipeline']),
  member('stl-elec', 'Tanvir Hossain',      'Electrical Lead',    '[SYS_LEAD: ELECTRICAL]',  'electrical',  ['PCB Design', 'CAN Telemetry']),
  member('stl-sci',  'Shaira Moumita',       'Science Lead',       '[SYS_LEAD: SCIENCE]',     'science',     ['Raman Spectroscopy', 'Soil Analysis']),
  member('stl-mgmt', 'Imran Chowdhury',     'Management Lead',    '[SYS_LEAD: MANAGEMENT]',  'management',  ['Sponsor Relations', 'Logistics']),
  member('stl-med',  'Anika Sultana',        'Media Lead',         '[SYS_LEAD: MEDIA]',       'media',       ['Documentary Production', 'Brand Strategy']),
];

const generalMembers: TeamMember[] = [
  // Mechanical (15 members)
  member('gm-me1', 'Mechanical Eng 01', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 1', 'Focus 2']),
  member('gm-me2', 'Mechanical Eng 02', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 2', 'Focus 3']),
  member('gm-me3', 'Mechanical Eng 03', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 3', 'Focus 4']),
  member('gm-me4', 'Mechanical Eng 04', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 4', 'Focus 0']),
  member('gm-me5', 'Mechanical Eng 05', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 5', 'Focus 1']),
  member('gm-me6', 'Mechanical Eng 06', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 6', 'Focus 2']),
  member('gm-me7', 'Mechanical Eng 07', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 7', 'Focus 3']),
  member('gm-me8', 'Mechanical Eng 08', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 8', 'Focus 4']),
  member('gm-me9', 'Mechanical Eng 09', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 9', 'Focus 0']),
  member('gm-me10', 'Mechanical Eng 10', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 10', 'Focus 1']),
  member('gm-me11', 'Mechanical Eng 11', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 11', 'Focus 2']),
  member('gm-me12', 'Mechanical Eng 12', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 12', 'Focus 3']),
  member('gm-me13', 'Mechanical Eng 13', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 13', 'Focus 4']),
  member('gm-me14', 'Mechanical Eng 14', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 14', 'Focus 0']),
  member('gm-me15', 'Mechanical Eng 15', 'Specialist', '[ENG: MECH]', 'mechanical', ['Role 15', 'Focus 1']),
  // Software (15 members)
  member('gm-so1', 'Software Eng 01', 'Specialist', '[ENG: SOFT]', 'software', ['Role 1', 'Focus 2']),
  member('gm-so2', 'Software Eng 02', 'Specialist', '[ENG: SOFT]', 'software', ['Role 2', 'Focus 3']),
  member('gm-so3', 'Software Eng 03', 'Specialist', '[ENG: SOFT]', 'software', ['Role 3', 'Focus 4']),
  member('gm-so4', 'Software Eng 04', 'Specialist', '[ENG: SOFT]', 'software', ['Role 4', 'Focus 0']),
  member('gm-so5', 'Software Eng 05', 'Specialist', '[ENG: SOFT]', 'software', ['Role 5', 'Focus 1']),
  member('gm-so6', 'Software Eng 06', 'Specialist', '[ENG: SOFT]', 'software', ['Role 6', 'Focus 2']),
  member('gm-so7', 'Software Eng 07', 'Specialist', '[ENG: SOFT]', 'software', ['Role 7', 'Focus 3']),
  member('gm-so8', 'Software Eng 08', 'Specialist', '[ENG: SOFT]', 'software', ['Role 8', 'Focus 4']),
  member('gm-so9', 'Software Eng 09', 'Specialist', '[ENG: SOFT]', 'software', ['Role 9', 'Focus 0']),
  member('gm-so10', 'Software Eng 10', 'Specialist', '[ENG: SOFT]', 'software', ['Role 10', 'Focus 1']),
  member('gm-so11', 'Software Eng 11', 'Specialist', '[ENG: SOFT]', 'software', ['Role 11', 'Focus 2']),
  member('gm-so12', 'Software Eng 12', 'Specialist', '[ENG: SOFT]', 'software', ['Role 12', 'Focus 3']),
  member('gm-so13', 'Software Eng 13', 'Specialist', '[ENG: SOFT]', 'software', ['Role 13', 'Focus 4']),
  member('gm-so14', 'Software Eng 14', 'Specialist', '[ENG: SOFT]', 'software', ['Role 14', 'Focus 0']),
  member('gm-so15', 'Software Eng 15', 'Specialist', '[ENG: SOFT]', 'software', ['Role 15', 'Focus 1']),
  // Electrical (15 members)
  member('gm-el1', 'Electrical Eng 01', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 1', 'Focus 2']),
  member('gm-el2', 'Electrical Eng 02', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 2', 'Focus 3']),
  member('gm-el3', 'Electrical Eng 03', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 3', 'Focus 4']),
  member('gm-el4', 'Electrical Eng 04', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 4', 'Focus 0']),
  member('gm-el5', 'Electrical Eng 05', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 5', 'Focus 1']),
  member('gm-el6', 'Electrical Eng 06', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 6', 'Focus 2']),
  member('gm-el7', 'Electrical Eng 07', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 7', 'Focus 3']),
  member('gm-el8', 'Electrical Eng 08', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 8', 'Focus 4']),
  member('gm-el9', 'Electrical Eng 09', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 9', 'Focus 0']),
  member('gm-el10', 'Electrical Eng 10', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 10', 'Focus 1']),
  member('gm-el11', 'Electrical Eng 11', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 11', 'Focus 2']),
  member('gm-el12', 'Electrical Eng 12', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 12', 'Focus 3']),
  member('gm-el13', 'Electrical Eng 13', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 13', 'Focus 4']),
  member('gm-el14', 'Electrical Eng 14', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 14', 'Focus 0']),
  member('gm-el15', 'Electrical Eng 15', 'Specialist', '[ENG: ELEC]', 'electrical', ['Role 15', 'Focus 1']),
  // Science (15 members)
  member('gm-sc1', 'Science Eng 01', 'Specialist', '[ENG: SCI]', 'science', ['Role 1', 'Focus 2']),
  member('gm-sc2', 'Science Eng 02', 'Specialist', '[ENG: SCI]', 'science', ['Role 2', 'Focus 3']),
  member('gm-sc3', 'Science Eng 03', 'Specialist', '[ENG: SCI]', 'science', ['Role 3', 'Focus 4']),
  member('gm-sc4', 'Science Eng 04', 'Specialist', '[ENG: SCI]', 'science', ['Role 4', 'Focus 0']),
  member('gm-sc5', 'Science Eng 05', 'Specialist', '[ENG: SCI]', 'science', ['Role 5', 'Focus 1']),
  member('gm-sc6', 'Science Eng 06', 'Specialist', '[ENG: SCI]', 'science', ['Role 6', 'Focus 2']),
  member('gm-sc7', 'Science Eng 07', 'Specialist', '[ENG: SCI]', 'science', ['Role 7', 'Focus 3']),
  member('gm-sc8', 'Science Eng 08', 'Specialist', '[ENG: SCI]', 'science', ['Role 8', 'Focus 4']),
  member('gm-sc9', 'Science Eng 09', 'Specialist', '[ENG: SCI]', 'science', ['Role 9', 'Focus 0']),
  member('gm-sc10', 'Science Eng 10', 'Specialist', '[ENG: SCI]', 'science', ['Role 10', 'Focus 1']),
  member('gm-sc11', 'Science Eng 11', 'Specialist', '[ENG: SCI]', 'science', ['Role 11', 'Focus 2']),
  member('gm-sc12', 'Science Eng 12', 'Specialist', '[ENG: SCI]', 'science', ['Role 12', 'Focus 3']),
  member('gm-sc13', 'Science Eng 13', 'Specialist', '[ENG: SCI]', 'science', ['Role 13', 'Focus 4']),
  member('gm-sc14', 'Science Eng 14', 'Specialist', '[ENG: SCI]', 'science', ['Role 14', 'Focus 0']),
  member('gm-sc15', 'Science Eng 15', 'Specialist', '[ENG: SCI]', 'science', ['Role 15', 'Focus 1']),
  // Management (15 members)
  member('gm-ma1', 'Management Eng 01', 'Specialist', '[ENG: MGMT]', 'management', ['Role 1', 'Focus 2']),
  member('gm-ma2', 'Management Eng 02', 'Specialist', '[ENG: MGMT]', 'management', ['Role 2', 'Focus 3']),
  member('gm-ma3', 'Management Eng 03', 'Specialist', '[ENG: MGMT]', 'management', ['Role 3', 'Focus 4']),
  member('gm-ma4', 'Management Eng 04', 'Specialist', '[ENG: MGMT]', 'management', ['Role 4', 'Focus 0']),
  member('gm-ma5', 'Management Eng 05', 'Specialist', '[ENG: MGMT]', 'management', ['Role 5', 'Focus 1']),
  member('gm-ma6', 'Management Eng 06', 'Specialist', '[ENG: MGMT]', 'management', ['Role 6', 'Focus 2']),
  member('gm-ma7', 'Management Eng 07', 'Specialist', '[ENG: MGMT]', 'management', ['Role 7', 'Focus 3']),
  member('gm-ma8', 'Management Eng 08', 'Specialist', '[ENG: MGMT]', 'management', ['Role 8', 'Focus 4']),
  member('gm-ma9', 'Management Eng 09', 'Specialist', '[ENG: MGMT]', 'management', ['Role 9', 'Focus 0']),
  member('gm-ma10', 'Management Eng 10', 'Specialist', '[ENG: MGMT]', 'management', ['Role 10', 'Focus 1']),
  member('gm-ma11', 'Management Eng 11', 'Specialist', '[ENG: MGMT]', 'management', ['Role 11', 'Focus 2']),
  member('gm-ma12', 'Management Eng 12', 'Specialist', '[ENG: MGMT]', 'management', ['Role 12', 'Focus 3']),
  member('gm-ma13', 'Management Eng 13', 'Specialist', '[ENG: MGMT]', 'management', ['Role 13', 'Focus 4']),
  member('gm-ma14', 'Management Eng 14', 'Specialist', '[ENG: MGMT]', 'management', ['Role 14', 'Focus 0']),
  member('gm-ma15', 'Management Eng 15', 'Specialist', '[ENG: MGMT]', 'management', ['Role 15', 'Focus 1']),
  // Media (15 members)
  member('gm-me1', 'Media Eng 01', 'Specialist', '[ENG: MED]', 'media', ['Role 1', 'Focus 2']),
  member('gm-me2', 'Media Eng 02', 'Specialist', '[ENG: MED]', 'media', ['Role 2', 'Focus 3']),
  member('gm-me3', 'Media Eng 03', 'Specialist', '[ENG: MED]', 'media', ['Role 3', 'Focus 4']),
  member('gm-me4', 'Media Eng 04', 'Specialist', '[ENG: MED]', 'media', ['Role 4', 'Focus 0']),
  member('gm-me5', 'Media Eng 05', 'Specialist', '[ENG: MED]', 'media', ['Role 5', 'Focus 1']),
  member('gm-me6', 'Media Eng 06', 'Specialist', '[ENG: MED]', 'media', ['Role 6', 'Focus 2']),
  member('gm-me7', 'Media Eng 07', 'Specialist', '[ENG: MED]', 'media', ['Role 7', 'Focus 3']),
  member('gm-me8', 'Media Eng 08', 'Specialist', '[ENG: MED]', 'media', ['Role 8', 'Focus 4']),
  member('gm-me9', 'Media Eng 09', 'Specialist', '[ENG: MED]', 'media', ['Role 9', 'Focus 0']),
  member('gm-me10', 'Media Eng 10', 'Specialist', '[ENG: MED]', 'media', ['Role 10', 'Focus 1']),
  member('gm-me11', 'Media Eng 11', 'Specialist', '[ENG: MED]', 'media', ['Role 11', 'Focus 2']),
  member('gm-me12', 'Media Eng 12', 'Specialist', '[ENG: MED]', 'media', ['Role 12', 'Focus 3']),
  member('gm-me13', 'Media Eng 13', 'Specialist', '[ENG: MED]', 'media', ['Role 13', 'Focus 4']),
  member('gm-me14', 'Media Eng 14', 'Specialist', '[ENG: MED]', 'media', ['Role 14', 'Focus 0']),
  member('gm-me15', 'Media Eng 15', 'Specialist', '[ENG: MED]', 'media', ['Role 15', 'Focus 1']),
];

// ---------------------------------------------------------------------------
// Assembled dataset
// ---------------------------------------------------------------------------

export const teamData: TeamData = {
  advisors,
  teamLeader,
  coTeamLeader,
  seniorLead,
  departments,
  subTeamLeads,
  generalMembers,
};

/** Convenience: get members (lead + general) for a given department. */
export function getMembersByDepartment(deptId: string): {
  lead: TeamMember | undefined;
  members: TeamMember[];
} {
  return {
    lead: teamData.subTeamLeads.find((m) => m.departmentId === deptId),
    members: teamData.generalMembers.filter((m) => m.departmentId === deptId),
  };
}

/** Convenience: get department metadata by ID. */
export function getDepartment(deptId: string): Department | undefined {
  return departments.find((d) => d.id === deptId);
}

/** All command-tier members in hierarchy order. */
export function getCommandChain(): TeamMember[] {
  return [teamData.teamLeader, teamData.coTeamLeader, teamData.seniorLead];
}
