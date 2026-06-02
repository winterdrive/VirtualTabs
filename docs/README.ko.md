# VirtualTabs - VS Code 가상 탭 및 사용자 지정 파일 그룹 확장

[![Visual Studio Marketplace Version](https://vsmarketplacebadges.dev/version-short/winterdrive.virtual-tabs.svg)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Open VSX Version](https://img.shields.io/open-vsx/v/winterdrive/virtual-tabs)](https://open-vsx.org/extension/winterdrive/virtual-tabs)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/winterdrive/virtual-tabs)](https://open-vsx.org/extension/winterdrive/virtual-tabs)
[![AI-Ready Context](https://img.shields.io/badge/AI--Ready-LLMS.txt-blue?style=flat-square)](https://winterdrive.github.io/vscode-virtual-tabs/llms.txt)

[繁體中文](README.zh-TW.md) | [English](../README.md) | [日本語](README.ja.md) | 한국어 | [简体中文](README.zh-CN.md)

![VirtualTabs - VS Code File Grouping and AI Context Extension](assets/vscode-virtualtabs-grouping-banner.png)

---

## VirtualTabs란?

**VirtualTabs는 실제 파일 시스템 밖에 작업 중심의 "가상 파일 디렉터리"를 만드는 VS Code 확장입니다.** 파일을 이동하거나 복사하지 않고, 현재 작업 주제에 맞는 영구적인 논리 그룹을 만들 수 있으며, 이를 AI-ready context로 한 번에 복사할 수 있습니다. Monorepo, MVC, MVVM, 대규모 프로젝트에 적합합니다.

![VirtualTabs vs Physical File System](assets/virtual_vs_physical_concept.png)

## Quick Start

![VirtualTabs product demo](assets/virtualtabs-product-demo.gif)

1. VS Code Marketplace에서 **VirtualTabs**를 검색해 설치합니다.
2. Activity Bar에서 **VirtualTabs** 뷰를 엽니다.
3. 패널 또는 scope 헤더를 우클릭해 새 그룹을 만듭니다.
4. Explorer에서 파일이나 폴더를 그룹으로 드래그합니다.
5. 그룹을 우클릭하고 **Copy... -> Copy Context for AI**를 사용해 ChatGPT, Claude, Copilot에 붙여 넣을 context를 복사합니다.

## 주요 기능

- **디렉터리 경계를 넘는 그룹화**: 서로 다른 위치의 관련 파일을 하나의 논리 그룹으로 묶습니다.
- **작업 중심 북마크**: 중요한 코드 라인을 그룹 안에 기록하고 바로 이동합니다.
- **하위 그룹과 중첩 구조**: 복잡한 기능을 계층적으로 정리합니다.
- **AI Context Export**: 그룹 내 파일을 LLM이 읽기 쉬운 Markdown으로 복사합니다.
- **휴대 가능한 설정**: 그룹 정보는 `.vscode/virtualTab.json`에 저장되어 팀과 공유할 수 있습니다.
- **MCP 통합**: Model Context Protocol을 통해 AI agent가 그룹을 프로그래밍 방식으로 관리합니다.
- **Agent Skill Generator**: 재사용 가능한 `virtualtabs` skill/rule을 확장 안에서 생성합니다.
- **Multi-root scope**: multi-root workspace에서 프로젝트별로 그룹을 분리합니다.
- **Send to...**: 선택한 파일이나 그룹을 미리 설정한 대상으로 보냅니다.
- **파일 순서 변경**: 드래그 앤 드롭 또는 키보드 단축키로 순서를 조정합니다.

## MCP 및 Agent Skills

VirtualTabs에는 MCP server가 내장되어 있으며, **VirtualTabs: Show MCP Config** 패널에서 AI 클라이언트 설정을 복사할 수 있습니다. 연결 후 Cursor, Claude, Copilot, Kiro, Antigravity 등의 agent는 그룹 목록 조회, 그룹 생성, 파일 추가, 북마크 관리, AI context 내보내기를 수행할 수 있습니다.

**Generate Agent Skill**을 사용하면 다른 AI agent가 VirtualTabs를 올바르게 사용하도록 돕는 구조화된 `virtualtabs` skill/rule을 생성할 수 있습니다. 이 skill은 VirtualTabs 그룹이 실제 파일 시스템 폴더가 아니라 가상 그룹이라는 점을 명확히 안내합니다. 공식 skill을 직접 설치할 수도 있습니다:

```bash
npx skills add winterdrive/VirtualTabs
```

자세한 내용은 [MCP Setup Guide](mcp-setup.md)를 참고하세요.

## 추천 companion

**Quick Prompt**는 VirtualTabs와 함께 쓰기 좋은 도구입니다. VirtualTabs는 파일을 작업 단위로 정리하고, Quick Prompt는 IDE 안에서 아이디어와 다음 작업을 기록합니다.

## Support

- [Bug reports / feature requests](https://github.com/winterdrive/virtual-tabs/issues)
- [Changelog](../CHANGELOG.md)
- [Development guide](../DEVELOPMENT.md)

**License**: [MIT](../LICENSE)
