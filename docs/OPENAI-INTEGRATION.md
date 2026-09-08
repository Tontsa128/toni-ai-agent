# Using OpenAI / ChatGPT as the reasoning layer

Toni AI Agent should treat the external model as a replaceable provider. The local agent remains responsible for permissions, filesystem boundaries, approvals, audit logs and secrets.

## Recommended flow

1. Collect only the context needed for the task.
2. Include the current project state, relevant files, previous attempts and constraints.
3. Send the request to the configured model provider.
4. If the model proposes a tool call, validate it locally against `config/permissions.json`.
5. Execute only allowed actions.
6. For approval-required actions, show Toni exactly what will happen and wait for approval.
7. Return tool results to the model.
8. Repeat until the task is complete or the model asks for clarification.
9. Run verification and record the result.

## Context packet

The minimum useful packet is:

- user request
- current mode
- workspace/project identifier
- relevant file paths and excerpts
- current errors/logs
- previous attempts and what failed
- constraints and acceptance criteria
- tool results already obtained

Do not send unrelated personal data, credentials, access tokens or complete school-account contents when a smaller excerpt is enough.

## API key

Set `OPENAI_API_KEY` only in the local environment. Do not paste it into source code, README files, GitHub issues or chat messages. Use the official OpenAI SDK/API documentation when implementing the provider adapter because model and API details change over time.

## Model choice

Keep `OPENAI_MODEL` configurable. The repository currently uses `gpt-5.6-luna` as the example default for cost-sensitive workloads; change it without modifying the agent architecture.

## Important boundary

The agent must never claim that a model response is an executed action. It must distinguish clearly between:

- suggestion
- planned action
- approved action
- executed action
- verified result
