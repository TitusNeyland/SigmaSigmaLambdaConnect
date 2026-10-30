#!/usr/bin/env node
// Turns a Jest or Vitest JSON results file into a GitHub Actions annotation, so test counts
// show up on the check run (readable through the API and in the PR).
// Usage: node scripts/report-tests.js <results.json> <label>
const fs = require('node:fs');

const [file, label = 'Tests'] = process.argv.slice(2);

if (!file || !fs.existsSync(file)) {
  console.log(`::error title=${label}::No results file found at ${file}`);
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(file, 'utf8'));
const passed = results.numPassedTests ?? 0;
const failed = results.numFailedTests ?? 0;
const total = results.numTotalTests ?? passed + failed;
const suites = results.numTotalTestSuites ?? 0;
const level = failed > 0 || total === 0 ? 'error' : 'notice';

console.log(`::${level} title=${label}::${passed} passed, ${failed} failed, ${total} total in ${suites} files`);

// Name each failing test (up to 10) so the cause is readable without the raw log.
const failures = (results.testResults ?? []).flatMap((file) =>
  (file.assertionResults ?? [])
    .filter((t) => t.status === 'failed')
    .map((t) => ({
      name: [...(t.ancestorTitles ?? []), t.title].join(' › '),
      file: String(file.name ?? '').replace(process.cwd() + '/', ''),
      message: String((t.failureMessages ?? [])[0] ?? '')
        .split('\n')
        .slice(0, 3)
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, 300),
    })),
);
for (const f of failures.slice(0, 10)) {
  console.log(`::error title=${label} failed::${f.file}: ${f.name}. ${f.message}`);
}
