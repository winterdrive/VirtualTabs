# Why VirtualTabs Exists

[繁體中文](zh-TW/PHILOSOPHY.md) | [日本語](ja/PHILOSOPHY.md) | [한국어](ko/PHILOSOPHY.md) | [简体中文](zh-CN/PHILOSOPHY.md) | English

The more execution AI agents take on, the more context a human ends up carrying. This idea was presented at [COSCUP 2026](https://coscup.org/2026/session/9CYHJT/): *AI Runs Faster, So Why Are Developers Getting More Lost?*

## What VirtualTabs is

VirtualTabs didn't start out as anything AI-related. The first commit only did group management and drag-and-drop, letting you organize files into logical groups outside the native file system, for the fairly mundane problem of "where did I put the files for this feature." AI-Ready Context, and later the MCP integration, were both added well after the project was already running.

The core of the tool hasn't changed: it's about your spatial awareness, not how deep the AI features go.

## Why spatial awareness matters more, not less, in the AI era

Once an agent starts running tasks for you, the amount of parallel work on your plate only grows. You might be watching several agents work on different things at once, while still needing to remember which file you just changed, or which group belongs to which task. That sense of "where am I right now" is easy to lose when several things run in parallel, and it has nothing to do with how capable the AI is. However smart the agent gets, you're still the one who has to remember what the workspace looks like.

Features like Auto Reveal Active File and drag-and-drop reordering exist for exactly this: no matter how much is running in the background, you can always tell which context you're in.

## Part of a bigger picture

VirtualTabs handles the spatial half of that problem: knowing where you are in a workspace running multiple tasks in parallel. Its companion [Quick Prompt](https://github.com/winterdrive/vscode-quick-prompt) ([Philosophy](https://github.com/winterdrive/vscode-quick-prompt/blob/main/docs/PHILOSOPHY.md)) handles the temporal half: what you were about to do next. [Edo Tensei](https://github.com/Pain-Labs/Edo-Tensei) handles a third piece: carrying a session's context to the next IDE when an agent or quota runs out.

Put together, they're less "three VS Code extensions" and more three answers to the same question: as agents take on more of the execution, what does a person actually need to stay oriented?
