# Toni AI Agent architecture

## Core loop

`request -> inspect -> plan -> permission check -> execute -> verify -> remember`

The agent must not skip inspection or verification for convenience.

## Modes

- `coding`: repositories, VS Code workspaces, terminal, tests, Git and deployment preparation.
- `school`: assignments, learning materials, explanations, drafts and answer review.
- `research`: source gathering, comparison, evidence and summaries.
- `computer`: browser and desktop automation through approved tools.

## Tool contract

Every tool must declare:

- name
- operation
- input schema
- output schema
- risk level
- whether it can modify external state
- whether approval is required

The orchestrator evaluates every action before execution.

## Memory

The agent should remember project state, decisions, failed attempts and user-approved preferences. Secrets, passwords, access tokens and sensitive school credentials must never be stored in memory.

Memory entries should have a source, timestamp, scope and confidence. Project memory belongs to the project; global preferences belong to the agent profile.

## Model provider

The model layer is deliberately provider-agnostic. An OpenAI adapter can use the Responses API and tool/function calling. Keep API keys only in local environment variables or a secret manager; never in Git.

The model is the reasoning layer, not the permission layer. A model request can propose an action, but the local permission engine decides whether it can execute.
