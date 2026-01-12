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
3. Drag files into your group
4. Right-click the group → **Auto Group by Extension** (optional)

### Basic Operations

#### Creating Groups

- Right-click in the VirtualTabs panel → **Create New Group**
- Name your group (e.g., "AI Context", "Feature: Auth", "Bug Fix #123")
- Right-click any group → **Add Sub-Group** for nested organization

![Nested Groups](docs/assets/nested_groups_demo.png)

#### Adding Files

- **Drag & Drop Files**: Drag files from Explorer into a group
- **Drag & Drop Folders**: Drag folders to add all files recursively (v0.3.0)
- **Multi-select**: Hold `Ctrl` (or `Cmd`) and click files, then drag together
- **Currently Open**: The built-in group auto-syncs with your open tabs

![Drag & Drop Demo](docs/assets/drag_drop_demo.png)

#### Using Bookmarks (v0.2.0)

1. Right-click any line in the editor → **Add Bookmark to VirtualTabs**
2. The bookmark appears under the file in the sidebar
3. Click the bookmark to jump to that exact line
4. Right-click the bookmark → **Edit Label** or **Edit Description**

#### AI Context Export (v0.3.0)

![AI Context Export](docs/assets/ai_context_demo.png)

1. Right-click a group → **Copy...** → **Copy Context for AI**
2. Paste directly into ChatGPT, Claude, or any LLM
3. All files are formatted with proper code blocks

**Unified Copy Menu:**

![Copy Menu Options](docs/assets/copy_menu_demo.png)

All copy operations are available in one convenient submenu, with smart behavior for both groups and files.

**Smart Features:**

- Skips binary files automatically
- Opens in editor if content > 50KB
- Includes all sub-group files recursively

#### Sorting Files (v0.1.0)

- Right-click a group → **Sort Files** submenu
- Choose: Name, Path, Extension, or Modified Time
- Toggle ascending/descending order
- Each group remembers its own sort preference

#### Right-Click Menu Guide

VirtualTabs provides rich context menu options for efficient file and group management:

- **Group Operations**: Add/Rename/Duplicate, Move Up/Down, Bulk Open/Close, and Auto-Grouping.
- **File Operations**: Bulk Open/Close (multi-select), Remove from Group, Delete to Trash, and Script Execution (.bat/.exe).
- **Copy Menu**: Unified submenu for copying names, paths, or full LLM-ready context.
- **Bookmarks**: Quick navigation, label/description editing, and file management.

> [!TIP]
> **Technical Reference**: For a complete matrix of command availability across all item types, please see **[DEVELOPMENT.md](./DEVELOPMENT.md#menu-availability-matrix)**.

**Multi-Selection Tips:**

- Hold `Ctrl` (or `Cmd`) and click to select multiple files.
- Right-click any selected file to apply operations to all.
- Or simply right-click any file without pre-selection for quick actions.

---

### 🧩 Solving Modern Workflow Pain Points

In MVC/MVVM or large-scale projects, related files are often scattered across deep directory structures, making switching a repetitive chore:

```text
❌ Traditional File Structure:
├── config.json          (Root Config)
├── styles/theme.css     (Style Layer)
├── src/components/      (View Layer)
└── tests/__tests__/     (Testing Layer)

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
      └── theme.test.ts
```

### 🤖 Born for AI Collaboration

In the era of Copilot and LLMs, **precise context** is the key to high-quality results:

- **Curated Selection**: Create groups with *only* the files relevant to your current task.
- **One-Click Export**: Convert entire groups into AI-friendly Markdown blocks (v0.3.0).
- **Reduced Noise**: Isolate core logic to help AI focus and prevent hallucinations.
- **Persistent Context**: Your curated AI prompts and file sets stay ready even after a restart.

> *"VirtualTabs helps me define the exact boundary of what the AI should see."*

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

## 🌍 Language Support

VirtualTabs automatically switches based on your VS Code locale:

- 🇺🇸 English (`en`)
- 🇹🇼 Traditional Chinese (`zh-tw`)
- 🇨🇳 Simplified Chinese (`zh-cn`)

Change your VS Code locale to switch languages instantly.

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

## 🔧 Developer Section

Interested in contributing? Check out **[DEVELOPMENT.md](./DEVELOPMENT.md)** for:

- Environment setup
- Debugging & publishing guide
- Module structure & data flow diagrams
- Common error troubleshooting

---

## 🤝 Contributing

We welcome community contributions:

- 🐞 **Bug Reports** → [GitHub Issues](https://github.com/winterdrive/virtual-tabs/issues)
- ✨ **Feature Requests** and UI suggestions
- 🔧 **Code Contributions** (fork and submit a PR)
- 🌍 **Translations** for new languages

---

## 🤝 Recommended Companion

### 🔥 Quick Prompt

**The perfect partner for VirtualTabs.**

While **VirtualTabs** organizes your **Context** (Files), **Quick Prompt** organizes your **Instructions** (Prompts).

- **VirtualTabs**: Defines *where* the AI should look (File Groups).
- **Quick Prompt**: Defines *what* the AI should do (Prompt Management).

Together, they create the ultimate AI-coding workflow.

Get Quick Prompt on [**VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=winterdrive.quick-prompt?utm_source=virtualtabs&utm_medium=readme&utm_campaign=cross_promotion) | [**Open VSX Registry**](https://open-vsx.org/extension/winterdrive/quick-prompt?utm_source=virtualtabs&utm_medium=readme&utm_campaign=cross_promotion)

---

## 📅 Changelog

### ✅ v0.3.6 (Latest)

- 🎯 **Multi-select Copy Support** — All copy commands now support selecting multiple files/groups
- 🎨 **Unified Copy Menu** — Consolidated 4 duplicate submenus into one smart menu
- 🔧 **Enhanced Reliability** — Improved type safety with `instanceof` checks and Set-based cycle detection
- 🐛 **Bug Fixes** — Fixed command namespace conflicts and bookmark context handling

### ✅ v0.3.3

- ✅ Configurable confirmation dialogs for delete operations
- ✅ Internationalized confirmation messages (EN/ZH-TW/ZH-CN)
- ✅ Refactored confirmation logic into reusable utility

### ✅ v0.3.2

- ✅ Inline Run button for scripts (.bat/.exe)
- ✅ Group Reordering (Move Up/Down)
- ✅ Storage moved to `.vscode/virtualTab.json`
- ✅ Expanded state persistence

### ✅ v0.3.0

- ✅ Sub-Groups & Nested Structure
- ✅ AI Context Export ("Copy Context for AI")
- ✅ Unified Copy Menu with smart behavior
- ✅ Directory Drag & Drop (recursive file adding)
- ✅ Copy/Paste/Delete operations
- ✅ Multi-select delete for groups and files
- ✅ Enhanced drag & drop with bookmark preservation

### ✅ v0.2.0

- ✅ Task-Oriented Bookmarks with smart flow
- ✅ Enhanced tree view for bookmarks and files
- ✅ Edit bookmark labels and descriptions

### ✅ v0.1.0

- ✅ File sorting (name, path, extension, modified time)
- ✅ Auto-group by modification date
- ✅ Per-group sort preferences
- ✅ Full i18n support (EN, ZH-TW, ZH-CN)

---

## 📄 License

Licensed under **MIT License**. Free for personal and commercial use.

---

**Organize smarter, code faster.** 🚀
