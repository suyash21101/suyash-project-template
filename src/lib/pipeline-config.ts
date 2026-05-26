/**
 * Pipeline control-plane config contract.
 *
 * The canonical shape of the `PIPELINE_CONFIG` GitHub Actions variable (see
 * `pipeline.schema.json` and `docs/BUILD_ROADMAP.md`). Shared by the control UI and any
 * tooling that needs to read or validate the config. The workflow orchestrator reads the
 * same JSON via `jq` at runtime; this module is the typed/validated counterpart.
 */

export interface DeployConfig {
  mode: "amplify" | "fargate";
  migrate_before_traffic?: boolean;
}

export interface StageConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface PipelineConfig {
  stages: Record<string, StageConfig>;
  deploy: DeployConfig;
}

const DEPLOY_MODES = ["amplify", "fargate"] as const;

/** Validate an unknown value against the pipeline config shape. Returns a list of human-readable
 * error messages; an empty list means the value is a valid config. */
export function validatePipelineConfig(value: unknown): string[] {
  const errors: string[] = [];

  if (typeof value !== "object" || value === null) {
    return ["config must be an object"];
  }
  const config = value as Record<string, unknown>;

  // stages
  if (typeof config.stages !== "object" || config.stages === null) {
    errors.push("missing or invalid `stages` object");
  } else {
    for (const [name, stage] of Object.entries(config.stages)) {
      if (typeof stage !== "object" || stage === null) {
        errors.push(`stage \`${name}\` must be an object`);
        continue;
      }
      if (typeof (stage as Record<string, unknown>).enabled !== "boolean") {
        errors.push(`stage \`${name}\`: \`enabled\` must be a boolean`);
      }
    }
  }

  // deploy
  if (typeof config.deploy !== "object" || config.deploy === null) {
    errors.push("missing or invalid `deploy` object");
  } else {
    const mode = (config.deploy as Record<string, unknown>).mode;
    if (!DEPLOY_MODES.includes(mode as (typeof DEPLOY_MODES)[number])) {
      errors.push(`\`deploy.mode\` must be one of: ${DEPLOY_MODES.join(", ")}`);
    }
  }

  return errors;
}

/** Parse a raw JSON string into a PipelineConfig, throwing if it is malformed or invalid. */
export function parsePipelineConfig(raw: string): PipelineConfig {
  const parsed = JSON.parse(raw) as unknown;
  const errors = validatePipelineConfig(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid PIPELINE_CONFIG: ${errors.join("; ")}`);
  }
  return parsed as PipelineConfig;
}

/** Whether a named stage is enabled. Unknown stages are treated as disabled. */
export function isStageEnabled(config: PipelineConfig, stage: string): boolean {
  return config.stages[stage]?.enabled === true;
}
