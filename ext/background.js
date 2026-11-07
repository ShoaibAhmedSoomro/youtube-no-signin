/**
 * YouTube No Sign-in — Background Service Worker
 *
 * Responsibilities:
 *   1. Inject CONSENT + SOCS cookies so YouTube doesn't redirect to /oops
 *   2. Refresh cookies on install, startup, and every YouTube navigation
 *   3. Relay messages between popup and content script
 *
 * IMPORTANT: This script does NOT perform any redirects or tab navigation.
 * All page-level bypass logic lives in content.js to avoid redirect loops.
 */

'use strict';

// ──────────────────────────────────────────────────────────
// Cookie Definitions
// YouTube requires these to function without redirecting.
// They are NOT sign-in cookies — they record consent status.
// ──────────────────────────────────────────────────────────

const REQUIRED_COOKIES = [
  {
    url: 'https://www.youtube.com',
    name: 'CONSENT',
    value: 'PENDING+987',
    domain: '.youtube.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  },
  {
    url: 'https://www.youtube.com',
    name: 'SOCS',
    value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
    domain: '.youtube.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  },
  {
    url: 'https://www.youtube.com',
    name: 'PREF',
    value: 'tz=UTC',
    domain: '.youtube.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  },
  {
    url: 'https://www.google.com',
    name: 'CONSENT',
    value: 'PENDING+987',
    domain: '.google.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  },
  {
    url: 'https://www.google.com',
    name: 'SOCS',
    value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
    domain: '.google.com',
    path: '/',
    secure: true,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60
  }
];

// ──────────────────────────────────────────────────────────
// Cookie Injection
// ──────────────────────────────────────────────────────────

async function ensureConsentCookies() {
  for (const spec of REQUIRED_COOKIES) {
    try {
      const existing = await chrome.cookies.get({ url: spec.url, name: spec.name });
      if (!existing || !existing.value) {
        await chrome.cookies.set(spec);
        console.log('[YT No Sign-in] Set cookie:', spec.name, 'on', spec.domain);
      }
    } catch (err) {
      console.warn('[YT No Sign-in] Cookie error:', spec.name, err.message);
    }
  }
}

// Set cookies on install and browser startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[YT No Sign-in] Installed — setting consent cookies');
  ensureConsentCookies();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[YT No Sign-in] Startup — refreshing consent cookies');
  ensureConsentCookies();
});

// Refresh cookies whenever a YouTube page finishes loading
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  try {
    const url = new URL(details.url);
    if (url.hostname.includes('youtube.com')) {
      await ensureConsentCookies();
    }
  } catch (e) {}
});

// ──────────────────────────────────────────────────────────
// Message Relay
// ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ensureCookies') {
    ensureConsentCookies().then(() => sendResponse({ ok: true }));
    return true; // keep channel open for async response
  }
  if (message.action === 'getStatus') {
    sendResponse({ version: chrome.runtime.getManifest().version, active: true });
  }
  if (message.action === 'logRestriction') {
    console.log('[YT No Sign-in] Restriction:', message.detail);
  }
  return false;
});
