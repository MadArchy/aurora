// Measures the pre-Phase-4 controller straight out of git, so the before/after
// figures in the governance docs come from one method and one encoding.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const measure = (label, text) => {
  const lines = text.split('\n');
  const methods = lines.filter((l) => /^ {2}(?:private |public |protected )?(?:static )?(?:async )?[a-zA-Z_]+\s*\(/.test(l));
  const stmts = lines.filter((l) => l.includes("from './components/"));
  const named = (text.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/components\/[^']*'/g) || []).reduce((acc, block) => {
    const inner = /\{([^}]*)\}/.exec(block)?.[1] || '';
    return acc + inner.split(',').filter((s) => s.trim()).length;
  }, 0);
  const handlers = (text.match(/addEventListener\(/g) || []).length;
  console.log(label);
  console.log('  lines:', lines.length - 1);
  console.log('  methods:', methods.length);
  console.log('  component import statements:', stmts.length);
  console.log('  named component imports:', named);
  console.log('  addEventListener sites:', handlers);
};

const before = execFileSync('git', ['show', `${process.argv[2] || 'HEAD'}:src/main.ts`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
measure('BEFORE (git)', before);
measure('AFTER (working tree)', readFileSync('src/main.ts', 'utf8'));
