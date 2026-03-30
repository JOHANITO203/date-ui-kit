import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src', 'i18n');
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.json']);
const MOJIBAKE_RE = /(?:\u00D0.|\u00D1.|\u00C3.|\u00C2.)|\uFFFD/;

const decoder = new TextDecoder('utf-8', { fatal: true });

const listFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(target));
      continue;
    }
    if (entry.isFile() && ALLOWED_EXT.has(path.extname(entry.name))) {
      out.push(target);
    }
  }

  return out;
};

const files = listFiles(ROOT);
const errors: string[] = [];

for (const file of files) {
  const bytes = fs.readFileSync(file);
  try {
    const text = decoder.decode(bytes);
    if (MOJIBAKE_RE.test(text)) {
      errors.push(`${file}: mojibake-like sequence detected`);
    }
  } catch {
    errors.push(`${file}: invalid UTF-8 encoding`);
  }
}

if (errors.length > 0) {
  console.error(`UTF-8/i18n check failed (${errors.length} issues):`);
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`UTF-8/i18n check passed (${files.length} files).`);
