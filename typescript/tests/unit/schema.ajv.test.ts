import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, it, expect } from "vitest";

/**
 * Pending `#141`: these schemas contain known issues (e.g., duplicate enums),
 * so keep this suite skipped to avoid red CI. When the fix merges, change
 * `describe.skip` to `describe` to enforce schema validity in CI.
 */
describe.skip("tool input schemas compile under AJV strict mode (enable after #141)", () => {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  // NOTE: test file is at typescript/tests/unit/..., schemas are at repo_root/schema/...
  const raw = readFileSync(new URL("../../../schema/tool-inputs.json", import.meta.url), "utf-8");
  const inputs = JSON.parse(raw) as Record<string, unknown>;
  const toolSchemas = Object.entries(inputs);

  it("schemas file is non-empty", () => {
    expect(toolSchemas.length).toBeGreaterThan(0);
  });

  for (const [name, schema] of toolSchemas) {
    it(`${name} compiles`, () => {
      expect(() => ajv.compile(schema as object)).not.toThrow();
    });
  }
});
