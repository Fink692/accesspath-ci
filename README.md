# AccessPath CI

AccessPath CI replays critical browser flows and reports accessibility regressions with the evidence a reviewer needs: route, rule, affected target, screenshot, keyboard-path focus evidence, accessibility-tree snapshot, and Playwright trace.

## Quick start

```bash
npm install
npx playwright install chromium
npm run build
npm run demo
```

In another terminal:

```bash
node dist/cli.js run \
  --flow accesspath.yml \
  --baseline .accesspath/baseline.json \
  --output accesspath-results
```

Open `accesspath-results/report.html` after the run. The CLI exits non-zero only for runner errors or new `critical`/`serious` axe findings. Existing baseline findings are retained as context but do not fail the check.

## Flow format

```yaml
name: checkout
baseUrl: http://127.0.0.1:3000
steps:
  - goto: /signup
  - fill:
      target: '#email'
      value: qa@example.com
  - tab: 2
  - scan: signup-form
  - click: '#continue'
  - waitFor: '#checkout-heading'
  - scan: checkout
assertions:
  - url: /checkout
  - visible: '#checkout-heading'
```

Supported actions are `goto`, `click`, `fill`, `press`, `tab`, `waitFor`, `screenshot`, and `scan`. A scan captures axe-core results, a full-page screenshot, the current ARIA snapshot when supported by the installed Playwright version, and the keyboard evidence collected so far.

## Baselines

To intentionally accept the current state:

```bash
node dist/cli.js run --flow accesspath.yml \
  --baseline .accesspath/baseline.json \
  --update-baseline
```

Baselines are route- and rule-specific. A newly affected DOM target under an existing rule is also treated as a new finding. Keep the baseline reviewable in git; generated screenshots, traces, and HTML/JSON reports belong in CI artifacts.

## GitHub Action

The repository includes a local action entrypoint in `action.yml` and a sample workflow in `.github/workflows/accesspath.yml`. Build `dist/` before using the action from a tag or release. The action writes `report_path`, `json_path`, `new_violations`, `blocking_violations`, and `status` to `GITHUB_OUTPUT`, appends a Markdown summary, emits workflow error annotations for blocking findings, and upserts one marked PR comment when a token is available. The sample workflow uploads the full `accesspath-results` directory as an artifact.

## Seeded regression demo

The demo intentionally adds an unlabeled button to the sign-up flow when `DEMO_REGRESSION=1`:

```bash
DEMO_REGRESSION=1 npm run demo
```

That makes the same flow produce a new `label` violation, which is useful for smoke-testing the failure policy and showing the report in a portfolio demo.

## MVP boundaries

The first vertical slice uses a portable JSON baseline so it works in local development and GitHub Actions without a database service. SQLite history, multi-flow orchestration, PR-comment upserts, and a standalone Next.js viewer are natural follow-ons once the flow contract and evidence model have settled.
