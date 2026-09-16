import { describe, expect, it } from "vitest";
import { ComputerActionPolicy } from "./ComputerActionPolicy.js";

describe("ComputerActionPolicy", () => {
  it("requires approval for every supported input action", () => {
    const policy = new ComputerActionPolicy();
    for (const action of ["click", "type", "keypress"] as const) {
      expect(policy.decide(action, false)).toMatchObject({ allowed: false, risk: "approval_required" });
      expect(policy.decide(action, true)).toMatchObject({ allowed: true, risk: "approval_required" });
    }
  });
});
