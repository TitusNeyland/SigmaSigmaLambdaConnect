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
