// Passkeys in the browser: sign-in, and the "Passkeys" card on the account page.
// Uses @simplewebauthn/browser (served by the panel under /vendor/webauthn/).

import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '/vendor/webauthn/index.js';
import { api, esc, toast, fail, confirmAction, promptText } from '/shared/ui.js';

/** Can this browser use passkeys here (needs WebAuthn and a secure context)? */
export const passkeysSupported = () => window.isSecureContext && browserSupportsWebAuthn();

// The browser's own messages for "cancelled" or "timed out" are not helpful to show.
function friendly(err, action) {
  if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return null; // user cancelled
  if (err?.name === 'InvalidStateError') return 'This device already has a passkey for your account.';
  if (err?.name === 'SecurityError') return 'Passkeys need the panel to be opened by its domain name over https.';
  return `The passkey couldn't ${action}: ${err?.message ?? err}`;
}

/** Sign-in with a passkey; resolves with the signed-in account, or null if cancelled. */
export async function signInWithPasskey() {
  const { options, key } = await api('/api/auth/passkey/options', { method: 'POST' });
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options });
  } catch (err) {
    const msg = friendly(err, 'be used');
    if (msg) throw new Error(msg);
    return null;
  }
  return api('/api/auth/passkey/verify', { method: 'POST', body: { key, response } });
}

// A sensible default name, e.g. "Windows", "iPhone", "Mac"
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Passkey';
}

async function addPasskey(container) {
  let opts = await api('/api/account/passkeys/options', { method: 'POST', body: {} }).catch((e) => e);
  if (opts instanceof Error) {
    if (!/password/i.test(opts.message)) return fail(opts);
    const password = await promptText('Confirm with your password to add a passkey.', {
      type: 'password', okLabel: 'Continue', minLength: 1,
      hint: 'You signed in a while ago. This makes sure it is really you.',
    });
    if (!password) return;
    try { opts = await api('/api/account/passkeys/options', { method: 'POST', body: { password } }); } catch (err) { return fail(err); }
  }
  let response;
  try {
    response = await startRegistration({ optionsJSON: opts.options });
  } catch (err) {
    const msg = friendly(err, 'be created');
    if (msg) toast(msg, 'error');
    return;
  }
  const name = await promptText('Name this passkey', {
    value: deviceName(), okLabel: 'Save', minLength: 1,
    hint: 'So you can tell your passkeys apart, e.g. "Laptop" or "YubiKey".',
  });
  try {
    const added = await api('/api/account/passkeys', { method: 'POST', body: { key: opts.key, response, name: name || deviceName() } });
    toast(`Passkey “${added.name}” added. Next time, choose “Sign in with a passkey”.`);
    renderPasskeys(container);
  } catch (err) { fail(err); }
}

const when = (d) => (d ? new Date(`${d.replace(' ', 'T')}Z`).toLocaleDateString() : 'never');

/** The "Passkeys" card on the account page. */
export async function renderPasskeys(container) {
  let data;
  try { data = await api('/api/account/passkeys'); } catch (err) { container.innerHTML = ''; return fail(err); }
  const usable = data.available && passkeysSupported();
  const list = data.passkeys;

  container.innerHTML = `
    <section class="security-card passkeys-card">
      <div>
        <h2 class="twofa-title">Passkeys ${list.length ? `<span class="pill pill-running">${list.length}</span>` : '<span class="pill">None</span>'}</h2>
        <p class="muted">Sign in with your fingerprint, face, device PIN or a security key instead of a password and code.
          Passkeys can't be phished: they only work on this panel's address.</p>
        ${!data.available ? '<p class="small warn-text">Passkeys need the panel to be opened by its domain name over https (or on localhost).</p>'
          : !passkeysSupported() ? '<p class="small warn-text">This browser can’t use passkeys here.</p>' : ''}
        ${list.length ? `
          <ul class="passkey-list">
            ${list.map((p) => `
              <li data-passkey="${esc(p.id)}">
                <div>
                  <strong>${esc(p.name)}</strong>
                  <span class="muted small">${p.synced ? 'Synced passkey' : 'This device or security key'} · added ${esc(when(p.createdAt))} · last used ${esc(when(p.lastUsedAt))}</span>
                </div>
                <div class="row">
                  <button class="btn ghost" data-rename-passkey>Rename</button>
                  <button class="btn danger" data-remove-passkey>Remove</button>
                </div>
              </li>`).join('')}
          </ul>` : ''}
      </div>
      <div class="row"><button class="btn primary" data-add-passkey ${usable ? '' : 'disabled'}>Add a passkey</button></div>
    </section>`;

  container.querySelector('[data-add-passkey]').onclick = () => addPasskey(container);
  container.querySelectorAll('[data-passkey]').forEach((li) => {
    const id = li.dataset.passkey;
    const p = list.find((x) => x.id === id);
    li.querySelector('[data-rename-passkey]').onclick = async () => {
      const name = await promptText('New name for this passkey', { value: p.name, minLength: 1 });
      if (!name) return;
      try { await api(`/api/account/passkeys/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } }); renderPasskeys(container); } catch (err) { fail(err); }
    };
    li.querySelector('[data-remove-passkey]').onclick = async () => {
      if (!(await confirmAction(`Remove the passkey “${p.name}”? You can no longer sign in with it.`, 'Remove'))) return;
      try { await api(`/api/account/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }); toast('Passkey removed'); renderPasskeys(container); } catch (err) { fail(err); }
    };
  });
}
