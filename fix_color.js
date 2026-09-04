const fs = require('fs');
let code = fs.readFileSync('components/team/CoreTeamFilter.tsx', 'utf8');

// Replace var(--signal) with var(--team-color) in ScrollLinkedLine and ScrollLinkedDot
code = code.replace(/var\(--signal\)/g, 'var(--team-color)');

// Add the dictionary right before export function CoreTeamFilter
const dict = `
const deptColors: Record<string, string> = {
  software: '#FF3B30',     // red
  mechanical: '#007AFF',   // blue
  electrical: '#FF9500',   // amber
  science: '#34C759',      // green
  management: '#FFD700',   // golden
  media: '#AF52DE'         // purple
};
`;

code = code.replace(/export function CoreTeamFilter\(\) \{/, dict + '\nexport function CoreTeamFilter() {');

// Inject the active color calculation and set the CSS variable on the section
const calcColor = `
  const activeDept = departments.find(d => d.id === activeDeptId)!;
  const activeColor = deptColors[activeDeptId] || '#00F0FF';
`;
code = code.replace(/  const activeDept = departments\.find\(d => d\.id === activeDeptId\)!\;/, calcColor);

const sectionReplace = `<section className="team-core-filter" aria-labelledby="core-team-heading" style={{ '--team-color': activeColor } as React.CSSProperties}>`;
code = code.replace(/<section className="team-core-filter" aria-labelledby="core-team-heading">/, sectionReplace);

fs.writeFileSync('components/team/CoreTeamFilter.tsx', code);
console.log('Fixed CoreTeamFilter to support dynamic team colors');
