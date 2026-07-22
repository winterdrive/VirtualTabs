# Release & Versioning Guide

This document explains the versioning convention and release workflow for VirtualTabs.

---

## Versioning Convention

VirtualTabs follows the VS Code Marketplace pre-release convention based on the **minor version number**:

| Minor version | Parity | Published as |
|:---|:---|:---|
| 0.8.x, 0.10.x, 1.2.x, ... | **Even** | Stable release (default channel) |
| 0.7.x, 0.9.x, 1.1.x, ... | **Odd** | Pre-release (opt-in channel) |

**How it works:**
- CI reads the minor from `package.json` at merge time.
- If minor is odd → publishes with `vsce publish --pre-release`.
- If minor is even → publishes without the flag (stable).
- You never need to pass `--pre-release` manually.

**Why this pattern?**
VS Code Marketplace uses odd minor = pre-release as the recommended convention.
Users who opt into pre-releases get odd-minor builds; stable users receive even-minor builds.

---

## Release Workflow

### 1. Batch routine fixes

Accumulate routine PRs on `main`. Each PR targets a single fix and is squash-merged directly.

### 2. Create a release branch

```bash
git checkout -b release/vX.Y.Z-YYMMDD
```

### 3. Bump the version

Edit `package.json`:
- Pre-release → bump to next **odd** minor (e.g. 0.6.0 → **0.7.0**, then 0.7.0 → **0.8.0**)
- Stable → bump to next **even** minor

Update `CHANGELOG.md` with the new version entry.

### 4. Open a release PR

Title: `chore: release vX.Y.Z (pre-release)` or `chore: release vX.Y.Z`

Include the CHANGELOG draft in the PR description.

### 5. Merge & publish

Squash-merge the release PR into `main` (or `master`).
The `publish.yml` CI workflow triggers automatically:
- Detects version bump in `package.json`
- Determines stable vs pre-release from the minor parity
- Publishes to VS Code Marketplace and Open VSX

### 6. Self-test pre-releases

After a pre-release publish, switch to the pre-release channel in VS Code and test on your own project. Once satisfied, proceed to the next stable release.

---

## Workflow Summary

```
Routine PRs → squash into main
             → open release branch
             → bump version (even = stable, odd = pre-release)
             → update CHANGELOG
             → open release PR → squash-merge
             → CI auto-publishes (stable or pre-release based on minor parity)
```

---

## CI Secrets Required

| Secret | Purpose |
|:---|:---|
| `VSCE_PAT` | VS Code Marketplace Personal Access Token (scope: Marketplace → Manage) |
| `OPEN_VSX_TOKEN` | Open VSX publish token |

Set these in GitHub → Settings → Secrets and variables → Actions.

