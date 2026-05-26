# VirtualTabs - VS Code 虚拟标签页与自定义文件分组扩展

[![Visual Studio Marketplace Version](https://vsmarketplacebadges.dev/version-short/winterdrive.virtual-tabs.svg)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Open VSX Version](https://img.shields.io/open-vsx/v/winterdrive/virtual-tabs)](https://open-vsx.org/extension/winterdrive/virtual-tabs)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/winterdrive/virtual-tabs)](https://open-vsx.org/extension/winterdrive/virtual-tabs)
[![AI-Ready Context](https://img.shields.io/badge/AI--Ready-LLMS.txt-blue?style=flat-square)](https://winterdrive.github.io/vscode-virtual-tabs/llms.txt)

[繁體中文](README.zh-TW.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | 简体中文

![VirtualTabs - VS Code File Grouping and AI Context Extension](assets/vscode-virtualtabs-grouping-banner.png)

---

## 什么是 VirtualTabs？

**VirtualTabs 是一个 VS Code 扩展，在真实文件系统之外提供自定义“虚拟文件目录”。** 它不会移动或复制磁盘文件，而是让你围绕当前任务建立持久的逻辑文件组，并一键复制 AI-ready context。它特别适合 Monorepo、MVC、MVVM 和大型项目。

![VirtualTabs vs Physical File System](assets/virtual_vs_physical_concept.png)

## 快速开始

![VirtualTabs 产品演示](assets/virtualtabs-product-demo.gif)

1. 在 VS Code 扩展市场搜索 **VirtualTabs** 并安装。
2. 打开左侧 Activity Bar 的 **VirtualTabs** 面板。
3. 右键面板或范围标题，创建新组。
4. 从 Explorer 将文件或文件夹拖入组。
5. 右键组，使用 **Copy... -> Copy Context for AI** 复制给 ChatGPT、Claude 或 Copilot。

## 核心能力

- **跨目录分组**：把不同目录下的相关文件放进同一个逻辑组。
- **任务导向书签**：在组内文件上标记关键代码行，快速回到特定逻辑点。
- **子组与嵌套结构**：用层级结构组织复杂功能。
- **AI Context 导出**：把一个组内的文件内容整理成适合 LLM 阅读的 Markdown。
- **便携配置**：组数据保存到 `.vscode/virtualTab.json`，可提交给团队共享。
- **MCP 集成**：通过 Model Context Protocol 让 AI agent 程序化管理组。
- **Agent Skill 生成器**：从扩展内生成可复用的 `virtualtabs` skill/rule。
- **Multi-root 范围**：在 multi-root workspace 中按项目分开保存组。
- **Send to...**：把选中的文件或整个组发送到预设目标。
- **文件重排序**：支持拖放或快捷键调整自定义组内顺序。

## MCP 与 Agent Skills

VirtualTabs 内置 MCP server，并提供 **VirtualTabs: Show MCP Config** 面板来生成可直接粘贴的客户端配置。连接后，Cursor、Claude、Copilot、Kiro、Antigravity 等 agent 可以读取组、创建组、加入文件、管理书签并导出 AI context。

使用 **Generate Agent Skill** 可以生成结构化的 `virtualtabs` skill/rule，让另一个 AI agent 知道 VirtualTabs 组是虚拟的、应优先使用 MCP 工具、并避免误改真实文件系统。

详细设置请参阅 [MCP Setup Guide](mcp-setup.md)。

## 推荐搭配

**Quick Prompt** 是 VirtualTabs 的互补工具：VirtualTabs 负责把文件按任务组织好，Quick Prompt 负责在 IDE 内记录想法与后续任务，减少 AI 辅助开发时的上下文切换。

## 支持

- [Bug 回报 / 功能建议](https://github.com/winterdrive/virtual-tabs/issues)
- [更新日志](../CHANGELOG.md)
- [开发文档](../DEVELOPMENT.md)

**License**: [MIT](../LICENSE)
