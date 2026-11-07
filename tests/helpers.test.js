import { describe, it, expect } from 'vitest';
import { makeElement, makeSignInElement } from './helpers.js';

describe('makeElement', () => {
  it('creates an element with the given tag', () => {
    const el = makeElement('div');
    expect(el.tagName.toLowerCase()).toBe('div');
  });

  it('creates a custom element tag', () => {
    const el = makeElement('ytd-signin-renderer');
    expect(el.tagName.toLowerCase()).toBe('ytd-signin-renderer');
  });

  it('sets attributes from the attrs object', () => {
    const el = makeElement('div', { id: 'foo', class: 'bar', 'aria-hidden': 'true' });
    expect(el.getAttribute('id')).toBe('foo');
    expect(el.getAttribute('class')).toBe('bar');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('works with no attrs argument', () => {
    const el = makeElement('span');
    expect(el.tagName.toLowerCase()).toBe('span');
    expect(el.attributes.length).toBe(0);
  });

  it('works with an empty attrs object', () => {
    const el = makeElement('p', {});
    expect(el.attributes.length).toBe(0);
  });
});

describe('makeSignInElement', () => {
  it('creates an element from a plain tag name', () => {
    const el = makeSignInElement('ytd-signin-renderer');
    expect(el.tagName.toLowerCase()).toBe('ytd-signin-renderer');
  });

  it('creates a div with the correct id from an ID selector', () => {
    const el = makeSignInElement('#sign-in-prompt');
    expect(el.tagName.toLowerCase()).toBe('div');
    expect(el.getAttribute('id')).toBe('sign-in-prompt');
    // The element should match the original selector
    document.body.appendChild(el);
    expect(document.querySelector('#sign-in-prompt')).toBe(el);
    document.body.removeChild(el);
  });

  it('creates an element from an attribute selector with *=', () => {
    const el = makeSignInElement('[aria-label*="sign"]');
    expect(el.tagName.toLowerCase()).toBe('div');
    // The attribute value must contain "sign"
    const val = el.getAttribute('aria-label');
    expect(val).not.toBeNull();
    expect(val).toContain('sign');
    // The element should match the original selector
    document.body.appendChild(el);
    expect(document.querySelector('[aria-label*="sign"]')).toBe(el);
    document.body.removeChild(el);
  });

  it('creates an element from a tag + attribute selector', () => {
    const el = makeSignInElement('tp-yt-paper-dialog[aria-label*="sign"]');
    expect(el.tagName.toLowerCase()).toBe('tp-yt-paper-dialog');
    const val = el.getAttribute('aria-label');
    expect(val).not.toBeNull();
    expect(val).toContain('sign');
    // The element should match the original selector
    document.body.appendChild(el);
    expect(document.querySelector('tp-yt-paper-dialog[aria-label*="sign"]')).toBe(el);
    document.body.removeChild(el);
  });

  it('creates an element from a tag + ID selector', () => {
    const el = makeSignInElement('div#error-screen');
    expect(el.tagName.toLowerCase()).toBe('div');
    expect(el.getAttribute('id')).toBe('error-screen');
  });

  it('creates an element from an exact attribute selector', () => {
    const el = makeSignInElement('[data-type="modal"]');
    expect(el.getAttribute('data-type')).toBe('modal');
    document.body.appendChild(el);
    expect(document.querySelector('[data-type="modal"]')).toBe(el);
    document.body.removeChild(el);
  });
});
