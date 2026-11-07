/**
 * Test helper utilities for the YouTube No Sign-in Extension test suite.
 * Designed for use with Vitest + jsdom environment.
 */

/**
 * Creates a DOM element with the given tag name and optional attributes.
 *
 * @param {string} tag - The HTML/custom element tag name (e.g. 'div', 'ytd-signin-renderer')
 * @param {Record<string, string>} [attrs={}] - Key/value pairs to set as attributes on the element
 * @returns {Element}
 */
export function makeElement(tag, attrs = {}) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Creates a DOM element that matches the given CSS selector string.
 * Supports:
 *   - Plain tag names:        'ytd-signin-renderer'  → <ytd-signin-renderer>
 *   - ID selectors:           '#sign-in-prompt'      → <div id="sign-in-prompt">
 *   - Attribute selectors:    '[aria-label*="sign"]' → <div aria-label="sign in">
 *   - Tag + attribute:        'tp-yt-paper-dialog[aria-label*="sign"]'
 *                                                    → <tp-yt-paper-dialog aria-label="sign in">
 *
 * For attribute selectors the helper sets a value that satisfies the operator:
 *   =   exact match
 *   *=  substring match (value used as-is)
 *   ^=  prefix match
 *   $=  suffix match
 *   ~=  word match (value used as-is)
 *   |=  hyphen-separated prefix match
 *
 * @param {string} selector - A CSS selector string
 * @returns {Element}
 */
export function makeSignInElement(selector) {
  let remaining = selector.trim();

  // --- 1. Extract leading tag name (if any) ---
  let tag = 'div';
  const tagMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) {
    tag = tagMatch[1];
    remaining = remaining.slice(tag.length);
  }

  const attrs = {};

  // --- 2. Extract ID selector (#foo) ---
  const idMatch = remaining.match(/#([^.[#\s[]+)/);
  if (idMatch) {
    attrs['id'] = idMatch[1];
    remaining = remaining.replace(idMatch[0], '');
  }

  // --- 3. Extract attribute selectors ([attr], [attr=val], [attr*=val], …) ---
  const attrRegex = /\[([^\]]+)\]/g;
  let attrMatch;
  while ((attrMatch = attrRegex.exec(remaining)) !== null) {
    const inner = attrMatch[1]; // e.g. 'aria-label*="sign"'

    // Parse operator and value
    const opMatch = inner.match(/^([\w-]+)(\*=|\^=|\$=|~=|\|=|=)"?([^"]*)"?$/);
    if (opMatch) {
      const [, attrName, op, val] = opMatch;
      // Produce a value that satisfies the operator
      switch (op) {
        case '=':   attrs[attrName] = val; break;
        case '*=':  attrs[attrName] = val; break;          // substring — use value directly
        case '^=':  attrs[attrName] = val + '-suffix'; break;
        case '$=':  attrs[attrName] = 'prefix-' + val; break;
        case '~=':  attrs[attrName] = val; break;          // word — use value directly
        case '|=':  attrs[attrName] = val; break;          // hyphen prefix — use value directly
        default:    attrs[attrName] = val;
      }
    } else {
      // Bare attribute with no value: [aria-hidden]
      const bareMatch = inner.match(/^([\w-]+)$/);
      if (bareMatch) {
        attrs[bareMatch[1]] = '';
      }
    }
  }

  return makeElement(tag, attrs);
}

import fs from 'fs';
import path from 'path';

/**
 * Loads the ext/content.js content script into a JSDOM instance's window context.
 * Returns the exposed api under window.__ytNoSignIn.
 *
 * @param {import('jsdom').JSDOM} dom - JSDOM instance
 * @returns {Record<string, any>}
 */
export function loadContentScript(dom) {
  const filePath = path.resolve('ext', 'content.js');
  const code = fs.readFileSync(filePath, 'utf8');
  
  // Execute within JSDOM window
  dom.window.eval(code);
  
  return dom.window.__ytNoSignIn || {};
}
