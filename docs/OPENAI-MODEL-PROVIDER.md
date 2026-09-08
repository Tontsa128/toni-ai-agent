# Model provider

Toni AI Agent uses the OpenAI SDK and Responses API as the model boundary. The model may propose tool calls, but the agent supervisor and permission engine remain authoritative; model output never grants itself permission.

Configure locally:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

Never commit `.env`, API keys, passwords, MFA codes or session cookies. The provider supports a previous response ID for conversational continuity, while project memory remains under the agent's own control.

The implementation follows the current OpenAI Node SDK Responses API pattern. See the official SDK documentation before changing request/response types.
