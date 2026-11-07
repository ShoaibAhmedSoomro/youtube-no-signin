(function () {
  'use strict';

  // 1. Selector Registry
  const SIGN_IN_SELECTORS = [
    'ytd-signin-renderer',
    'ytd-account-end-screen-renderer',
    '#sign-in-prompt',
    'tp-yt-paper-dialog[aria-label*="sign"]',
    'yt-upsell-dialog-renderer',
    'ytd-banner-promo-renderer',
    '#masthead-ad',
    'ytd-statement-banner-renderer',
    'ytd-mealbar-promo-renderer',
    'ytd-age-gate-renderer',
    '.ytd-watch-next-secondary-results-renderer ytd-compact-promoted-video-renderer',
    'ytd-account-recovery-renderer',
    '#error-screen',
    'yt-confirm-dialog-renderer'
  ];

  const PLAYABILITY_ERROR_SELECTORS = [
    'ytd-playability-error-system-renderer',
    'ytd-player-error-wrapper',
    '.yt-playability-error-supported-renderers',
    '#error-screen'
  ];

  // 2. Keyword Registry
  const ACCOUNT_KEYWORDS = [
    "can't create new account",
    "past account issues",
    "account eligibility",
    "account recovery",
    "account suspended",
    "account restriction",
    "sign in to confirm",
    "confirm your age",
    "this content is age-restricted"
  ];

  let currentObserver = null;

  // 3. Helper Functions
  function restoreScroll() {
    if (document.body && document.body.style) {
      document.body.style.removeProperty('overflow');
    }
    if (document.documentElement && document.documentElement.style) {
      document.documentElement.style.removeProperty('overflow');
    }
  }

  function dismissElement(el) {
    if (!el) return;
    try {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
      if (document.body.contains(el)) {
        // Fallback style hiding if removeChild was not completely successful or did not remove it from the document
        applyFallbackStyles(el);
      }
    } catch (e) {
      applyFallbackStyles(el);
    }
    restoreScroll();
  }

  function applyFallbackStyles(el) {
    if (el && el.style) {
      el.style.visibility = 'hidden';
      el.style.display = 'none';
      el.style.setProperty('pointer-events', 'none', 'important');
    }
  }

  function containsAccountKeyword(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return ACCOUNT_KEYWORDS.some(keyword => lower.includes(keyword));
  }

  const PROMPT_NAME_RE = /dialog|modal|overlay|prompt|banner|alert|renderer|popup/i;
  // A real prompt has little text; page-level wrappers (ytd-app, #content) hold the whole page.
  // shortcut: length cap is a heuristic, tune if a legitimate prompt exceeds it.
  const MAX_PROMPT_TEXT = 1000;

  function isPromptLike(el) {
    return el.tagName.includes('-') ||
      PROMPT_NAME_RE.test(el.className || '') ||
      PROMPT_NAME_RE.test(el.id || '') ||
      el.getAttribute('role') === 'dialog' ||
      el.parentElement === document.body;
  }

  function dismissKeywordPrompts(elements) {
    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style') return;
      const text = el.textContent || '';
      if (text.length <= MAX_PROMPT_TEXT && containsAccountKeyword(text) && isPromptLike(el)) {
        dismissElement(el);
      }
    });
  }

  function extractVideoId(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.hostname === 'youtu.be') {
        return parsed.pathname.substring(1);
      }
    } catch (e) {}
    return null;
  }

  function storeCurrentVideoId() {
    const videoId = extractVideoId(window.location.href);
    if (videoId) {
      try { sessionStorage.setItem('yt_last_video_id', videoId); } catch (e) {}
    }
  }

  // Ask the background script to ensure consent cookies are set
  function requestCookieInjection() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'ensureCookies' }, () => {
          // Swallow any errors from closed channels
          if (chrome.runtime.lastError) { /* expected */ }
        });
      }
    } catch (e) { /* extension context may be invalid */ }
  }

  function renderFullscreenIframe(videoId) {
    document.documentElement.innerHTML = '';
    document.title = 'YouTube Player Bypass';
    
    const body = document.createElement('body');
    body.style.cssText = 'margin: 0; padding: 0; background: #000; width: 100vw; height: 100vh; overflow: hidden;';
    
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', 'true');
    
    body.appendChild(iframe);
    document.documentElement.appendChild(body);
  }

  function checkAndBypassOops() {
    const path = window.location.pathname;
    if (path !== '/oops' && !path.includes('/signin')) {
      return false;
    }

    // Request cookie injection immediately
    requestCookieInjection();

    // Try to find a video ID to play
    let videoId = null;
    try { videoId = sessionStorage.getItem('yt_last_video_id'); } catch (e) {}
    if (!videoId && document.referrer) {
      videoId = extractVideoId(document.referrer);
    }

    if (videoId) {
      // If we have a video, render fullscreen embed
      renderFullscreenIframe(videoId);
    } else {
      // No video context: go home once (flag prevents a redirect loop if /oops persists)
      try {
        if (sessionStorage.getItem('yt_oops_home')) return true;
        sessionStorage.setItem('yt_oops_home', '1');
      } catch (e) {}
      window.location.replace('https://www.youtube.com/');
    }
    return true;
  }

  function handlePlayabilityError(el) {
    if (!el) return;
    const videoId = extractVideoId(window.location.href) || sessionStorage.getItem('yt_last_video_id');
    if (!videoId) return;

    const container = el.closest('ytd-player') || 
                      document.getElementById('player-container') || 
                      document.getElementById('ytd-player') ||
                      el.parentElement;
                      
    if (container) {
      if (container.querySelector('.yt-no-signin-injected-iframe')) {
        return;
      }
      
      const iframe = document.createElement('iframe');
      iframe.className = 'yt-no-signin-injected-iframe';
      iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; min-height: 360px;';
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', 'true');
      
      container.innerHTML = '';
      container.appendChild(iframe);
    }
  }

  function checkAndReplacePlayabilityErrors(root = document) {
    if (window.location.pathname !== '/watch') return;
    PLAYABILITY_ERROR_SELECTORS.forEach(selector => {
      try {
        const elements = root.querySelectorAll ? root.querySelectorAll(selector) : [];
        elements.forEach(el => handlePlayabilityError(el));
      } catch (e) {}
    });
  }

  // 5. Scanners & Observer Logic
  function scanAndSuppress() {
    // 1. Selector match scan
    SIGN_IN_SELECTORS.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          dismissElement(el);
        });
      } catch (e) {
        // Fail silent, continue scanning other selectors
      }
    });

    // 2. Keyword scan
    try {
      dismissKeywordPrompts(document.querySelectorAll('body *'));
    } catch (e) {
      // Fail silent
    }

    // 3. Playability error scan
    checkAndReplacePlayabilityErrors();
  }

  function setupObserver() {
    if (!document.body) {
      // If DOM is not fully ready, retry on DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => {
        if (!currentObserver) {
          currentObserver = setupObserver();
        }
      });
      return null;
    }

    const observer = new MutationObserver(mutations => {
      try {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 1. Check if node itself matches or has matching descendants
              SIGN_IN_SELECTORS.forEach(selector => {
                if (node.matches && node.matches(selector)) {
                  dismissElement(node);
                } else {
                  const descendants = node.querySelectorAll ? node.querySelectorAll(selector) : [];
                  descendants.forEach(el => dismissElement(el));
                }
              });

              // 2. Check for keyword matches in new element and its descendants
              if (containsAccountKeyword(node.textContent || '')) {
                dismissKeywordPrompts([node, ...node.querySelectorAll('*')]);
              }
              // 3. Check for playability errors in added nodes
              if (window.location.pathname === '/watch') {
                PLAYABILITY_ERROR_SELECTORS.forEach(selector => {
                  if (node.matches && node.matches(selector)) {
                    handlePlayabilityError(node);
                  } else {
                    const descendants = node.querySelectorAll ? node.querySelectorAll(selector) : [];
                    descendants.forEach(el => handlePlayabilityError(el));
                  }
                });
              }
            }
          });
        });
      } catch (e) {
        // Fail silent, keep observer active
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  function handleSpaNavigation() {
    try {
      if (currentObserver) {
        currentObserver.disconnect();
      }
      storeCurrentVideoId();
      scanAndSuppress();
      currentObserver = setupObserver();
    } catch (e) {
      // Fail silent
    }
  }

  // 6. Notifications
  function showFallbackNotification(message) {
    if (!document.body) return;
    
    // Check if toast already exists
    let toast = document.getElementById('yt-no-signin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'yt-no-signin-toast';
      toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: rgba(33, 33, 33, 0.95);
        color: #fff;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: Roboto, Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        pointer-events: auto;
        transition: opacity 0.3s ease;
        border-left: 4px solid #ff0000;
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;
      
      const textNode = document.createElement('span');
      textNode.id = 'yt-no-signin-toast-text';
      toast.appendChild(textNode);

      const closeBtn = document.createElement('span');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = `
        margin-left: 16px;
        cursor: pointer;
        font-weight: bold;
        color: #aaa;
      `;
      closeBtn.onclick = () => toast.remove();
      toast.appendChild(closeBtn);

      document.body.appendChild(toast);
    }
    
    document.getElementById('yt-no-signin-toast-text').textContent = message;

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }

  // 7. Version Checker
  function checkBrowserVersion() {
    const ua = navigator.userAgent;
    
    // Regex matches
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    const firefoxMatch = ua.match(/Firefox\/(\d+)/);
    
    if (chromeMatch) {
      const chromeVer = parseInt(chromeMatch[1], 10);
      if (chromeVer < 114) {
        showFallbackNotification("Your Chrome browser version is not supported by YouTube No Sign-in.");
        return false;
      }
    } else if (firefoxMatch) {
      const firefoxVer = parseInt(firefoxMatch[1], 10);
      if (firefoxVer < 115) {
        showFallbackNotification("Your Firefox browser version is not supported by YouTube No Sign-in.");
        return false;
      }
    }
    return true;
  }

  // 9. History API Patching — catch SPA navigations to /oops
  function patchHistoryApi() {
    try {
      const origPushState = history.pushState;
      const origReplaceState = history.replaceState;

      history.pushState = function () {
        const result = origPushState.apply(this, arguments);
        if (window.location.pathname === '/oops') {
          checkAndBypassOops();
        }
        return result;
      };

      history.replaceState = function () {
        const result = origReplaceState.apply(this, arguments);
        if (window.location.pathname === '/oops') {
          checkAndBypassOops();
        }
        return result;
      };

      window.addEventListener('popstate', () => {
        if (window.location.pathname === '/oops') {
          checkAndBypassOops();
        }
      });
    } catch (e) { /* non-critical */ }
  }

  // 10. Main Entry Sequence
  function init() {
    if (!checkBrowserVersion()) {
      return;
    }

    // Always request cookie injection on page load
    requestCookieInjection();

    // Patch history API early to catch future /oops navigations
    patchHistoryApi();

    if (checkAndBypassOops()) {
      return;
    }
    storeCurrentVideoId();
    
    // scanAndSuppress and observer need document.body
    if (document.body) {
      scanAndSuppress();
      currentObserver = setupObserver();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        scanAndSuppress();
        currentObserver = setupObserver();
      });
    }
    
    document.addEventListener('yt-navigate-finish', handleSpaNavigation, { passive: true });
  }

  // Run init: at document_start body may not exist yet, so we handle both cases
  if (document.readyState === 'loading') {
    // Check for /oops and /signin immediately (doesn't need body)
    checkAndBypassOops();
    storeCurrentVideoId();
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose internals for JSDOM unit/property tests
  const exports = {
    SIGN_IN_SELECTORS,
    ACCOUNT_KEYWORDS,
    restoreScroll,
    dismissElement,
    containsAccountKeyword,
    scanAndSuppress,
    setupObserver,
    handleSpaNavigation,
    showFallbackNotification,
    checkBrowserVersion,
    getObserverInstance: () => currentObserver,
    PLAYABILITY_ERROR_SELECTORS,
    extractVideoId,
    storeCurrentVideoId,
    checkAndBypassOops,
    handlePlayabilityError,
    checkAndReplacePlayabilityErrors,
    requestCookieInjection
  };

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = exports;
  } else if (typeof window !== 'undefined') {
    window.__ytNoSignIn = exports;
  }
})();

