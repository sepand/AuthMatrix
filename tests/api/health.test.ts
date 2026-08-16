import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, BASE_URL } from '../helpers/server-helper.js';

describe('Tier 2 API: Health & Public Endpoints', () => {
  before(async () => {
    await ensureServer();
  });

  describe('Feature 9: GET /api/public', () => {
    it('should return HTTP 200 OK without any authentication header', async () => {
      const res = await fetch(`${BASE_URL}/api/public`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('application/json'));
    });

    it('should return valid JSON payload with status: online', async () => {
      const res = await fetch(`${BASE_URL}/api/public`);
      const body = await res.json();

      assert.equal(body.status, 'online');
      assert.ok(typeof body.message === 'string' && body.message.includes('AuthMatrix Public API'));
      assert.ok(typeof body.docs === 'string' && body.docs.includes('AuthMatrix'));
      assert.ok(typeof body.timestamp === 'string');
    });

    it('should return a valid ISO-8601 timestamp in the payload', async () => {
      const res = await fetch(`${BASE_URL}/api/public`);
      const body = await res.json();

      const parsedDate = new Date(body.timestamp);
      assert.equal(isNaN(parsedDate.getTime()), false, 'Timestamp should be valid Date');
      // Should be close to now (within 60 seconds)
      const diffMs = Math.abs(Date.now() - parsedDate.getTime());
      assert.ok(diffMs < 60000, `Timestamp diff ${diffMs}ms should be < 60000ms`);
    });

    it('should include CORS headers for frontend origin', async () => {
      const res = await fetch(`${BASE_URL}/api/public`, {
        headers: { Origin: 'http://localhost:3000' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
      assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    });

    it('should respond to OPTIONS preflight request', async () => {
      const res = await fetch(`${BASE_URL}/api/public`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        }
      });
      // CORS middleware responds 204 or 200
      assert.ok(res.status === 204 || res.status === 200);
      assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    });

    it('should handle arbitrary query parameters gracefully without crashing', async () => {
      const res = await fetch(`${BASE_URL}/api/public?query=test&debug=true&timestamp=invalid`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'online');
    });
  });
});
