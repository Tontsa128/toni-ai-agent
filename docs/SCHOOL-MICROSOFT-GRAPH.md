# School / Microsoft 365 integration

The agent can use a user-authenticated Microsoft Graph access token supplied by the host process to read school classes and assignments.

## Safety model

- The model never receives or supplies the access token.
- The adapter does not log the token or persist it in project memory.
- The current adapter is read-only: classes and assignments can be inspected, but nothing is posted or submitted.
- Writing, messaging and assignment submission remain approval-gated capabilities in the central permission layer.
- MFA, CAPTCHA, tenant restrictions and other account controls are never bypassed.
- The assistant should follow the school's rules for AI-assisted work.

## Local configuration

Set the token only in the local process environment, for example `MICROSOFT_GRAPH_ACCESS_TOKEN`. Do not commit it to `.env`, Git, logs or memory. A future OAuth host should acquire short-lived user consented tokens without exposing refresh tokens to the model.

## Current read capabilities

- list education classes;
- list assignments for a class;
- read one assignment.

The Graph API surface is intentionally kept small until the approval and tenant-permission model for write operations is implemented and tested.
