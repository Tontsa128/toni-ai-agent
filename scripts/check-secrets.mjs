import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const patterns = [
  { name: "OpenAI-style API key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { name: "Private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Bearer token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/gi }
];
const findings = [];

for (const file of files) {
  if (/^(?:package-lock\.json|security\/RELEASE-GATE\.md)$/.test(file)) continue;
  if (/\.(?:png|jpg|jpeg|gif|webp|ico|pdf|zip|exe|dll|pdb)$/.test(file)) continue;
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  for (const rule of patterns) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) findings.push(file + ": " + rule.name);
  }
}

if (findings.length) {
  console.error("Potential secrets detected:");
  for (const finding of [...new Set(findings)].sort()) console.error("- " + finding);
  process.exit(1);
}
console.log("Secret scan passed.");
