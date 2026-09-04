const fs = require('fs');
let css = fs.readFileSync('app/globals.css', 'utf8');

css = css.replace(/\.umrt-team-nav-item:hover \.umrt-team-dropdown\s*\{[^}]*\}/g, '');
css = css.replace(/\.umrt-team-dropdown::before\s*\{[^}]*\}/g, '');
css = css.replace(/\.umrt-team-dropdown\s*\{[^}]*\}/g, '');
css = css.replace(/\.umrt-team-dropdown-inner\s*\{[^}]*\}/g, '');

const cleanDropdownCSS = `
.umrt-team-dropdown {
  position: absolute;
  left: 50%;
  top: calc(100% + 12px);
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 1000;
}

.umrt-team-nav-item:hover .umrt-team-dropdown,
.umrt-team-nav-item:focus-within .umrt-team-dropdown {
  pointer-events: auto;
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.umrt-team-dropdown::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 0;
  right: 0;
  height: 20px;
}

.umrt-team-dropdown-inner {
  width: 380px;
  background: rgba(7, 6, 4, 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8);
}
`;

fs.writeFileSync('app/globals.css', css + '\n' + cleanDropdownCSS);
console.log('Fixed dropdown CSS');
