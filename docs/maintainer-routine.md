# Maintainer Routine

This repository supports small daily routine Draft PRs and separate weekend release/integration PRs.

## Daily Routine Draft PRs

Daily routine PRs should stay small and easy to review.

- Fix one small, safe issue.
- Avoid duplicate work by checking open PRs and active routine branches first.
- Do not bump `package.json` or `package-lock.json`.
- Do not update `CHANGELOG.md`.
- Do not rename, add, or delete command registrations or contributed configuration keys.
- Do not modify tab-group serialization or storage format.
- Do not add, remove, or update dependencies.
- Keep the PR as Draft until it is intentionally selected for integration.

Run local validation before opening the Draft PR:

```powershell
npx tsc -p ./
npm run test
npm run test:coverage
```

If a routine attempt fails after focused fixes, write the failure summary to `routine_fail.log`. That file is ignored by Git.

## Release/Integration PRs

Weekend release or integration PRs are responsible for release metadata.

- Consolidate selected routine PRs.
- Bump `package.json` and `package-lock.json` once.
- Update `CHANGELOG.md`.
- Add the `release-ready` label when the PR is ready for release version validation.

The release version gate in CI runs only for pull requests labeled `release-ready`.
