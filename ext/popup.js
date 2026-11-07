// The switch enables/disables the cookie-replacing ruleset (rules.json). Chrome persists that state.
const RULESET = 'logged_out_cookies';
const power = document.getElementById('power');
const state = document.getElementById('state');
const detail = document.getElementById('detail');

function render(on) {
  power.setAttribute('aria-checked', String(on));
  state.textContent = on ? 'Signed-out mode on' : 'Signed-out mode off';
  detail.textContent = on ? 'YouTube sees a logged-out visitor.' : 'YouTube sees your Google account.';
}

async function isOn() {
  return (await chrome.declarativeNetRequest.getEnabledRulesets()).includes(RULESET);
}

async function toggle() {
  const on = power.getAttribute('aria-checked') !== 'true';
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(
      on ? { enableRulesetIds: [RULESET] } : { disableRulesetIds: [RULESET] }
    );
    render(on);
    // New cookie behavior only applies to new requests: reload the active YouTube tab.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https:\/\/([\w-]+\.)?youtube\.com\//.test(tab.url || '')) chrome.tabs.reload(tab.id);
  } catch (err) {
    detail.textContent = 'Could not switch. Reload the extension.';
    console.error('[YT No Sign-in]', err);
  }
}

power.addEventListener('click', toggle);
isOn().then(render).catch(err => {
  detail.textContent = 'Could not read state.';
  console.error('[YT No Sign-in]', err);
});
