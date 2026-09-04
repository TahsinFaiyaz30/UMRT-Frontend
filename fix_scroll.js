const fs = require('fs');
let code = fs.readFileSync('components/team/CoreTeamFilter.tsx', 'utf8');

// 1. Add imports
code = code.replace(/import \{ motion, AnimatePresence \} from 'framer-motion';/, "import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';\nimport { useRef } from 'react';");

// 2. Insert helper components before CoreTeamFilter
const helpers = `
function ScrollLinkedLine({ x1, y1, x2, y2, d, className, viewBox, preserveAspectRatio, style, width, height }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 35%"]
  });
  
  return (
    <svg ref={ref} className={className} width={width} height={height} viewBox={viewBox} preserveAspectRatio={preserveAspectRatio} style={style}>
      {d ? (
        <motion.path 
          d={d} fill="none" stroke="var(--signal)" strokeWidth="2" 
          style={{ filter: 'drop-shadow(0 0 6px var(--signal))', pathLength: scrollYProgress }} 
        />
      ) : (
        <motion.line 
          x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--signal)" strokeWidth="2" 
          style={{ filter: 'drop-shadow(0 0 6px var(--signal))', pathLength: scrollYProgress }} 
        />
      )}
    </svg>
  );
}

function ScrollLinkedDot() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "start 60%"]
  });
  
  return (
    <motion.div 
      ref={ref}
      style={{ 
        position: 'absolute', top: -4, left: 'calc(50% - 4px)', width: 8, height: 8, borderRadius: '50%', background: 'var(--signal)', zIndex: 20, boxShadow: '0 0 10px var(--signal)',
        scale: scrollYProgress, opacity: scrollYProgress 
      }}
    />
  );
}
`;

code = code.replace(/export function CoreTeamFilter\(\) \{/, helpers + '\nexport function CoreTeamFilter() {');

// 3. Replace trunk SVG
code = code.replace(
  /<svg className="tree-connector" viewBox="0 0 2 60">[\s\S]*?<\/svg>/,
  '<ScrollLinkedLine className="tree-connector" viewBox="0 0 2 60" x1="1" y1="0" x2="1" y2="60" />'
);

// 4. Replace split SVG
code = code.replace(
  /<svg className="tree-split-connector" viewBox="0 0 1000 30" preserveAspectRatio="none">[\s\S]*?<\/svg>/,
  '<ScrollLinkedLine className="tree-split-connector" viewBox="0 0 1000 30" preserveAspectRatio="none" d="M 500 0 L 500 15 M 500 15 L 125 15 L 125 30 M 500 15 L 375 15 L 375 30 M 500 15 L 625 15 L 625 30 M 500 15 L 875 15 L 875 30" />'
);

// 5. Replace gap and branch SVG inside tree-member-cluster mapping
const clusterRegex = /<div className="tree-member-cluster" style=\{\{ display: 'flex', flexDirection: 'column', gap: '9px', alignItems: 'center' \}\}>[\s\S]*?<\/div>\s*<\/div>/;
const newCluster = `<div className="tree-member-cluster" style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center' }}>
    {colMembers.map((m, i) => (
      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {i > 0 && (
          <ScrollLinkedLine width="2" height="30" viewBox="0 0 2 30" style={{ overflow: 'visible' }} x1="1" y1="0" x2="1" y2="30" />
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <ScrollLinkedDot />
          <MemberCard member={m} variant="default" onInspect={setInspected} />
        </div>
      </div>
    ))}
  </div>
</div>`;

code = code.replace(clusterRegex, newCluster);

fs.writeFileSync('components/team/CoreTeamFilter.tsx', code);
console.log('Fixed Scroll tracking in CoreTeamFilter');
