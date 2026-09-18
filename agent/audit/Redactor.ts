const SECRET_PATTERNS = [
  /\b(?:OPENAI_API_KEY|GITHUB_TOKEN|TONI_MEMORY_KEY|TONI_AUTH_TOKEN)\s*[=:]\s*[^\s,;]+/gi,
  /\b(?:Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|cookie|authorization)\s*[=:]\s*[^\s,;]+/gi
];

export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_PATTERNS) result = result.replace(pattern, (match) => {
    const index = match.search(/[=:]/);
    return index >= 0 ? match.slice(0, index + 1) + "[REDACTED]" : "[REDACTED]";
  });
  return result;
}
