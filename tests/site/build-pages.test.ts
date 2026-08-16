import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Tier 3 Site: Static Page Generation & Structure (apps/learn-site/dist)', () => {
  const distDir = path.resolve('apps/learn-site/dist');

  const EXPECTED_PAGES = [
    { relativePath: 'index.html',              name: 'Masterclass Home',        expectedTitle: 'AuthMatrix' },
    { relativePath: 'oauth/index.html',        name: 'Module 1: OAuth 2.0',     expectedTitle: 'OAuth' },
    { relativePath: 'flows/index.html',        name: 'Module 2: Grants & PKCE', expectedTitle: 'Grant' },
    { relativePath: 'oidc/index.html',         name: 'Module 3: OpenID Connect',expectedTitle: 'OIDC|OpenID' },
    { relativePath: 'tokens/index.html',       name: 'Module 4: Tokens & JWT',  expectedTitle: 'Token' },
    { relativePath: 'labs/index.html',         name: 'Labs Hub',                expectedTitle: 'Lab' },
    { relativePath: 'labs/lab-01/index.html',  name: 'Lab 1: Local RBAC',       expectedTitle: 'Lab 1' },
    { relativePath: 'labs/lab-02/index.html',  name: 'Lab 2: Okta OIDC',        expectedTitle: 'Lab 2' },
    { relativePath: 'labs/lab-03/index.html',  name: 'Lab 3: Entra ID Roles',   expectedTitle: 'Lab 3' },
    { relativePath: 'labs/lab-04/index.html',  name: 'Lab 4: Azure APIM',       expectedTitle: 'Lab 4' },
    { relativePath: 'labs/lab-05/index.html',  name: 'Lab 5: Postman Testing',  expectedTitle: 'Lab 5' },
  ];

  it('static build directory apps/learn-site/dist must exist', () => {
    assert.equal(fs.existsSync(distDir), true, `Directory not found: ${distDir}`);
  });

  describe('Feature 1 / R1: Verify all 11 static HTML pages exist and have valid structure', () => {
    for (const page of EXPECTED_PAGES) {
      it(`should generate valid static HTML for "${page.name}" at ${page.relativePath}`, () => {
        const fullPath = path.join(distDir, page.relativePath);
        assert.equal(fs.existsSync(fullPath), true, `File does not exist: ${fullPath}`);

        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 500, `Page ${page.relativePath} size ${stats.size} bytes should be > 500 bytes`);

        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(content.toLowerCase().includes('<!doctype html>'), `${page.relativePath} must contain <!DOCTYPE html>`);
        assert.ok(content.includes('<html'), `${page.relativePath} must contain <html tag`);
        assert.ok(content.includes('<head'), `${page.relativePath} must contain <head tag`);
        assert.ok(content.includes('<title'), `${page.relativePath} must contain <title tag`);
        assert.match(content, new RegExp(page.expectedTitle, 'i'), `${page.relativePath} content should contain "${page.expectedTitle}"`);
      });
    }
  });

  describe('Feature 1 / R1: Static Asset Manifest & Stylesheets', () => {
    it('should generate compiled CSS in dist/_astro directory', () => {
      const astroAssetsDir = path.join(distDir, '_astro');
      assert.equal(fs.existsSync(astroAssetsDir), true, '_astro asset directory must exist');

      const files = fs.readdirSync(astroAssetsDir);
      const cssFiles = files.filter(f => f.endsWith('.css'));
      assert.ok(cssFiles.length >= 1, 'At least 1 bundled CSS file must exist in _astro/');
    });
  });
});
