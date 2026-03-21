const fs = require('fs');

const file = 'ai/scripts/context-pack.js';
let content = fs.readFileSync(file, 'utf8');

const buildFileSkeleton = `
function buildFileSkeleton(rootDir, relPath, fileSymbols, selectedIds, redactSecrets) {
  const abs = path.join(rootDir, relPath);
  if (!fs.existsSync(abs)) return '';

  const lines = fs.readFileSync(abs, 'utf8').split('\\n');

  const classes = fileSymbols.filter(s => s.type === 'class' || s.type === 'interface');
  const classNames = new Set(classes.map(c => c.name));
  
  const unselectedMethods = fileSymbols.filter(s => {
    if (s.type !== 'method' && s.type !== 'function') return false;
    if (selectedIds.has(s.id)) return false;
    if (s.name === 'constructor' || s.name === '__init__' || classNames.has(s.name)) return false;
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

  const body = out.join('\\n');
  return typeof redactSecrets === 'function' ? redactSecrets(body) : body;
}
`;

content = content.replace('function readRange(', buildFileSkeleton + '\nfunction readRange(');

const oldLoop = `
  let bytes = Buffer.byteLength(out.join('\\n'), 'utf8');
  for (const s of selectedSymbols) {
    const from = Math.max(1, s.startLine - snippetContextLines);
    const to = s.endLine + snippetContextLines;
    const frag = readRange(rootDir, s.file, from, to, redactSecrets);

    const block = [
      \`#### \${s.name} (\${s.file}:\${from}-\${to})\`,
      '\`\`\`' + (path.extname(s.file).slice(1) || 'text'),
      frag,
      '\`\`\`',
      '',
    ].join('\\n');

    const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
    if (nextBytes > cfg.maxPackBytes) break;

    out.push(block);
    bytes = nextBytes;
  }
`;

const newLoop = `
  let bytes = Buffer.byteLength(out.join('\\n'), 'utf8');
  const processedSkeletonFiles = new Set();
  const selectedIds = new Set(selectedSymbols.map(s => s.id));
  const structuralIds = new Set(Array.isArray(structural.symbols) ? structural.symbols.map(s => s.id) : []);

  for (const s of selectedSymbols) {
    if (processedSkeletonFiles.has(s.file)) continue;

    const fileSymbols = index.symbols.filter(x => x.file === s.file);
    const hasStructural = s.file && structuralIds.size > 0 && fileSymbols.some(x => selectedIds.has(x.id) && structuralIds.has(x.id));
    
    if (hasStructural) {
      const frag = buildFileSkeleton(rootDir, s.file, fileSymbols, selectedIds, redactSecrets);
      const block = [
        \`#### \${s.file} (Context Skeleton & Selected Methods)\`,
        '\`\`\`' + (path.extname(s.file).slice(1) || 'text'),
        frag,
        '\`\`\`',
        '',
      ].join('\\n');

      const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
      if (nextBytes <= cfg.maxPackBytes) {
        out.push(block);
        bytes = nextBytes;
        processedSkeletonFiles.add(s.file);
        continue;
      }
    }

    const from = Math.max(1, s.startLine - snippetContextLines);
    const to = s.endLine + snippetContextLines;
    const frag = readRange(rootDir, s.file, from, to, redactSecrets);

    const block = [
      \`#### \${s.name} (\${s.file}:\${from}-\${to})\`,
      '\`\`\`' + (path.extname(s.file).slice(1) || 'text'),
      frag,
      '\`\`\`',
      '',
    ].join('\\n');

    const nextBytes = bytes + Buffer.byteLength(block, 'utf8');
    if (nextBytes > cfg.maxPackBytes) break;

    out.push(block);
    bytes = nextBytes;
  }
`;

content = content.replace(oldLoop.trim(), newLoop.trim());

fs.writeFileSync(file, content);
console.log('patched');
