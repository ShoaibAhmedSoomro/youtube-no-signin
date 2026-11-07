# YouTube No Sign-in

A one-switch Chrome extension that opens YouTube as a **logged-out visitor**, even when your browser is signed in to a Google account that YouTube refuses to serve.

## The problem it solves

When the Google account signed in to Chrome is flagged, YouTube redirects every link to
`youtube.com/oops` with *"Can't create new account because of past account issues."*
The cause is the login session YouTube receives with each request.

## How it works

1. **Cookie rewrite** (`ext/rules.json`): a `declarativeNetRequest` rule replaces the `Cookie` header on every `youtube.com` request with consent-only cookies (`CONSENT`, `SOCS`, `PREF`). YouTube never sees your Google login, so there is no account to reject. The popup switch enables or disables this rule.
2. **Consent cookies** (`ext/background.js`): keeps the consent cookies present on install, startup and YouTube navigation.
3. **Page cleanup** (`ext/content.js`): hides sign-in prompts and banners, and falls back to the embed player when `/oops`, `/signin` or a playability error blocks a video.

## Install

1. `git clone https://github.com/ShoaibAhmedSoomro/youtube-no-signin.git`
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the `ext/` folder.
3. Open the extension popup and make sure the switch is on (red). Open any YouTube link.

## Limits

- You always appear logged out on YouTube while the switch is on: no subscriptions, history or comments.
- If the block is tied to your IP address or device rather than your account, this will not help.
- Chrome and other Chromium browsers only (Manifest V3).

## Development

```bash
npm install
npm test        # Vitest + jsdom
```

```
ext/            the extension (load this folder)
  background.js   service worker: consent cookies
  content.js      page script: prompt cleanup, /oops fallback
  popup.html/js   the switch
  rules.json      Cookie-header rewrite rule
tests/          unit and property tests
logos/          logo concepts and exports
```

## Credits

Built by [Shoaib Ahmed Soomro](https://github.com/ShoaibAhmedSoomro).

Not affiliated with YouTube or Google.
