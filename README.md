# Toni AI Agent

Personal AI agent platform for coding, school assistance, research and controlled computer automation.

## Vision

Toni AI is designed as a local-first assistant that can:

- help build and maintain software projects
- work with GitHub and VS Code
- read and analyse school assignments and learning materials
- help improve answers and explain subjects
- interact with Microsoft 365 through an authenticated browser session when permitted
- automate repetitive computer tasks
- require explicit approval before sensitive or consequential actions

## Safety model

### Green — automatic
- Read project files
- Analyse code
- Create or edit files inside the approved workspace
- Run safe tests and development commands
- Prepare drafts

### Yellow — approval required
- Install packages
- Delete files
- Run potentially destructive commands
- Modify files outside the approved workspace
- Send or upload content

### Red — always explicit approval
- Submit school assignments
- Send messages or emails
- Push/deploy production changes
- Change system settings
- Use administrator privileges
- Handle secrets, credentials or API keys

The agent must never bypass Microsoft 365 tenant policies, MFA, CAPTCHA, school access controls or other security controls.

## Planned modules

- `agent/` — orchestration, planning, approvals and memory
- `tools/` — filesystem, terminal, Git, GitHub and browser tools
- `school/` — assignments, learning materials and notes
- `projects/` — user projects managed by the agent
- `config/` — security and permission policies

## Development roadmap

1. Core agent and permission engine
2. Local workspace and terminal tools
3. Git/GitHub integration
4. School Assistant mode
5. Microsoft 365 browser workflow
6. Computer automation
7. Testing, audit logs and hardening

## Principle

**The AI can prepare and recommend. Toni decides before consequential actions happen.**
