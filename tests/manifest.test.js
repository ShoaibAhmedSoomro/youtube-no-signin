import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Manifest Configuration', () => {
  const manifestPath = path.resolve('ext', 'manifest.json');

  it('exists and is valid JSON', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf8');
    const json = JSON.parse(content);
    expect(json).toBeTypeOf('object');
  });

  it('uses Manifest V3', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(json.manifest_version).toBe(3);
  });

  it('has required host permissions', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(json.host_permissions).toContain('https://www.youtube.com/*');
    expect(json.host_permissions).toContain('https://www.google.com/*');
  });

  it('has required permissions for cookie injection', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(json.permissions).toContain('cookies');
    expect(json.permissions).toContain('webNavigation');
    // Must NOT contain privacy-invasive permissions
    expect(json.permissions).not.toContain('tabs');
    expect(json.permissions).not.toContain('storage');
  });

  it('configures content scripts to match youtube.com at document_start', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(json.content_scripts).toBeTypeOf('object');
    expect(json.content_scripts.length).toBeGreaterThan(0);
    
    const cs = json.content_scripts[0];
    expect(cs.matches).toContain('https://www.youtube.com/*');
    expect(cs.js).toContain('content.js');
    expect(cs.run_at).toBe('document_start');
  });

  it('has a popup and background service worker configured', () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(json.action.default_popup).toBe('popup.html');
    expect(json.background.service_worker).toBe('background.js');
  });

  it('rules.json replaces the Cookie header on youtube.com requests', () => {
    const [rule] = JSON.parse(fs.readFileSync(path.resolve('ext', 'rules.json'), 'utf8'));
    const header = rule.action.requestHeaders[0];
    expect(rule.condition.requestDomains).toEqual(['youtube.com']);
    expect(header).toMatchObject({ header: 'cookie', operation: 'set' });
    expect(header.value).toMatch(/CONSENT=.*SOCS=/);
    expect(header.value).not.toMatch(/SAPISID|LOGIN_INFO|SID=/);
    expect(JSON.parse(fs.readFileSync(path.resolve('ext', 'manifest.json'), 'utf8')).permissions).toContain('declarativeNetRequest');
  });
});
