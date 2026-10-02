---
title: AI-assisted development
sidebar_position: 1
---

PVE Panel was built with substantial help from an AI assistant (**Claude by Anthropic**). To be transparent about what that means:

**Created with AI assistance**

- most of the source code (backend, customer and admin portals, scripts)
- the Docker, Compose and GitHub Actions setup
- the documentation: the README and this documentation website
- automated tests during development, largely against simulated Proxmox, guest-agent, SMTP and WireGuard environments and a certified test OpenID provider
- the screenshots, taken from such a test environment with sample data

**Done by the maintainer**

- defining the requirements and deciding on features and design
- running and testing the panel against a real Proxmox VE environment and reporting problems, which were then fixed
- publishing, versioning and operating the project

**What this means for you**

- An automated test suite (unit, API and browser tests) runs on every change, and releases are only published when it passes. It runs against a **simulated** Proxmox, so it can't replace validating your own environment — see [Tests and quality](../reference/testing.md).
- Not every feature has been tested in every real-world combination — especially provider-specific setups (OIDC providers, mail servers, NAS models, Windows editions).
- AI-generated code can contain mistakes, including security-relevant ones. Review the code and the [security model](../security/security-model.md) before using PVE Panel in production, and validate customer isolation yourself (see [Recommended validation](../security/security-model.md)).
- Issues and pull requests are reviewed and handled by the maintainer.
