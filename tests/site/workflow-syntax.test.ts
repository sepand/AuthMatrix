import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Tier 3 Site: GitHub Actions CI/CD Deployment Workflow (.github/workflows/deploy-learn-site.yml)', () => {
  const workflowPath = path.resolve('.github/workflows/deploy-learn-site.yml');

  it('workflow file must exist in .github/workflows/', () => {
    assert.equal(fs.existsSync(workflowPath), true, `Workflow file not found: ${workflowPath}`);
  });

  it('workflow file must have non-zero size', () => {
    const stats = fs.statSync(workflowPath);
    assert.ok(stats.size > 200, `Workflow file size ${stats.size} should be > 200 bytes`);
  });

  describe('Feature 8 / R1: Workflow Configuration Integrity', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');

    it('should trigger on push to main branch and workflow_dispatch', () => {
      assert.match(content, /push:/i);
      assert.match(content, /branches:\s*\[?['"]?main['"]?\]?/i);
      assert.match(content, /workflow_dispatch/i);
    });

    it('should declare necessary GitHub Pages OIDC permissions (pages: write, id-token: write, contents: read)', () => {
      assert.match(content, /pages:\s*write/i, 'Must declare pages: write');
      assert.match(content, /id-token:\s*write/i, 'Must declare id-token: write');
      assert.match(content, /contents:\s*read/i, 'Must declare contents: read');
    });

    it('should configure single concurrent deployment to prevent race conditions', () => {
      assert.match(content, /concurrency:/i);
      assert.match(content, /group:\s*['"]?pages['"]?/i);
      assert.match(content, /cancel-in-progress:\s*(?:true|false)/i);
    });

    it('should configure node setup action and caching', () => {
      assert.match(content, /actions\/setup-node/i);
    });

    it('should run build command targeting learn-site', () => {
      assert.ok(
        content.includes('build:learn') || content.includes('apps/learn-site'),
        'Workflow build step must target learn-site build'
      );
    });

    it('should configure upload-pages-artifact with path to apps/learn-site/dist', () => {
      assert.match(content, /actions\/upload-pages-artifact/i);
      assert.match(content, /path:\s*['"]?apps\/learn-site\/dist['"]?/i);
    });

    it('should configure deploy-pages action for deployment to GitHub Pages environment', () => {
      assert.match(content, /actions\/deploy-pages/i);
      assert.match(content, /environment:\s*(?:github-pages|name:\s*github-pages)/i);
    });
  });
});
