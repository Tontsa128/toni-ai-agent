# Vision and screen-assistance architecture

Toni AI's screen assistance is privacy-first and user-controlled.

## Runtime flow

```text
Screen OFF (default)
      |
      v
User enables screen monitoring
      |
      v
Windows capture + foreground window metadata
      |
      v
Privacy filter (before OCR)
      |
      +---- blocked ----> no OCR / no downstream observation
      |
      v
Optional local Tesseract OCR
      |
      v
Privacy filter on OCR text
      |
      +---- blocked ----> no downstream observation
      |
      v
Strip raw screenshot
      |
      v
Screen context assistant
      |
      v
Suggestion / human decision
```

## Privacy rules

- Screen monitoring is OFF by default.
- The user can turn monitoring ON or OFF from the local UI.
- Credential/payment/login/private-window signals are blocked before OCR.
- OCR text is checked again for password, token, MFA and verification-code signals.
- Raw `imageDataUrl` is removed before screen context reaches downstream analysis.
- OCR provider failures fail closed to a text-free safe observation; they do not expose the screenshot.
- No password, API key, MFA code, cookie or session secret is intentionally stored in screen context, memory or audit records.

## OCR provider

The Windows implementation uses an optional local Tesseract executable. The executable defaults to `tesseract` and can be overridden with `TONI_TESSERACT_PATH`.

Availability is probed once and cached. `/api/status` reports:

```json
{
  "screenOcr": {
    "enabled": true,
    "provider": "tesseract",
    "available": true
  }
}
```

When Tesseract is not installed, screen monitoring can still operate from foreground-window metadata; OCR simply contributes no text.

## Current limitations

This is a privacy and application boundary, not a kernel-level security boundary. A future hardened desktop distribution should isolate screen capture and computer control in a separately permissioned process and minimize raw screenshot lifetime in memory.

AI vision should not be invoked on every polling cycle. The intended production strategy is local OCR/metadata first and multimodal reasoning only when the user has enabled it and the context warrants it.
