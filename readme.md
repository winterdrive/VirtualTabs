# VirtualTabs – VS Code Extension for Virtual Tabs & Custom File Grouping

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/winterdrive.virtual-tabs?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![AI-Ready Context](https://img.shields.io/badge/AI--Ready-LLMS.txt-blue?style=flat-square)](https://winterdrive.github.io/VirtualTabs/llms.txt)

[繁體中文](./README.zh-TW.md) | [English](./readme.md)

![VirtualTabs - VS Code File Grouping and AI Context Extension](docs/assets/vscode-virtualtabs-grouping-banner.png)

---

## 🚀 What is VirtualTabs?

**VirtualTabs is a VS Code extension that provides custom "Virtual File Directories" outside of your native file system.** Unlike standard directories, VirtualTabs helps you create **independent logical file groups** based on your current development theme, while also providing **AI-Ready Coding Context** for quick copying. It is perfectly suited for Monorepo projects or large-scale applications using MVVM or MVC architectures.

---

### ⚡ VirtualTabs vs. Native VS Code Tabs

| Feature | Native VS Code Tabs | VirtualTabs Extension |
| :--- | :--- | :--- |
| **Persistence** | Cleared on session close | **Saved permanently** per workspace |
| **Grouping** | Folder-based only | **Logic-based** (Cross-directory support) |
| **AI Context** | Hard to gather manually | **One-click context generation** for LLMs |

---

### 🧩 Solving Modern Workflow Pain Points

In MVC/MVVM or large-scale projects, related files are often scattered across deep directory structures, making switching a repetitive chore:

```text
❌ Traditional File Structure:
├── config.json          (Root Config)
├── styles/theme.css     (Style Layer)
├── src/components/      (View Layer)
├── tests/__tests__/     (Testing Layer)

✅ Theme-Based Virtual Directory:
📁 Feature: Theme System
  ├── 📁📚 Configuration
  │   └── config.json
  ├── 📁📚 Style Definitions
  │   └── theme.css
  ├── 📁📚 Components (View Layer)
  │   └── ThemeProvider.tsx
  │     └── 🔖 Line 45: Context setup
  └── 📁📚 Unit Tests (Logic/Testing)
  │   └── theme.test.ts
```

### 🤖 Born for AI Collaboration

In the era of Copilot and LLMs, **precise context** is the key to high-quality results:

- **Curated Selection**: Create groups with *only* the files relevant to your current task.
- **One-Click Export**: Convert entire groups into AI-friendly Markdown blocks (v0.3.0).
- **Reduced Noise**: Isolate core logic to help AI focus and prevent hallucinations.
- **Persistent Context**: Your curated AI prompts and file sets stay ready even after a restart.

> *"VirtualTabs helps me define the exact boundary of what the AI should see."*

---

## ✨ Key Features

### Core Capabilities

- **📁 Cross-Directory Grouping** — Organize files from anywhere, breaking free from folder constraints
- **🔖 Task-Oriented Bookmarks** — Mark specific lines of code within your groups for quick navigation `(v0.2.0)`
- **📂 Sub-Groups & Nesting** — Create hierarchical structures for better organization `(v0.3.0)`
- **🤖 AI Context Export** — One-click copy all files as LLM-ready context `(v0.3.0)`
- **▶️ Script Execution** — Inline run button for `.bat` and `.exe` files `(v0.3.2)`
- **💾 Portable Config** — Settings saved to `.vscode/virtualTab.json` for team sharing `(v0.3.2)`

### ⚡ Workflow Boosters

- **📋 Smart Copy Menu** — Unified copy options for files and groups `(v0.3.0)`
- **📁 Directory Drag & Drop** — Drag folders to add all files recursively `(v0.3.0)`
- **✂️ Full Clipboard Operations** — Cut/Copy/Paste support for files and groups `(v0.3.0)`
- **⇵ Group Reordering** — Easily move groups up and down via context menu `(v0.3.2)`
- **📊 Smart Organization** — Auto-group by extension, date, or sort by various criteria

---

## ⚡ Latest Highlights

![Copy Menu Demo](docs/assets/copy_menu_demo.png)

**v0.3.6** introduces powerful multi-select copy & system improvements:

- 🎯 **Multi-select Copy Support (Core Update)** — Select multiple files or groups and copy everything at once.
  - One-click copy for: File Names, Relative Paths, and Absolute Paths.
  - Enhanced "Copy Context for AI" handles mixed selections (files + groups + bookmarks) with automatic content deduplication.
- 🎨 **Smart Unified Menu** — Replaced redundant menus with a single, intelligent copy submenu.
- 🔧 **Enhanced Reliability** — Implemented robust cycle detection and improved type safety using `instanceof` checks for smoother performance in large projects.

**v0.3.3** enhanced user experience:

- ⚙️ **Configurable Confirmations** — Toggle delete confirmation dialogs via settings.
- 🌍 **Better i18n** — Fully localized messages for English, Traditional Chinese, and Simplified Chinese.

---

## 🚀 Quick Start

### Installation

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X`)
3. Search for **VirtualTabs** and click Install

### First Time Setup

1. Click the **VirtualTabs** icon in the Activity Bar (left sidebar)
2. Right-click in the panel → **Create New Group**
3. Drag files from Explorer into your group

---

## 📖 User Guide

### 📁 Group Management

- **Create/Rename**: Right-click panel or groups to manage.
- **Sub-Groups**: Right-click a group → **Add Sub-Group** (or drag one group into another) to create nested structures.
- **Auto-Sync**: The built-in "Open Editors" group automatically tracks your open tabs.
- **Drag & Drop**:
  - **Files**: Drag files from Explorer into groups.
  - **Folders**: Drag folders to recursively add all files inside.
  - **Multi-select**: Hold `Ctrl/Cmd` to select multiple files to drag at once.

![Drag and Drop Demo](docs/assets/drag_drop_demo.png)

### 🔖 Task-Oriented Bookmarks (v0.2.0)

1. Right-click **any line of code** → **Add Bookmark to VirtualTabs**
2. The bookmark appears nested under the file in your group.
3. Click to jump instantly to that exact line.
4. Edit label/description to document *why* this line is important.

![Bookmarks Feature](docs/assets/bookmarks_feature.png)

### 🤖 AI Context Export (v0.3.0)

**The "Killer Feature" for LLM workflows.**

1. Setup a group with all relevant files for your current task.
2. Right-click the group → **Copy...** → **Copy Context for AI**.
3. Paste into ChatGPT/Claude.
    - **Smart**: Binary files are skipped. Large files (>50KB) are opened for review.
    - **Clean**: All code is formatted in markdown blocks with file paths.

![AI Context Demo](docs/assets/ai_context_demo.png)

### 📋 Unified Copy Menu

Everything you need in one place. Right-click any file or group:

- **Copy Name/Path**: Standard path copying.
- **Copy Context**: Get the code content.
- **Multi-select**: Select 5 files → Copy Paths → Get a list of 5 paths.

### 📊 Sorting & Organization

- **Sort**: Right-click group → **Sort Files** (Name, Path, Extension, Date).
- **Auto-Group**: Right-click group → **Auto Group by Extension/Date**.
- **Reorder**: Use Right-click → **Move Up/Down** to manually order groups.

---

### 🎯 Use Cases

- **Monorepo Management**: Group related configs and logic across multiple packages.
- **Architecture-Oriented Dev**: Organize by logic layers (MVC/MVVM) rather than physical disk paths.
- **AI Context Curation**: Build precise file sets for LLMs to maximize prompt accuracy.
- **Code Review (CR)**: Centralize all changed files for a specific feature for efficient review.
- **Micro-Tutorials**: Create curated code paths for onboarding or technical reference.

---

## 💡 Best Practices

1. **Group by Task, Not Folder**: Think about what you're working on, not where files live
2. **Use Sub-Groups**: Organize large groups with nested structure (v0.3.0)
3. **Use Bookmarks for Logic Flow**: Mark key decision points in your code
4. **Create AI Context Groups**: Group 5-10 files for focused AI assistance
5. **Export Before Prompting**: Use "Copy Context for AI" before asking LLMs
6. **Review and Refine**: Periodically clean up unused groups to stay organized

---

---

## ❓ FAQ

### Q1: I don't see the VirtualTabs panel?

**Check:**

- The extension is enabled
- Your VS Code version is 1.75+
- VirtualTabs has its own icon in the Activity Bar (left sidebar)

### Q2: How do I create sub-groups?

Right-click any group → **Add Sub-Group**. You can also drag a group onto another group to nest it.

### Q3: How does "Copy Context for AI" work?

It reads all files in the group (including sub-groups), formats them as markdown code blocks, and copies to clipboard. Binary files are automatically skipped.

### Q4: Can I share my groups with my team?

Currently, groups are saved in `workspaceState` (local) or `.vscode/virtualTab.json` (shareable). v0.3.2 introduced support for `.vscode` storage!

### Q5: Do bookmarks work across file renames?

Yes! Bookmarks track file paths and will update if you rename files within VS Code.

### Q6: How do I drag folders into groups?

Simply drag a folder from the Explorer panel onto a group. VirtualTabs will automatically add all files recursively, skipping the directory entry itself.

---

## 🤝 Contributing

We welcome community contributions!

### 🔧 For Developers

Interested in code contributions? Please check **[DEVELOPMENT.md](./DEVELOPMENT.md)** for:

- Environment setup
- Debugging & publishing guide
- Module structure
- Common error troubleshooting

### 💬 Community

- 🐞 **Bug Reports** → [GitHub Issues](https://github.com/winterdrive/virtual-tabs/issues)
- ✨ **Feature Requests** → [GitHub Discussions](https://github.com/winterdrive/virtual-tabs/discussions)
- 🔧 **Code Contributions** → Fork and PR

---

## 🤝 Recommended Companion

### 🔥 Quick Prompt

**The perfect partner for VirtualTabs.**

While **VirtualTabs** organizes your **Context** (Files), **Quick Prompt** organizes your **Instructions** (Prompts).

- **VirtualTabs**: Defines *where* the AI should look (File Groups).
- **Quick Prompt**: Defines *what* the AI should do (Prompt Management).

Together, they create the ultimate AI-coding workflow.

Get Quick Prompt on [**VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=winterdrive.quick-prompt) | [**Open VSX Registry**](https://open-vsx.org/extension/winterdrive/quick-prompt)

---

## 📅 Changelog

👉 See [CHANGELOG.md](./CHANGELOG.md) for full release history.

### ✅ v0.3.6 (Latest)

- 🎯 **Multi-select Copy Support** — All copy commands now support selecting multiple files/groups
- 🎨 **Unified Copy Menu** — Consolidated 4 duplicate submenus into one smart menu
- 🔧 **Enhanced Reliability** — Improved type safety with `instanceof` checks and Set-based cycle detection
- 🐛 **Bug Fixes** — Fixed command namespace conflicts and bookmark context handling

---

## ❤️ Support

If you find this extension helpful, please consider supporting the development!

<a href="https://ko-fi.com/Q5Q41SR5WO"><img src="https://storage.ko-fi.com/cdn/kofi2.png?v=3" height="36" alt="ko-fi" /></a>

## 📄 License

Licensed under **MIT License**. Free for personal and commercial use.

---

**Organize smarter, code faster.** 🚀
