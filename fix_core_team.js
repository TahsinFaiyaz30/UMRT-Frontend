const fs = require('fs');
let code = fs.readFileSync('components/team/CoreTeamFilter.tsx', 'utf8');

// Change from 3 columns to 4 columns
code = code.replace(/\[0, 1, 2\]\.map\(\(colIndex\) => \{/g, '[0, 1, 2, 3].map((colIndex) => {');

code = code.replace(
  /const colMembers = members\.slice\(colIndex \* 5, \(colIndex \+ 1\) \* 5\);/g,
  'const colMembers = members.slice(colIndex * 4, Math.min((colIndex + 1) * 4, 15));'
);

code = code.replace(
  /<svg className=\"tree-split-connector\" viewBox=\"0 0 900 30\" preserveAspectRatio=\"none\">[\s\S]*?<\/svg>/,
  `<svg className="tree-split-connector" viewBox="0 0 1000 30" preserveAspectRatio="none">
    <motion.path 
      d="M 500 0 L 500 15 M 500 15 L 125 15 L 125 30 M 500 15 L 375 15 L 375 30 M 500 15 L 625 15 L 625 30 M 500 15 L 875 15 L 875 30" 
      fill="none" stroke="var(--signal)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px var(--signal))' }}
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: false, margin: '-20%' }}
      transition={{ duration: 0.8 }}
    />
  </svg>`
);

// We need to replace the entire tree-member-cluster div block with our new one
// Note: We need a careful regex here because the contents of the div changed in previous steps
code = code.replace(
  /<div className="tree-member-cluster">[\s\S]*?<\/div>\s*<\/div>/,
  `<div className="tree-member-cluster" style={{ display: 'flex', flexDirection: 'column', gap: '9px', alignItems: 'center' }}>
    {colMembers.map((m, i) => (
      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {i > 0 && (
          <svg width="2" height="9" viewBox="0 0 2 9" style={{ overflow: 'visible' }}>
            <motion.line 
              x1="1" y1="0" x2="1" y2="9" 
              stroke="var(--signal)" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 6px var(--signal))' }}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 0.3 }}
            />
          </svg>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <motion.div 
            style={{ position: 'absolute', top: -4, left: 'calc(50% - 4px)', width: 8, height: 8, borderRadius: '50%', background: 'var(--signal)', zIndex: 20, boxShadow: '0 0 10px var(--signal)' }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.3, duration: 0.3 }}
          />
          <MemberCard member={m} variant="default" onInspect={setInspected} />
        </div>
      </div>
    ))}
  </div>
</div>`
);

fs.writeFileSync('components/team/CoreTeamFilter.tsx', code);
console.log('Fixed CoreTeamFilter to 4 columns and proper gaps with dots');
