---
title: Single sign-on (OIDC)
sidebar_position: 3
---

Users can sign in with your identity provider (Microsoft Entra ID, Keycloak,
Authentik, Google Workspace, Okta …) through OpenID Connect, in addition to or
instead of passwords, separately for the customer panel and the admin interface.

How it's done (current best practice, OAuth 2.0 Security BCP RFC 9700 and
OpenID Connect Core), using the OpenID-certified `openid-client` library:

- Authorization Code flow with **PKCE (S256)**, `state` and `nonce`; nothing else.
- **Pushed Authorization Requests (PAR, RFC 9126)** automatically when the provider
  offers them (`OIDC_USE_PAR=auto`), so the request parameters never pass through
  the browser.
- Endpoints and signing keys from the provider's discovery document; the ID token
  is fully validated (signature, issuer, audience, expiry with 30 s tolerance,
  nonce), and the issuer in the response is checked when the provider sends it
  (RFC 9207). If the ID token has no email, it's fetched from UserInfo, which must
  belong to the same user (`sub`).
- Confidential client (client secret via HTTP Basic), exact callback URL per
  portal, login transaction in a 10-minute, single-use, httpOnly cookie.

**Accounts:** after the first single sign-on, an account is linked to the
provider's permanent user ID (issuer + `sub`), not to the email address. The first
link happens only by an email the provider marks as **verified**, optionally only
for `OIDC_ALLOWED_DOMAINS`. Unknown users are refused unless `OIDC_AUTO_CREATE=true`,
which creates them as customers without rights (you then grant limits). The admin
interface only accepts accounts that are administrators in the panel. The
Customers tab shows linked accounts (SSO tag); **Sign-in** lets you unlink one.

**2FA:** if the provider confirms a multi-factor sign-in (`amr` claim), the panel's
own 2FA step is skipped (`OIDC_TRUST_IDP_MFA`); otherwise users with panel 2FA
still enter their code.

**Setup:**

1. Register the panel as a web application ("confidential client") at your
   provider with these redirect (callback) URLs:
   - `https://panel.example.com/api/auth/oidc/callback` (customer panel)
   - `http://localhost:3001/api/auth/oidc/callback` (admin interface, if used; the
     URL must match how you open it, e.g. through your SSH tunnel)
   Allow the scopes `openid email profile`.
2. Set `OIDC_ENABLED=true`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
   `PANEL_PUBLIC_URL` and `ADMIN_PUBLIC_URL` in `.env`, and restart.
3. Test with one account, then optionally turn passwords off with
   `PASSWORD_LOGIN_CUSTOMER=false` and/or `PASSWORD_LOGIN_ADMIN=false`. The panel
   refuses to start if a portal would have no way to sign in. Keep password
   sign-in on the admin port at least until single sign-on works for you.

**Provider notes:**
- **Keycloak / Authentik:** issuer is the realm URL (Keycloak:
  `https://host/realms/<realm>`). Both send `email_verified`; Keycloak supports PAR.
- **Microsoft Entra ID:** issuer `https://login.microsoftonline.com/<tenant-id>/v2.0`.
  Entra doesn't send `email_verified`: set `OIDC_REQUIRE_VERIFIED_EMAIL=false`
  **together with** `OIDC_ALLOWED_DOMAINS` listing your own verified domains. Add
  the optional `email` claim in the app registration's token configuration.
- **Google:** issuer `https://accounts.google.com`; restrict with
  `OIDC_ALLOWED_DOMAINS` to your Workspace domain.

Sign-out ends the panel session only, not the session at the provider.

**Network:** only the **panel host → provider** direction is needed (outbound
HTTPS, port 443: discovery, signing keys, PAR, token and UserInfo endpoints). The
provider never connects to the panel; it only redirects the user's browser back.
So the provider does **not** need to reach the panel through your firewall.

**Troubleshooting:** the Activity tab records the exact reason of every failed
single sign-on.
- *"…couldn't be completed in this browser"* with the reason "the browser brought
  no sign-in cookie": the sign-in started under a different address than
  `PANEL_PUBLIC_URL` / `ADMIN_PUBLIC_URL` (IP instead of name, other port, tunnel).
  The sign-on button now always starts on the configured address, so open the
  panel under that address and it works. Other causes: cookies blocked in the
  browser, or `COOKIE_SECURE=true` on a plain-http address other than localhost
  (the panel warns about this at startup).
- *"Single sign-on is unavailable right now"*: the panel host can't reach the
  provider (firewall, DNS, proxy) or `OIDC_ISSUER` is wrong; the panel log has the
  details.
