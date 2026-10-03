# Contributing to Car Part Watcher

## Environment & Prerequisites

- **Deno**: Deno 2 (tested against `~2.9.6` / `2.9.7`). Ensure Deno 2 is
  installed:
  ```bash
  deno --version
  ```
- **PostgreSQL**: Required for running the application and migrations locally.
- **pre-commit** _(optional but recommended)_: Used for local Git hooks. Install
  via `pipx` or `brew`:
  ```bash
  brew install pre-commit
  # or
  pipx install pre-commit
  ```

## Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/andrewtryder/car-part-watcher.git
   cd car-part-watcher
   ```
2. Install dependencies:
   ```bash
   deno install
   ```
3. Set up local Git hooks:
   ```bash
   pre-commit install --hook-type pre-commit --hook-type pre-push
   ```

## Development Commands

- **Start API server**: `deno task serve`
- **Start frontend dev server**: `deno task web:dev`
- **Run migrations**: `deno task migrate`
- **Build frontend**: `deno task web:build`
- **Run unit tests**: `deno task test`
- **Format code**: `deno task fmt`
- **Check formatting**: `deno task fmt:check`
- **Lint code**: `deno task lint`
- **Type check**: `deno task check`

### Test Behavior

- Unit tests (`deno task test`) run self-contained and mock external calls or
  use memory stores. They do not require a live `DATABASE_URL` or production
  credentials.
- Database integration scripts and migration tasks that require a real database
  connect via `DATABASE_URL` and remain opt-in.

## Canonical Verification (Run What CI Runs)

Before pushing or opening a pull request, run the single canonical quality gate:

```bash
deno task ci
# or
deno task verify
```

This task runs:

1. `deno install --frozen` (frozen dependency resolution)
2. `deno task fmt:check` (code formatting)
3. `deno task lint` (Deno linter)
4. `deno task check` (TypeScript type check across frontend and backend)
5. `deno task test` (unit tests)
6. `deno task web:build` (production Vite build)

This same quality gate runs in GitHub Actions CI and as the Deno Deploy
production build check before migrations run.

## Pull Requests & Commit Guidelines

### Conventional Commits

Pull Request titles **must** follow the
[Conventional Commits](https://www.conventionalcommits.org/) specification
because the repository uses squash merges and Release Please to automate
changelogs and releases.

Format: `<type>(<optional scope>): <description>`

Allowed types:

- `feat`: A new feature (triggers minor version bump)
- `fix`: A bug fix (triggers patch version bump)
- `perf`: A performance improvement
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes
- `test`: Adding or correcting tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Routine maintenance tasks
- `revert`: Reverting a previous commit

Breaking changes should append a `!` before the colon:
`feat!: change watch API contract`.

Examples:

- `feat: add listing history export`
- `fix(email): preserve direct photo links`
- `ci: add Deno verification workflow`
- `chore(deps): update Vite`
- `feat!: change watch API contract`

### Squash Merges

All pull requests are squashed when merged into `main`. The squash commit
message defaults to the PR title, preserving the Conventional Commit format for
Release Please.

### Release Process

Releases are automated via
[Release Please](https://github.com/googleapis/release-please):

1. Merges to `main` evaluate commit messages since the previous release.
2. Release Please opens or updates a Release PR maintaining `version.txt` and
   `CHANGELOG.md`.
3. When the Release PR is merged, Release Please tags the commit and publishes a
   GitHub Release.
