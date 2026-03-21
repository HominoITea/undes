const fs = require('fs');
const path = require('path');

const SPECS_PATH = path.join(process.cwd(), 'ai/specs/languages.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0] || 'help';
  const options = {};

  for (const arg of args.slice(1)) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      options[arg.slice(2)] = true;
      continue;
    }
    const key = arg.slice(2, eq);
    const value = arg.slice(eq + 1);
    if (key === 'ext') {
      if (!options.ext) options.ext = [];
      options.ext.push(value);
      continue;
    }
    options[key] = value;
  }

  return { command, options };
}

function validateSpecShape(specs) {
  const errors = [];
  if (!specs || typeof specs !== 'object') {
    errors.push('Root must be an object.');
    return errors;
  }
  if (!Array.isArray(specs.languages)) {
    errors.push('"languages" must be an array.');
    return errors;
  }

  const seenIds = new Set();
  const seenExt = new Map();

  specs.languages.forEach((lang, i) => {
    const prefix = `languages[${i}]`;
    if (!lang || typeof lang !== 'object') {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    if (!lang.id || typeof lang.id !== 'string' || !/^[a-z0-9-]+$/.test(lang.id)) {
      errors.push(`${prefix}.id must match ^[a-z0-9-]+$.`);
    } else if (seenIds.has(lang.id)) {
      errors.push(`${prefix}.id "${lang.id}" is duplicated.`);
    } else {
      seenIds.add(lang.id);
    }

    if (!lang.label || typeof lang.label !== 'string') {
      errors.push(`${prefix}.label must be a string.`);
    }

    if (!Array.isArray(lang.extensions) || lang.extensions.length === 0) {
      errors.push(`${prefix}.extensions must be a non-empty array.`);
    } else {
      lang.extensions.forEach((ext, j) => {
        if (typeof ext !== 'string' || !ext.startsWith('.')) {
          errors.push(`${prefix}.extensions[${j}] must start with ".".`);
          return;
        }
        const owner = seenExt.get(ext);
        if (owner && owner !== lang.id) {
          errors.push(`${prefix}.extensions[${j}] "${ext}" duplicates extension in "${owner}".`);
        } else {
          seenExt.set(ext, lang.id);
        }
      });
    }

    if (!Array.isArray(lang.symbolPatterns)) {
      errors.push(`${prefix}.symbolPatterns must be an array.`);
    } else {
      lang.symbolPatterns.forEach((p, j) => {
        if (!p || typeof p !== 'object') {
          errors.push(`${prefix}.symbolPatterns[${j}] must be an object.`);
          return;
        }
        if (!p.type || typeof p.type !== 'string') {
          errors.push(`${prefix}.symbolPatterns[${j}].type must be a string.`);
        }
        if (!p.regex || typeof p.regex !== 'string') {
          errors.push(`${prefix}.symbolPatterns[${j}].regex must be a string.`);
        } else {
          try {
            new RegExp(p.regex, p.flags || '');
          } catch (e) {
            errors.push(`${prefix}.symbolPatterns[${j}] invalid regex: ${e.message}`);
          }
        }
        if (p.flags !== undefined && typeof p.flags !== 'string') {
          errors.push(`${prefix}.symbolPatterns[${j}].flags must be a string if provided.`);
        }
      });
    }

    if (lang.ignorePatterns !== undefined) {
      if (!Array.isArray(lang.ignorePatterns)) {
        errors.push(`${prefix}.ignorePatterns must be an array if provided.`);
      } else {
        lang.ignorePatterns.forEach((v, j) => {
          if (typeof v !== 'string') {
            errors.push(`${prefix}.ignorePatterns[${j}] must be a string.`);
          }
        });
      }
    }
  });

  return errors;
}

function commandList() {
  if (!fs.existsSync(SPECS_PATH)) {
    console.error(`❌ Missing file: ${SPECS_PATH}`);
    process.exit(1);
  }
  const specs = readJson(SPECS_PATH);
  const langs = specs.languages || [];
  console.log(`Languages: ${langs.length}\n`);
  langs.forEach((lang) => {
    const ext = (lang.extensions || []).join(', ');
    const patterns = Array.isArray(lang.symbolPatterns) ? lang.symbolPatterns.length : 0;
    console.log(`- ${lang.id} (${lang.label})`);
    console.log(`  extensions: ${ext}`);
    console.log(`  symbolPatterns: ${patterns}`);
  });
}

function commandValidate() {
  if (!fs.existsSync(SPECS_PATH)) {
    console.error(`❌ Missing file: ${SPECS_PATH}`);
    process.exit(1);
  }
  const specs = readJson(SPECS_PATH);
  const errors = validateSpecShape(specs);
  if (errors.length > 0) {
    console.error('❌ Validation failed:');
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }
  console.log(`✅ OK: ${SPECS_PATH}`);
}

function ensureExtList(options) {
  const extList = Array.isArray(options.ext) ? options.ext : [];
  const normalized = extList
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((v) => (v.startsWith('.') ? v : `.${v}`));
  return [...new Set(normalized)];
}

function validateLanguageInput(id, label, extensions) {
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    throw new Error('--id is required and must match ^[a-z0-9-]+$');
  }
  if (!label) {
    throw new Error('--label is required');
  }
  if (!Array.isArray(extensions) || extensions.length === 0) {
    throw new Error('At least one --ext=.ext is required');
  }
}

function buildLanguage(id, label, extensions) {
  return {
    id,
    label,
    extensions,
    symbolPatterns: [
      {
        type: 'function',
        regex: 'TODO',
        flags: 'g',
      },
      {
        type: 'class-or-struct',
        regex: 'TODO',
        flags: 'g',
      },
    ],
    ignorePatterns: [],
  };
}

function addLanguageSpec(specs, language) {
  const id = language.id;
  const extensions = language.extensions || [];

  const existing = specs.languages.find((l) => l.id === id);
  if (existing) {
    throw new Error(`Language "${id}" already exists.`);
  }

  const extOwners = new Map();
  for (const lang of specs.languages) {
    for (const ext of lang.extensions || []) {
      extOwners.set(ext, lang.id);
    }
  }
  for (const ext of extensions) {
    if (extOwners.has(ext)) {
      throw new Error(`Extension "${ext}" already owned by "${extOwners.get(ext)}".`);
    }
  }

  specs.languages.push(language);
  specs.languages.sort((a, b) => a.id.localeCompare(b.id));
  return specs;
}

function commandScaffold(options) {
  const id = (options.id || '').trim();
  const label = (options.label || '').trim();
  const extensions = ensureExtList(options);

  try {
    validateLanguageInput(id, label, extensions);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  console.log(JSON.stringify(buildLanguage(id, label, extensions), null, 2));
}

function commandAdd(options) {
  if (!fs.existsSync(SPECS_PATH)) {
    console.error(`❌ Missing file: ${SPECS_PATH}`);
    process.exit(1);
  }

  const id = (options.id || '').trim();
  const label = (options.label || '').trim();
  const extensions = ensureExtList(options);

  try {
    validateLanguageInput(id, label, extensions);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  const specs = readJson(SPECS_PATH);
  const errors = validateSpecShape(specs);
  if (errors.length > 0) {
    console.error('❌ Current specs are invalid. Fix before adding a language:');
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }

  try {
    addLanguageSpec(specs, buildLanguage(id, label, extensions));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  writeJson(SPECS_PATH, specs);

  console.log(`✅ Added language "${id}" to ${SPECS_PATH}`);
  console.log('ℹ️ Fill TODO regex patterns and run: npm run ai:lang:validate');
}

function printHelp() {
  console.log(`Usage:
  node ai/scripts/language-specs.js list
  node ai/scripts/language-specs.js validate
  node ai/scripts/language-specs.js scaffold --id=rust --label=Rust --ext=.rs
  node ai/scripts/language-specs.js add --id=rust --label=Rust --ext=.rs

Commands:
  list      Show all registered language specs
  validate  Validate ai/specs/languages.json
  scaffold  Print a JSON scaffold for a new language
  add       Append a new language with TODO regex patterns`);
}

function main(argv = process.argv) {
  const { command, options } = parseArgs(argv);
  if (command === 'list') return commandList();
  if (command === 'validate') return commandValidate();
  if (command === 'scaffold') return commandScaffold(options);
  if (command === 'add') return commandAdd(options);
  return printHelp();
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  validateSpecShape,
  ensureExtList,
  validateLanguageInput,
  buildLanguage,
  addLanguageSpec,
  main,
};
