import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import fc from 'fast-check';
import { loadContentScript, makeElement, makeSignInElement } from './helpers.js';

describe('YouTube No Sign-in Content Script', () => {
  let dom;
  let api;

  beforeEach(() => {
    // Set up a clean JSDOM instance before each test
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.youtube.com/',
      runScripts: 'dangerously'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.Node = dom.window.Node;
    global.MutationObserver = dom.window.MutationObserver;
    
    // Load content script inside the JSDOM context
    api = loadContentScript(dom);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- UNIT TESTS ---

  describe('restoreScroll', () => {
    it('removes overflow: hidden from body and documentElement', () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      api.restoreScroll();

      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
    });
  });

  describe('dismissElement', () => {
    it('removes element from DOM successfully', () => {
      const container = document.createElement('div');
      const child = document.createElement('div');
      container.appendChild(child);
      document.body.appendChild(container);

      api.dismissElement(child);

      expect(container.contains(child)).toBe(false);
    });

    it('applies style hiding if removeChild throws', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);

      // Mock node parent removeChild to throw
      Object.defineProperty(el, 'parentNode', {
        get() {
          return {
            removeChild() {
              throw new Error('Mock remove child error');
            }
          };
        }
      });

      api.dismissElement(el);

      expect(el.style.visibility).toBe('hidden');
      expect(el.style.display).toBe('none');
      expect(el.style.pointerEvents).toBe('none');
    });
  });

  describe('containsAccountKeyword', () => {
    it('identifies text containing account keywords', () => {
      expect(api.containsAccountKeyword("This content is age-restricted")).toBe(true);
      expect(api.containsAccountKeyword("You need to confirm your age")).toBe(true);
      expect(api.containsAccountKeyword("account suspended for review")).toBe(true);
    });

    it('returns false for unrelated text', () => {
      expect(api.containsAccountKeyword("Watch this cool funny cat video!")).toBe(false);
      expect(api.containsAccountKeyword("")).toBe(false);
    });
  });

  describe('checkBrowserVersion', () => {
    it('returns true for Chrome versions >= 114', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      );
      expect(api.checkBrowserVersion()).toBe(true);
    });

    it('returns false for Chrome versions < 114', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
      );
      expect(api.checkBrowserVersion()).toBe(false);
    });

    it('returns true for Firefox versions >= 115', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0'
      );
      expect(api.checkBrowserVersion()).toBe(true);
    });

    it('returns false for Firefox versions < 115', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:114.0) Gecko/20100101 Firefox/114.0'
      );
      expect(api.checkBrowserVersion()).toBe(false);
    });
  });

  describe('showFallbackNotification', () => {
    it('creates a toast notification and auto-removes it after 5 seconds', () => {
      vi.useFakeTimers();
      
      api.showFallbackNotification('Playback restricted');
      
      const toast = document.getElementById('yt-no-signin-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toContain('Playback restricted');

      // Fast forward time
      vi.advanceTimersByTime(5000);

      const toastAfter = document.getElementById('yt-no-signin-toast');
      expect(toastAfter).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe('scanAndSuppress', () => {
    it('dismisses elements that match selectors', () => {
      const signinRenderer = document.createElement('ytd-signin-renderer');
      document.body.appendChild(signinRenderer);
      
      api.scanAndSuppress();

      expect(document.body.contains(signinRenderer)).toBe(false);
    });

    it('dismisses elements whose text contains keywords and matches prompt heuristics', () => {
      const modal = document.createElement('div');
      modal.className = 'yt-confirm-dialog-renderer';
      modal.textContent = 'Account suspended due to policy violation.';
      document.body.appendChild(modal);

      api.scanAndSuppress();

      expect(document.body.contains(modal)).toBe(false);
    });

    it('does not remove page-level wrappers that merely contain a keyword somewhere', () => {
      const app = document.createElement('ytd-app');
      app.innerHTML = '<p>Comment: my account recovery worked!</p>' + 'x'.repeat(2000);
      document.body.appendChild(app);

      api.scanAndSuppress();

      expect(document.body.contains(app)).toBe(true);
    });
  });

  describe('MutationObserver integration', () => {
    it('automatically dismisses dynamically injected sign-in elements', async () => {
      const observer = api.setupObserver();
      
      const signin = document.createElement('ytd-signin-renderer');
      document.body.appendChild(signin);

      // Wait for mutation observer tick
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.body.contains(signin)).toBe(false);
      
      if (observer) observer.disconnect();
    });
  });

  describe('SPA Navigation', () => {
    it('disconnects previous observer and triggers a scan on yt-navigate-finish', () => {
      const initialObserver = api.getObserverInstance();
      const disconnectSpy = vi.spyOn(initialObserver, 'disconnect');

      const el = document.createElement('ytd-signin-renderer');
      document.body.appendChild(el);

      const event = new dom.window.CustomEvent('yt-navigate-finish');
      dom.window.document.dispatchEvent(event);

      expect(disconnectSpy).toHaveBeenCalled();
      expect(document.body.contains(el)).toBe(false);
    });
  });

  describe('Playability Error and Oops Page Bypasses', () => {
    it('extractVideoId extracts video ID correctly', () => {
      expect(api.extractVideoId('https://www.youtube.com/watch?v=12345')).toBe('12345');
      expect(api.extractVideoId('https://youtu.be/abcde')).toBe('abcde');
      expect(api.extractVideoId('https://www.youtube.com/feed/trending')).toBeNull();
    });

    it('checkAndBypassOops replaces document with embed player when video ID is in session storage', () => {
      dom.reconfigure({ url: 'https://www.youtube.com/oops' });

      dom.window.sessionStorage.setItem('yt_last_video_id', 'oopsVideoId123');

      const result = api.checkAndBypassOops();

      expect(result).toBe(true);
      const iframe = dom.window.document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe.src).toContain('youtube.com/embed/oopsVideoId123');
    });

    it('handlePlayabilityError replaces error element container with inline iframe player', () => {
      dom.reconfigure({ url: 'https://www.youtube.com/watch?v=inlineVideoId456' });

      const playerContainer = document.createElement('ytd-player');
      playerContainer.id = 'ytd-player';
      
      const errorRenderer = document.createElement('ytd-playability-error-system-renderer');
      playerContainer.appendChild(errorRenderer);
      document.body.appendChild(playerContainer);

      api.handlePlayabilityError(errorRenderer);

      const iframe = playerContainer.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe.src).toContain('youtube.com/embed/inlineVideoId456');
      expect(playerContainer.contains(errorRenderer)).toBe(false);
    });
  });

  // --- PROPERTY-BASED TESTS ---

  describe('Property-Based Tests', () => {
    
    it('Property 1: overlay dismissal removes or fully hides the element', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 20 }), // tag name
          fc.boolean(), // should throw on removeChild
          (tagName, shouldThrow) => {
            // Clean DOM element setup
            const cleanTag = tagName.replace(/[^a-zA-Z]/g, 'a') || 'div';
            const el = document.createElement(cleanTag);
            document.body.appendChild(el);

            if (shouldThrow) {
              Object.defineProperty(el, 'parentNode', {
                get() {
                  return {
                    removeChild() {
                      throw new Error();
                    }
                  };
                }
              });
            }

            api.dismissElement(el);

            const isRemoved = !document.body.contains(el);
            const isHidden =
              el.style.visibility === 'hidden' &&
              el.style.display === 'none' &&
              el.style.pointerEvents === 'none';

            return isRemoved || isHidden;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: dismissal restores scroll', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // body has overflow hidden
          fc.boolean(), // html has overflow hidden
          (bodyHidden, htmlHidden) => {
            if (bodyHidden) document.body.style.overflow = 'hidden';
            if (htmlHidden) document.documentElement.style.overflow = 'hidden';

            const el = document.createElement('div');
            document.body.appendChild(el);

            api.dismissElement(el);

            const bodyRestored = document.body.style.overflow !== 'hidden';
            const htmlRestored = document.documentElement.style.overflow !== 'hidden';

            return bodyRestored && htmlRestored;
          }
        ),
        { numRuns: 100 }
      );
    });

    function createElementForSelector(selector) {
      if (selector === '.ytd-watch-next-secondary-results-renderer ytd-compact-promoted-video-renderer') {
        const parent = document.createElement('div');
        parent.className = 'ytd-watch-next-secondary-results-renderer';
        const child = document.createElement('ytd-compact-promoted-video-renderer');
        parent.appendChild(child);
        return { root: parent, target: child };
      }
      const el = makeSignInElement(selector);
      return { root: el, target: el };
    }

    it('Property 3: observer detects and suppresses dynamically injected sign-in elements', async () => {
      const observer = api.setupObserver();

      // Test PBT logic by inserting matching elements dynamically
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...api.SIGN_IN_SELECTORS),
          async (selector) => {
            const { root, target } = createElementForSelector(selector);
            document.body.appendChild(root);
            
            await new Promise(resolve => setTimeout(resolve, 0));
            const success = !document.body.contains(target) || target.style.display === 'none' || root.style.display === 'none';
            if (root.parentNode) root.parentNode.removeChild(root);
            return success;
          }
        ),
        { numRuns: 100 }
      );

      if (observer) observer.disconnect();
    });

    it('Property 6: SPA navigation triggers re-scan', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...api.SIGN_IN_SELECTORS),
          (selector) => {
            const { root, target } = createElementForSelector(selector);
            document.body.appendChild(root);
            
            const event = new dom.window.CustomEvent('yt-navigate-finish');
            dom.window.document.dispatchEvent(event);

            const success = !document.body.contains(target) || target.style.display === 'none' || root.style.display === 'none';
            if (root.parentNode) root.parentNode.removeChild(root);
            return success;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 7: keyword matcher correctly classifies text', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (arbitraryString) => {
            const result = api.containsAccountKeyword(arbitraryString);
            
            const lowerStr = arbitraryString.toLowerCase();
            const containsAnyKeyword = api.ACCOUNT_KEYWORDS.some(k => lowerStr.includes(k));

            return result === containsAnyKeyword;
          }
        ),
        { numRuns: 100 }
      );
    });

  });
});
