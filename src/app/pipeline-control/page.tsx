"use client";

/**
 * Pipeline Control Panel (Phase 1 prototype).
 *
 * Reads and writes the `PIPELINE_CONFIG` GitHub Actions variable for a repo, so pipeline stages
 * can be toggled from a UI. Auth here is a fine-grained PAT entered by the user (kept only in
 * component state, never persisted) — a PROTOTYPE. Production should use a GitHub App with a
 * scoped `Variables: read/write` permission and a serverless backend (see docs/BUILD_ROADMAP.md).
 */

import { useState } from "react";
import defaultConfig from "../../../pipeline.config.default.json";
import {
  parsePipelineConfig,
  validatePipelineConfig,
  type PipelineConfig,
} from "@/lib/pipeline-config";

const NUMERIC_FIELDS = ["coverage_min", "threshold_kb", "min_score"] as const;
const GH = "https://api.github.com";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export default function PipelineControlPage() {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [config, setConfig] = useState<PipelineConfig | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setStatus("Loading…");
    try {
      const res = await fetch(
        `${GH}/repos/${owner}/${repo}/actions/variables/PIPELINE_CONFIG`,
        { headers: ghHeaders(token) },
      );
      if (res.status === 404) {
        setConfig(defaultConfig as PipelineConfig);
        setStatus(
          "No PIPELINE_CONFIG variable yet — loaded defaults. Save to create it.",
        );
        return;
      }
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      const data = await res.json();
      setConfig(parsePipelineConfig(data.value));
      setStatus("Loaded current config.");
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!config) return;
    const errors = validatePipelineConfig(config);
    if (errors.length > 0) {
      setStatus(`Cannot save — invalid config: ${errors.join("; ")}`);
      return;
    }
    setBusy(true);
    setStatus("Saving…");
    const body = JSON.stringify({
      name: "PIPELINE_CONFIG",
      value: JSON.stringify(config),
    });
    try {
      // Try update; if the variable doesn't exist yet, create it.
      let res = await fetch(
        `${GH}/repos/${owner}/${repo}/actions/variables/PIPELINE_CONFIG`,
        { method: "PATCH", headers: ghHeaders(token), body },
      );
      if (res.status === 404) {
        res = await fetch(`${GH}/repos/${owner}/${repo}/actions/variables`, {
          method: "POST",
          headers: ghHeaders(token),
          body,
        });
      }
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      setStatus(
        "Saved. Takes effect on the next pipeline run — no commit needed.",
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function setStage(name: string, patch: Record<string, unknown>) {
    setConfig((c) =>
      c
        ? {
            ...c,
            stages: { ...c.stages, [name]: { ...c.stages[name], ...patch } },
          }
        : c,
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="text-2xl font-bold tracking-tight">
        Pipeline Control Panel
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Toggle CI stages for a repo. Edits the <code>PIPELINE_CONFIG</code>{" "}
        variable — applied on the next run, no commit.
      </p>

      <section className="mt-6 grid grid-cols-3 gap-3">
        <input
          className="col-span-3 rounded-lg border px-3 py-2 text-sm"
          type="password"
          placeholder="Fine-grained PAT (Variables: read/write)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
        <button
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          onClick={load}
          disabled={busy || !token || !owner || !repo}
        >
          Load
        </button>
      </section>

      {config && (
        <section className="mt-6 space-y-2">
          {Object.entries(config.stages).map(([name, stage]) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-xl border bg-white/50 px-4 py-3"
            >
              <label className="flex flex-1 items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-emerald-600"
                  checked={stage.enabled}
                  onChange={(e) =>
                    setStage(name, { enabled: e.target.checked })
                  }
                />
                <span className="font-medium">{name}</span>
              </label>
              {NUMERIC_FIELDS.filter((f) => f in stage).map((f) => (
                <label
                  key={f}
                  className="flex items-center gap-1 text-xs text-gray-500"
                >
                  {f}
                  <input
                    type="number"
                    className="w-20 rounded border px-2 py-1"
                    value={Number(stage[f])}
                    onChange={(e) =>
                      setStage(name, { [f]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          ))}

          <div className="flex items-center gap-3 rounded-xl border bg-white/50 px-4 py-3">
            <span className="flex-1 font-medium">deploy.mode</span>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={config.deploy.mode}
              onChange={(e) =>
                setConfig((c) =>
                  c
                    ? {
                        ...c,
                        deploy: {
                          ...c.deploy,
                          mode: e.target
                            .value as PipelineConfig["deploy"]["mode"],
                        },
                      }
                    : c,
                )
              }
            >
              <option value="amplify">amplify</option>
              <option value="fargate">fargate</option>
            </select>
          </div>

          <button
            className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={save}
            disabled={busy}
          >
            Save to PIPELINE_CONFIG
          </button>
        </section>
      )}

      {status && <p className="mt-4 text-sm text-gray-600">{status}</p>}
    </main>
  );
}
