import { describe, it, expect } from "vitest";
import {
  parsePipelineConfig,
  isStageEnabled,
  validatePipelineConfig,
} from "@/lib/pipeline-config";

const validRaw = JSON.stringify({
  stages: {
    test: { enabled: true, coverage_min: 80 },
    e2e: { enabled: false },
  },
  deploy: { mode: "amplify", migrate_before_traffic: true },
});

describe("parsePipelineConfig", () => {
  it("parses a valid config string into an object with stages", () => {
    const config = parsePipelineConfig(validRaw);
    expect(config.stages.test.enabled).toBe(true);
    expect(config.deploy.mode).toBe("amplify");
  });

  it("throws on malformed JSON", () => {
    expect(() => parsePipelineConfig("{not json")).toThrow();
  });

  it("throws when the config shape is invalid", () => {
    expect(() => parsePipelineConfig(JSON.stringify({ deploy: {} }))).toThrow();
  });
});

describe("isStageEnabled", () => {
  const config = parsePipelineConfig(validRaw);

  it("returns true for an enabled stage", () => {
    expect(isStageEnabled(config, "test")).toBe(true);
  });

  it("returns false for a disabled stage", () => {
    expect(isStageEnabled(config, "e2e")).toBe(false);
  });

  it("returns false for an unknown stage", () => {
    expect(isStageEnabled(config, "does-not-exist")).toBe(false);
  });
});

describe("validatePipelineConfig", () => {
  it("returns no errors for a valid config", () => {
    expect(validatePipelineConfig(JSON.parse(validRaw))).toEqual([]);
  });

  it("reports a missing stages object", () => {
    const errors = validatePipelineConfig({ deploy: { mode: "amplify" } });
    expect(errors.some((e) => e.includes("stages"))).toBe(true);
  });

  it("reports a stage whose enabled flag is not boolean", () => {
    const errors = validatePipelineConfig({
      stages: { test: { enabled: "yes" } },
      deploy: { mode: "amplify" },
    });
    expect(
      errors.some((e) => e.includes("test") && e.includes("enabled")),
    ).toBe(true);
  });

  it("reports an invalid deploy mode", () => {
    const errors = validatePipelineConfig({
      stages: { test: { enabled: true } },
      deploy: { mode: "heroku" },
    });
    expect(errors.some((e) => e.includes("deploy") && e.includes("mode"))).toBe(
      true,
    );
  });

  it("reports a non-object config", () => {
    expect(validatePipelineConfig("nope")).toEqual([
      "config must be an object",
    ]);
  });

  it("reports a stage that is not an object", () => {
    const errors = validatePipelineConfig({
      stages: { test: true },
      deploy: { mode: "amplify" },
    });
    expect(errors.some((e) => e.includes("test") && e.includes("object"))).toBe(
      true,
    );
  });

  it("reports a missing deploy object", () => {
    const errors = validatePipelineConfig({
      stages: { test: { enabled: true } },
    });
    expect(errors.some((e) => e.includes("deploy"))).toBe(true);
  });
});
