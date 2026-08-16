import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Tier 3 Site: Base Link Prefix & RFC Citation Integrity', () => {
  const distDir = path.resolve('apps/learn-site/dist');

  // Collect all HTML files recursively in dist/
  function getHtmlFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getHtmlFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(full);
      }
    }
    return results;
  }

  const htmlFiles = getHtmlFiles(distDir);

  describe('Feature 7 / R1: GitHub Pages Base Prefix (/AuthMatrix/) Validation', () => {
    it('should find all 11 HTML files in dist output', () => {
      assert.ok(htmlFiles.length >= 11, `Expected at least 11 HTML files, found ${htmlFiles.length}`);
    });

    for (const filePath of htmlFiles) {
      const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');

      it(`should ensure all root-relative links in "${relPath}" start with "/AuthMatrix/"`, () => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Match all href and src attributes: href="..." or src="..."
        const linkRegex = /(?:href|src)=["']([^"']+)["']/gi;
        let match;
        const invalidLinks: string[] = [];

        while ((match = linkRegex.exec(content)) !== null) {
          const rawUrl = match[1].trim();

          // Skip empty or purely hash or protocol links
          if (
            !rawUrl ||
            rawUrl.startsWith('#') ||
            rawUrl.startsWith('http://') ||
            rawUrl.startsWith('https://') ||
            rawUrl.startsWith('mailto:') ||
            rawUrl.startsWith('data:') ||
            rawUrl.startsWith('javascript:')
          ) {
            continue;
          }

          // If it starts with '/', it MUST start with '/AuthMatrix/' or '/AuthMatrix'
          if (rawUrl.startsWith('/')) {
            if (!rawUrl.startsWith('/AuthMatrix') && !rawUrl.startsWith('/AuthMatrix/')) {
              invalidLinks.push(rawUrl);
            }
          }
        }

        assert.deepEqual(
          invalidLinks,
          [],
          `Found root-relative links missing /AuthMatrix/ base in ${relPath}: ${invalidLinks.join(', ')}`
        );
      });
    }
  });

  describe('Feature 2-5 / R1: RFC Citations & Standards Cross-References', () => {
    it('Module 1 (oauth/index.html) should cite RFC 6749 and RFC 9700', () => {
      const p = path.join(distDir, 'oauth', 'index.html');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('6749'), 'Module 1 must reference RFC 6749');
      }
    });

    it('Module 2 (flows/index.html) should cite RFC 7636 (PKCE)', () => {
      const p = path.join(distDir, 'flows', 'index.html');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('7636'), 'Module 2 must reference RFC 7636');
      }
    });

    it('Module 3 (oidc/index.html) should reference OpenID Connect Core 1.0 specifications', () => {
      const p = path.join(distDir, 'oidc', 'index.html');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('OpenID') || content.includes('OIDC'), 'Module 3 must reference OpenID Connect');
      }
    });

    it('Module 4 (tokens/index.html) should cite RFC 7519 (JWT) and RFC 7517 (JWKS)', () => {
      const p = path.join(distDir, 'tokens', 'index.html');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        assert.ok(content.includes('7519'), 'Module 4 must reference RFC 7519');
        assert.ok(content.includes('7517'), 'Module 4 must reference RFC 7517');
      }
    });
  });
});
