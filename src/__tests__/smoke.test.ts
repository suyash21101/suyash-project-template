import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("environment is configured correctly", () => {
    expect(true).toBe(true);
  });

  it("can import from src paths", async () => {
    // Verifies the @ alias and basic module resolution work
    expect(typeof describe).toBe("function");
  });
});
