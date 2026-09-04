const fs = require('fs');
let css = fs.readFileSync('app/globals.css', 'utf8');

css += '\n';
css += '.umrt-team-dropdown::before { content: ""; }\n';
css += '.umrt-team-dropdown-inner { width: 380px; background: rgba(7, 6, 4, 0.95); }\n';
css += '.tree-member-cluster { display: flex; flex-direction: column; gap: 40px; position: relative; }\n';

fs.writeFileSync('app/globals.css', css);
console.log('Appended fixes to globals.css');
