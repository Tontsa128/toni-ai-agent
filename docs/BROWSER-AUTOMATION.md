# Browser automation

The first concrete browser adapter uses Playwright with a persistent, isolated browser profile.

Rules:

- the user owns the authenticated session;
- passwords, cookies and MFA codes are not copied into agent memory;
- navigation is limited to HTTP(S);
- reads can be automated, while writes/submissions remain approval-gated by the central supervisor;
- MFA/CAPTCHA and tenant/access controls are never bypassed.

Install browser binaries locally with the Playwright installation command appropriate for the development environment before enabling the adapter.
