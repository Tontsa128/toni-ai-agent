# Research Agent

The research layer is read-only by design.

## Providers

- `HttpResearchAdapter` fetches an explicitly supplied HTTP(S) source with a size and timeout limit. It does not execute JavaScript or submit forms.
- `OpenAIWebResearchAdapter` uses the OpenAI Responses API web-search tool for source discovery and synthesis.

## Evidence rules

1. Keep the original source URL.
2. Record retrieval time.
3. Separate source discovery from source interpretation.
4. Do not treat model prose as proof that a source says something; retain the source URL and, when needed, fetch the source separately.
5. Never send credentials, cookies, MFA codes or school-account secrets to research providers.
6. Research is read-only; downloads, browser writes, submissions and external mutations still require the normal supervisor/approval path.

## Current limitation

The generic HTTP adapter intentionally does not invent a search engine API. A configured provider must supply search; otherwise the browser research path can be used for user-visible research.
