## 🙏 Thank you for your contribution

Before submitting this PR, please ensure you have read the [CONTRIBUTING.md](../CONTRIBUTING.md) and completed the checklist below.

### 📌 What problem does this PR solve?
>
> Please provide a brief description of the purpose of this PR. If it fixes an open issue, link it using `Fixes #ISSUE_NUMBER` (e.g., Fixes #123).

### 🛠 What specific changes were made?

- Added/Modified logic in `xxx.ts`
- Adjusted UI rendering in `xxx`
- ...

### ✅ Test Checklist

Please check the items you have verified locally:

- [ ] Code compiles properly without errors (`npm run vscode:prepublish`)
- [ ] Unit/property tests pass (`npm run test:coverage`)
- [ ] Fully tested and working in the Extension Development Host
- [ ] Original functionality (e.g., grouping, drag-and-drop, context menus) is not broken by this PR
- [ ] If new text is added, relevant `i18n` language files have been updated

### 🤖 Routine PR Notes

For daily routine Draft PRs:

- [ ] This PR does not bump `package.json` or `package-lock.json`
- [ ] This PR does not update `CHANGELOG.md`
- [ ] This PR does not rename, add, or delete command registrations or contributed configuration keys
- [ ] This PR does not modify tab-group serialization or storage format
- [ ] Package version bump and changelog updates are deferred to the weekend release/integration PR

Label the PR `release-ready` only when version and changelog updates are intentionally included.

### 📸 Screenshots or Screen Recordings (Optional)
>
> If this PR involves UI changes, we highly recommend attaching before/after screenshots or a short recording. This will greatly speed up the review process.

---
💡 *Tip: If you are using AI to assist with your submission, you can copy the AI Prompt from `CONTRIBUTING.md` to help generate a draft that fits this format.*
