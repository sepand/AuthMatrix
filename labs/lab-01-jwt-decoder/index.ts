import jwt from 'jsonwebtoken';

/**
 * Standalone Lab 01: Decoding and inspecting JWT structure
 */
function inspectJwt(rawJwt: string) {
  console.log('----------------------------------------------------');
  console.log('⚡ AuthMatrix Lab 01: JWT Base64URL Parser');
  console.log('----------------------------------------------------');

  const parts = rawJwt.split('.');
  if (parts.length !== 3) {
    console.error('❌ Error: Malformed JWT string (expected 3 parts separated by dots).');
    return;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

  console.log('\n[1] HEADER (Algorithm & Key Metadata):');
  console.dir(header, { depth: null, colors: true });

  console.log('\n[2] PAYLOAD (Claims & Roles):');
  console.dir(payload, { depth: null, colors: true });

  console.log('\n[3] SIGNATURE (Cryptographic Verification Hash):');
  console.log(`Raw Base64URL Signature: ${signatureB64.substring(0, 30)}...`);
  console.log('----------------------------------------------------\n');
}

// Generate sample test token
const testToken = jwt.sign(
  {
    sub: 'usr_seceng_999',
    name: 'Security Engineer',
    email: 'seceng@authmatrix.local',
    roles: ['Auditor', 'SecurityEngineer'],
    permissions: ['read:audit', 'read:reports', 'audit:jwks'],
    iss: 'https://authmatrix.local'
  },
  'authmatrix-local-super-secret-key-2026',
  { expiresIn: '1h' }
);

inspectJwt(testToken);
