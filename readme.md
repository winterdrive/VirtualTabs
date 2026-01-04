# VirtualTabs – VS Code Extension for Virtual Tabs & Custom File Grouping

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/winterdrive.virtual-tabs?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)

[繁體中文](./README.zh-TW.md) | [English](./readme.md)

![VirtualTabs - VS Code File Grouping and AI Context Extension](docs/assets/vscode-virtualtabs-grouping-banner.png)

---

## 🚀 What is VirtualTabs?

**VirtualTabs is a VS Code extension that allows developers to organize files into persistent, custom virtual tab groups across directories.** Unlike standard tabs, VirtualTabs helps you build **AI-ready coding contexts** and logical file groups that stay organized even when you close VS Code. It is designed to improve navigation for large monorepos and enhance task-based workflows.

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

![Latest Features](docs/assets/feature_032_preview.png)

**v0.3.3** enhances user experience:

- ⚙️ **Configurable Confirmations** — Control delete confirmation dialogs via settings
- 🌍 **Better i18n** — Confirmation messages now fully localized
- 🔧 **Code Quality** — Refactored confirmation logic for maintainability

**v0.3.2** brought productivity boosters:

- 🎯 **Run Scripts Inline** — Execute `.bat` and `.exe` files with one click
- ⇵ **Reorder Groups** — Move groups up/down to prioritize your workflow
- 💾 **Team Sharing** — Config now saved in `.vscode/virtualTab.json`

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

---

## 💡 Why Choose VirtualTabs?

### 🧩 Solves Real Workflow Problems

In large projects, related files are scattered across directories:

```text
❌ Without VirtualTabs:
├── config.json          (root)
├── styles/theme.css     (styles folder)
├── src/components/      (components)
└── tests/__tests__/     (tests)

✅ With VirtualTabs:
📁 Feature: Theme System
  ├── 📁📚 Config Files
  │   └── config.json
  ├── 📁📚 Styles
  │   └── theme.css
  ├── 📁📚 Components
  │   └── ThemeProvider.tsx
  │     └── 🔖 Line 45: Context setup
  └── 📁📚 Tests
      └── theme.test.ts
```

### 🤖 Perfect for AI-Assisted Coding

**Context is King** in the era of Copilot and LLMs:

- **Curated Context**: Create groups with *only* the relevant files for a task
- **One-Click Export**: Copy all files as AI-ready markdown (v0.3.0)
- **Reduced Noise**: Help AI focus by isolating the exact files needed
- **Persistent Prompts**: Keep a "Context Group" ready when you return to a task

> *"VirtualTabs helps me define the exact boundary of what the AI should look at."*

### 🎯 Use Cases

- **Cross-directory management**: Group config, styles, and source code together
- **Feature-based development**: Organize by module or functionality
- **AI Context Curation**: Build precise file sets for LLMs with one-click export
- **Code Review**: Centralize files for review efficiency
- **Teaching & Reference**: Create curated examples without folder interference

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

[**Learn more about Quick Prompt**](https://github.com/winterdrive/QuickPrompt)

---

## 📅 Changelog

### ✅ v0.3.3 (Latest)

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
