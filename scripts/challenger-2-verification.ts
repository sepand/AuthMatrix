import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  buildOktaSessionToken,
  buildEntraSessionToken,
  IdTokenClaims,
  SessionUser
} from '../apps/astro-frontend/src/lib/oidc.js';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../apps/astro-frontend/src/lib/pkce.js';

const SESSION_SECRET = process.env.JWT_SECRET || 'authmatrix-local-super-secret-key-2026';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  if (isMatch) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    const errMsg = `${message} -> Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`;
    failures.push(errMsg);
    console.error(`  ❌ FAIL: ${errMsg}`);
  }
}

console.log('================================================================');
console.log(' CHALLENGER 2: ADVERSARIAL & BOUNDARY VERIFICATION SUITE');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 1: Static Learn Site dist HTML Link & Asset Integrity
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- [CHALLENGE 1] Static Learn Site HTML Link & Asset Integrity ---');

const distDir = path.resolve('apps/learn-site/dist');
assert(fs.existsSync(distDir), `apps/learn-site/dist exists at ${distDir}`);

function getAllFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const allDistFiles = getAllFiles(distDir);
const htmlFiles = allDistFiles.filter(f => f.endsWith('.html'));

assertEqual(htmlFiles.length, 11, `Exactly 11 HTML pages exist in dist (found: ${htmlFiles.length})`);

const expectedPages = [
  'index.html',
  'oauth/index.html',
  'flows/index.html',
  'oidc/index.html',
  'tokens/index.html',
  'labs/index.html',
  'labs/lab-01/index.html',
  'labs/lab-02/index.html',
  'labs/lab-03/index.html',
  'labs/lab-04/index.html',
  'labs/lab-05/index.html',
];

for (const expected of expectedPages) {
  const target = path.join(distDir, ...expected.split('/'));
  assert(fs.existsSync(target), `Dist contains expected page: ${expected}`);
}

// Check Favicon SVG
const faviconPath = path.join(distDir, 'favicon.svg');
assert(fs.existsSync(faviconPath), 'Dist contains favicon.svg');
if (fs.existsSync(faviconPath)) {
  const stat = fs.statSync(faviconPath);
  assert(stat.size > 100, `Favicon size is healthy (${stat.size} bytes)`);
}

// Scan every attribute across every HTML file for link prefix correctness
let totalHrefsScanned = 0;
let invalidHrefs: { file: string; attr: string; val: string; issue: string }[] = [];

for (const htmlFile of htmlFiles) {
  const relPath = path.relative(distDir, htmlFile).replace(/\\/g, '/');
  const content = fs.readFileSync(htmlFile, 'utf-8');

  // Match href="...", src="...", action="..."
  const attrRegex = /(href|src|action)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    totalHrefsScanned++;
    const attrName = match[1];
    const val = match[2].trim();

    if (val.startsWith('#') || val.startsWith('mailto:') || val.startsWith('data:') || val.startsWith('javascript:')) {
      continue;
    }

    if (val.startsWith('http://')) {
      invalidHrefs.push({ file: relPath, attr: attrName, val, issue: 'Insecure http:// URL' });
      continue;
    }

    if (val.startsWith('https://')) {
      // External links are fine (e.g. RFC specs on rfc-editor.org or github)
      continue;
    }

    // Root-relative paths must start with /AuthMatrix/ or /AuthMatrix
    if (val.startsWith('/')) {
      if (!val.startsWith('/AuthMatrix/') && val !== '/AuthMatrix') {
        invalidHrefs.push({ file: relPath, attr: attrName, val, issue: 'Root path missing /AuthMatrix/ prefix' });
      } else {
        // Check if the referenced asset or page actually exists in dist
        const cleanPath = val.replace(/^\/AuthMatrix\/?/, '');
        if (cleanPath === '' || cleanPath === 'index.html') {
          // Home page - exists
        } else if (cleanPath.startsWith('_astro/')) {
          const assetFile = path.join(distDir, ...cleanPath.split('/'));
          if (!fs.existsSync(assetFile)) {
            invalidHrefs.push({ file: relPath, attr: attrName, val, issue: `CSS/JS asset not found on disk: ${assetFile}` });
          }
        } else if (cleanPath === 'favicon.svg') {
          if (!fs.existsSync(faviconPath)) {
            invalidHrefs.push({ file: relPath, attr: attrName, val, issue: 'favicon.svg not found on disk' });
          }
        } else {
          // Internal page link: check if either dist/<cleanPath>/index.html or dist/<cleanPath>.html or dist/<cleanPath> exists
          const possible1 = path.join(distDir, ...cleanPath.replace(/\/$/, '').split('/'), 'index.html');
          const possible2 = path.join(distDir, ...cleanPath.split('/'));
          if (!fs.existsSync(possible1) && !fs.existsSync(possible2)) {
            invalidHrefs.push({ file: relPath, attr: attrName, val, issue: `Target internal route not found: ${cleanPath}` });
          }
        }
      }
    } else {
      // Relative path without leading slash
      invalidHrefs.push({ file: relPath, attr: attrName, val, issue: 'Relative path without leading /AuthMatrix/' });
    }
  }
}

console.log(`  Scanned ${totalHrefsScanned} total href/src attributes across 11 HTML pages.`);
assertEqual(invalidHrefs, [], 'Zero invalid or broken links/assets found across static dist HTML files');

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 2: Multi-IdP Claim Normalization Combinatorics & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- [CHALLENGE 2] Multi-IdP Claim Normalization Combinatorics & Edge Cases ---');

const baseClaims: IdTokenClaims = {
  sub: 'usr_adversarial_999',
  email: 'victim@authmatrix.local',
  name: 'Adversary Testing User',
  iss: 'https://dev-okta.okta.com/oauth2/default',
  aud: '0oa_test_client_id',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

// Okta Edge Case Matrix
const oktaTestCases = [
  { name: 'Empty groups array', input: [], expectedRoles: ['Developer'] },
  { name: 'Duplicate identical Admin', input: ['Admin', 'Admin', 'Admin'], expectedRoles: ['Admin'] },
  { name: 'Dual mapping to Admin (Admin + SecurityEngineers)', input: ['Admin', 'SecurityEngineers'], expectedRoles: ['Admin'] },
  { name: 'SecurityEngineers + Everyone + AllStaff', input: ['SecurityEngineers', 'Everyone', 'AllStaff'], expectedRoles: ['Admin'] },
  { name: 'Managers + Developers + Auditors', input: ['Managers', 'Developers', 'Auditors'], expectedRoles: ['Manager', 'Developer', 'Auditor'] },
  { name: 'Unrecognized enterprise groups only', input: ['Sales', 'Marketing', 'Executive-Board', 'Contractor-External'], expectedRoles: ['Developer'] },
  { name: 'Ambient Everyone only', input: ['Everyone'], expectedRoles: ['Developer'] },
  { name: 'Case mismatch "admin" (lowercase)', input: ['admin'], expectedRoles: ['Developer'] },
  { name: 'Case mismatch "SECURITYENGINEERS"', input: ['SECURITYENGINEERS'], expectedRoles: ['Developer'] },
  { name: '100 Unrecognized groups with one valid Manager at index 73', input: Array.from({ length: 100 }, (_, i) => i === 73 ? 'Managers' : `Group_${i}`), expectedRoles: ['Manager'] },
];

for (const tc of oktaTestCases) {
  const token = buildOktaSessionToken({ ...baseClaims, groups: tc.input });
  const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;
  assertEqual(decoded.roles, tc.expectedRoles, `Okta Normalization: ${tc.name}`);
}

// Entra ID App Role Edge Case Matrix
const entraTestCases = [
  { name: 'Empty roles array', input: [], expectedRoles: ['Developer'] },
  { name: 'Single recognized role: Admin', input: ['Admin'], expectedRoles: ['Admin'] },
  { name: 'Single recognized role: Manager', input: ['Manager'], expectedRoles: ['Manager'] },
  { name: 'Single recognized role: Developer', input: ['Developer'], expectedRoles: ['Developer'] },
  { name: 'Single recognized role: Auditor', input: ['Auditor'], expectedRoles: ['Auditor'] },
  { name: 'Multi-role assignment: Admin + Auditor', input: ['Admin', 'Auditor'], expectedRoles: ['Admin', 'Auditor'] },
  { name: 'Unrecognized Graph Scopes mixed with Manager', input: ['User.Read', 'Directory.ReadWrite.All', 'Manager'], expectedRoles: ['Manager'] },
  { name: 'All unrecognized roles', input: ['AppRole_123', 'Guest', 'GlobalReader'], expectedRoles: ['Developer'] },
  { name: 'Case mismatch "ADMIN"', input: ['ADMIN'], expectedRoles: ['Developer'] },
  { name: 'Case mismatch "manager"', input: ['manager'], expectedRoles: ['Developer'] },
];

for (const tc of entraTestCases) {
  const token = buildEntraSessionToken({ ...baseClaims, roles: tc.input });
  const decoded = jwt.verify(token, SESSION_SECRET) as SessionUser;
  assertEqual(decoded.roles, tc.expectedRoles, `Entra Normalization: ${tc.name}`);
}

// Claims robustness: missing attributes, special characters, unicode, XSS vectors
console.log('\n  [Adversarial Claims & Identity Vectors]');
const xssName = '<script>alert("xss")</script>';
const xssEmail = '"><img src=x onerror=alert(1)>@test.com';
const unicodeSub = 'usr_🔥_日本語_ñç_12345';

const robustToken = buildOktaSessionToken({
  ...baseClaims,
  sub: unicodeSub,
  name: xssName,
  email: xssEmail,
  groups: ['Admin'],
});
const decodedRobust = jwt.verify(robustToken, SESSION_SECRET) as SessionUser;
assertEqual(decodedRobust.sub, unicodeSub, 'Preserves unicode subject ID without corruption');
assertEqual(decodedRobust.name, xssName, 'Preserves raw name claim safely inside JWT');
assertEqual(decodedRobust.email, xssEmail, 'Preserves raw email claim inside JWT');
assertEqual(decodedRobust.permissions.length, 9, 'Admin receives all 9 granular permissions');

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 3: PKCE RFC 7636 Boundary Values & Derivations
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- [CHALLENGE 3] PKCE RFC 7636 Boundary Values & Derivations ---');

// Official RFC 7636 Appendix B Test Vector
const rfcVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const expectedRfcChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const computedRfcChallenge = generateCodeChallenge(rfcVerifier);
assertEqual(computedRfcChallenge, expectedRfcChallenge, 'RFC 7636 Appendix B official test vector exact match');

// Length & Character Set Boundary Vectors
// RFC 7636 §4.1: code_verifier = high-entropy cryptographic random STRING using unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
// Minimum length: 43 chars. Maximum length: 128 chars.
const minVerifier = 'a'.repeat(43);
const maxVerifier = 'z'.repeat(128);

const minChallenge = generateCodeChallenge(minVerifier);
const maxChallenge = generateCodeChallenge(maxVerifier);

assertEqual(minChallenge.length, 43, 'Min length (43) verifier generates valid 43-char S256 challenge');
assertEqual(maxChallenge.length, 43, 'Max length (128) verifier generates valid 43-char S256 challenge');

// Independent cryptographic SHA-256 S256 check
const independentMin = crypto.createHash('sha256').update(minVerifier).digest('base64url');
const independentMax = crypto.createHash('sha256').update(maxVerifier).digest('base64url');
assertEqual(minChallenge, independentMin, 'Min challenge matches independent SHA256 base64url digest');
assertEqual(maxChallenge, independentMax, 'Max challenge matches independent SHA256 base64url digest');

// Base64URL characters only (no +, /, or = padding)
const sampleVerifiers = Array.from({ length: 100 }, () => generateCodeVerifier());
let nonCompliantVerifier = false;
let outOfRangeVerifier = false;

for (const v of sampleVerifiers) {
  if (!/^[A-Za-z0-9_-]+$/.test(v)) nonCompliantVerifier = true;
  if (v.length < 43 || v.length > 128) outOfRangeVerifier = true;
}
assert(!nonCompliantVerifier, '100 generated verifiers strictly conform to base64url character set');
assert(!outOfRangeVerifier, '100 generated verifiers are within [43, 128] characters (length is 43 chars for 32 random bytes)');

// State parameter boundary & entropy
const sampleStates = new Set<string>();
let stateBadChar = false;
let stateBadLen = false;
for (let i = 0; i < 200; i++) {
  const s = generateState();
  sampleStates.add(s);
  if (!/^[0-9a-f]{32}$/.test(s)) stateBadChar = true;
  if (s.length !== 32) stateBadLen = true;
}
assertEqual(sampleStates.size, 200, '200 generated state values are completely unique (collision-free)');
assert(!stateBadChar, 'All generated states are valid lowercase hex strings');
assert(!stateBadLen, 'All generated states are exactly 32 hex characters (16 bytes entropy)');

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 4: GitHub Actions Deployment Workflow Syntax & Security
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- [CHALLENGE 4] GitHub Actions Deployment Workflow Syntax ---');

const workflowPath = path.resolve('.github/workflows/deploy-learn-site.yml');
assert(fs.existsSync(workflowPath), `.github/workflows/deploy-learn-site.yml exists at ${workflowPath}`);

const workflowContent = fs.readFileSync(workflowPath, 'utf-8');

// Strict checks on workflow structure
assert(workflowContent.includes('name: Deploy Learn Site to GitHub Pages'), 'Workflow has correct descriptive name');
assert(workflowContent.includes('branches: [main]') || workflowContent.includes('branches:\n      - main'), 'Triggers on main branch push');
assert(workflowContent.includes('workflow_dispatch:'), 'Supports manual workflow_dispatch triggers');
assert(workflowContent.includes('pages: write'), 'Permissions grant pages: write');
assert(workflowContent.includes('id-token: write'), 'Permissions grant id-token: write (OIDC for Pages)');
assert(workflowContent.includes('contents: read'), 'Permissions grant contents: read');
assert(workflowContent.includes('concurrency:'), 'Configures concurrency group for GitHub Pages deployment');
assert(workflowContent.includes('cancel-in-progress: false'), 'Pages concurrency has cancel-in-progress: false to avoid corrupting deployments');
assert(workflowContent.includes('actions/checkout@v4'), 'Uses secure pinned actions/checkout@v4');
assert(workflowContent.includes('actions/setup-node@v4'), 'Uses secure pinned actions/setup-node@v4');
assert(workflowContent.includes("node-version: '20'"), 'Configures Node.js v20 LTS');
assert(workflowContent.includes('actions/configure-pages@v5'), 'Uses actions/configure-pages@v5');
assert(workflowContent.includes('npm ci'), 'Uses deterministic npm ci installation');
assert(workflowContent.includes('npm run build:learn'), 'Executes npm run build:learn targeting apps/learn-site');
assert(workflowContent.includes('actions/upload-pages-artifact@v3'), 'Uses actions/upload-pages-artifact@v3');
assert(workflowContent.includes('path: apps/learn-site/dist'), 'Uploads artifact from correct directory: apps/learn-site/dist');
assert(workflowContent.includes('environment:\n      name: github-pages') || workflowContent.includes('environment: github-pages') || workflowContent.includes('name: github-pages'), 'Targets github-pages environment');
assert(workflowContent.includes('actions/deploy-pages@v4'), 'Uses actions/deploy-pages@v4');

// Check paths triggers
assert(workflowContent.includes('apps/learn-site/**'), 'Trigger paths filter includes apps/learn-site/**');
assert(workflowContent.includes('labs/*/README.md'), 'Trigger paths filter includes labs/*/README.md');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(` CHALLENGER 2 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  console.error('\nFailures:');
  failures.forEach(f => console.error(` - ${f}`));
  process.exit(1);
} else {
  console.log('\n🌟 ALL 4 ADVERSARIAL CHALLENGES EMPIRICALLY VERIFIED AND PASSED!');
  process.exit(0);
}
