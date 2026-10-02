---
title: Email and invitations
sidebar_position: 2
---

Email is set up in the admin interface under **Settings** (stored in the database,
not in `.env`): SMTP server, port, encryption, username, password, sender, and the
customer panel's address for links. **Send test email** checks connection,
encryption, sign-in and delivery at once and shows the mail server's answer on
failure.

- **Encryption:** TLS (usually port 465) or STARTTLS (usually 587); certificates are
  always verified and at least TLS 1.2 is required. "None" is only for a relay inside
  your own network; with a username set, the panel warns that the password would
  travel unencrypted.
- **The SMTP password** is stored AES-256-GCM encrypted with a key derived from
  `JWT_SECRET` and is never sent back to the browser. Leave the field empty to keep
  it. After changing `JWT_SECRET`, enter it again.
- **Invitations:** with email configured, **Add a customer → Send an invitation email**
  creates the account without a password and emails the panel address, the
  sign-in email and a one-time link to set a password (plus a note about required
  2FA or single sign-on). The link works once, expires after 3 days, is stored only
  as a SHA-256 hash, and carries its token after `#` so it never appears in server
  logs. **Resend invitation** in the list replaces the link. If sending fails when
  creating the user, the account still exists; fix the settings and resend.
- **Single sign-on only** (`PASSWORD_LOGIN_CUSTOMER=false`): the invitation contains
  no password link, only the panel address and how to sign in with single sign-on.
- Setting a password yourself via **Reset password** cancels a pending invitation.
