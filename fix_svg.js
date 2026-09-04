const fs = require('fs');
let code = fs.readFileSync('components/team/CoreTeamFilter.tsx', 'utf8');

// Add style={{ filter: 'drop-shadow(0 0 8px var(--signal))' }} to the motion lines/paths
code = code.replace(/strokeWidth="2"/g, 'strokeWidth="2" style={{ filter: \'drop-shadow(0 0 6px var(--signal))\' }}');

fs.writeFileSync('components/team/CoreTeamFilter.tsx', code);
console.log('Added drop-shadow to SVG edges');
