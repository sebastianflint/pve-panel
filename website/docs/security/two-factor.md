---
title: Two-factor authentication
sidebar_position: 2
---

Every account can use two-factor authentication with an authenticator app
(Google Authenticator, Microsoft Authenticator, Authy, 1Password …). Signing in
then takes the password and a 6-digit code, in both the customer panel and the
admin interface.

- **Customers turn it on themselves** under **Account** (click the email at the
  bottom of the sidebar): scan the QR code, enter a first code, save the 10
  recovery codes. Admins do the same under **Your account** in the admin interface.
- **Requiring it:** when adding a user, tick "Require two-factor authentication",
  or change it later with the **2FA** button in the Customers tab. A user who
  hasn't set it up yet has to do so at the next sign-in, before anything else,
  and can't switch it off.
- **Lost phone:** the user signs in with a recovery code (each works once) and
  can create new codes under Account. If the codes are gone too, reset it with
  the **2FA** button (Reset); if it's required, they set it up again at the next
  sign-in. Confirm who is asking before resetting.
- **Locked out yourself:** on the panel host run
  `npm run user:reset-2fa -- admin@example.com`. `npm run user:create` accepts
  `--require-2fa`.

Details: codes follow TOTP (RFC 6238, SHA-1, 6 digits, 30 seconds), accepted one
step early or late for clock drift, and each code works only once. Secrets are
stored AES-256-GCM encrypted, recovery codes only as SHA-256 hashes. The second
sign-in step is rate-limited and expires after 5 minutes.

Two things to know:
- **Keep the panel host's clock right** (NTP; Windows does this by default).
  Codes depend on the time; a clock more than about a minute off rejects them.
- **The encryption key is derived from `JWT_SECRET`.** Changing `JWT_SECRET`
  makes existing 2FA setups unreadable; reset the affected users afterwards.
