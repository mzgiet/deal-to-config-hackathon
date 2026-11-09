/*
 * The only place that talks to Claude.
 *
 * generateJson({ system, input, schema }) -> object matching `schema`
 *
 * Two backends behind the same function:
 *  - ANTHROPIC_API_KEY set -> Anthropic API with structured outputs
 *  - otherwise             -> headless Claude Code (`claude -p --json-schema`)
 *                             on the logged-in account; CLAUDE_BIN overrides the path
 *
 * Switching to the API means adding the key to .env. Nothing else changes.
 */

const { spawn } = require('node:child_process');
const os = require('node:os');
const Anthropic = require('@anthropic-ai/sdk');
const { config } = require('./config');

const TIMEOUT_MS = 90_000;

const anthropic = config.claude.apiKey ? new Anthropic({ apiKey: config.claude.apiKey }) : null;

const backendName = anthropic ? 'Anthropic API' : `Claude CLI (${config.claude.bin})`;

function generateJson(request) {
  return anthropic ? viaApi(request) : viaCli(request);
}

/* ------------------------------------------------------------------ *
 * Anthropic API. Structured outputs guarantee schema-valid JSON.
 * Low effort: this is extraction, not reasoning, and the rep is waiting.
 * ------------------------------------------------------------------ */

async function viaApi({ system, input, schema }) {
  const res = await anthropic.beta.messages.create(
    {
      model: config.claude.model || 'claude-sonnet-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: input }],
    },
    { timeout: TIMEOUT_MS },
  );

  if (res.stop_reason === 'refusal') {
    throw new Error(`Claude declined the request (${res.stop_details?.category ?? 'no category'})`);
  }

  const text = res.content.find((b) => b.type === 'text')?.text ?? '';
  return JSON.parse(text);
}

/* ------------------------------------------------------------------ *
 * Headless Claude Code. --json-schema validates the output, which then
 * arrives already parsed in `structured_output`. Runs from the temp dir
 * so it does not pick up this repo's CLAUDE.md; no tools.
 * ------------------------------------------------------------------ */

function viaCli({ system, input, schema }) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', config.claude.model || 'sonnet',
    '--tools', '',
    '--no-session-persistence',
    '--system-prompt', system,
    '--json-schema', JSON.stringify(schema),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(config.claude.bin, args, { cwd: os.tmpdir() });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude took longer than ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Could not start Claude CLI (set CLAUDE_BIN?): ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const out = JSON.parse(stdout);
        if (out.is_error || !out.structured_output) {
          throw new Error(out.result || `exit code ${code}`);
        }
        resolve(out.structured_output);
      } catch (err) {
        reject(new Error(`Claude CLI failed: ${err.message}\n${stderr.slice(0, 400)}`));
      }
    });

    child.stdin.end(input);
  });
}

module.exports = { generateJson, backendName };
