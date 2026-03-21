const fs = require('fs');

function buildFileSkeletonTest() {
  const fileSymbols = [
    { id: '1', type: 'class', name: 'MyService', startLine: 5, endLine: 50 },
    { id: '2', type: 'method', name: 'MyService', startLine: 10, endLine: 15 },
    { id: '3', type: 'method', name: 'doWork', startLine: 20, endLine: 30 },
    { id: '4', type: 'method', name: 'helper', startLine: 35, endLine: 45 },
  ];
  const selectedIds = new Set(['3']);
  const lines = [];
  for (let i=1; i<=50; i++) lines.push(`line ${i}`);

  const classes = fileSymbols.filter(s => s.type === 'class' || s.type === 'interface');
  const classNames = new Set(classes.map(c => c.name));
  
  const unselectedMethods = fileSymbols.filter(s => {
    if (s.type !== 'method' && s.type !== 'function') return false;
    if (selectedIds.has(s.id)) return false;
    if (s.name === 'constructor' || s.name === '__init__' || classNames.has(s.name)) {
      return false;
    }
    return true;
  });

  const skipLines = new Set();
  for (const m of unselectedMethods) {
    for (let i = Math.max(1, m.startLine) + 1; i <= m.endLine; i++) {
      skipLines.add(i);
    }
  }

  const out = [];
  let skipping = false;
  for (let i = 1; i <= lines.length; i++) {
    if (skipLines.has(i)) {
      if (!skipping) {
        out.push('  // ... unselected method body omitted ...');
        skipping = true;
      }
    } else {
      out.push(lines[i - 1]);
      skipping = false;
    }
  }

  console.log(out.join('\n'));
}

buildFileSkeletonTest();
