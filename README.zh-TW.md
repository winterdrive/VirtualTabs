# VirtualTabs – VS Code 虛擬分頁與自定義檔案分組擴充套件

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/winterdrive.virtual-tabs)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/winterdrive.virtual-tabs?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=winterdrive.virtual-tabs)
[![AI-Ready Context](https://img.shields.io/badge/AI--Ready-LLMS.txt-blue?style=flat-square)](https://winterdrive.github.io/VirtualTabs/llms.txt)

繁體中文 | **[English](readme.md)**

![VirtualTabs - VS Code File Grouping and AI Context Extension](docs/assets/vscode-virtualtabs-grouping-banner.png)

---

## 🚀 什麼是 VirtualTabs？

**VirtualTabs 是一個 VS Code 擴充套件，在原生檔案目錄之外，提供自定義「虛擬檔案目錄」。** 不同於原生目錄，VirtualTabs 幫助您建立 **獨立的邏輯檔案群組**，可依照當前開發主題建立虛擬檔案目錄，同時也提供 **AI 就緒的編程上下文（AI-Ready Context）** 可快速複製。適合 Monorepo 專案或採用 MVVM、MVC 架構的大型專案。

---

### ⚡ VirtualTabs vs. 原生 VS Code 分頁

| 功能特點 | 原生 VS Code 分頁 | VirtualTabs 擴充套件 |
| :--- | :--- | :--- |
| **持久性** | 關閉視窗即清除 | **永久保存** (依工作區記憶) |
| **檔案分組** | 僅限資料夾結構 | **邏輯導向** (支援跨目錄) |
| **AI 上下文** | 需手動一一收集 | **一鍵生成** 給 LLM 的上下文 |

---

## ✨ 主要功能

### 🛠️ 核心能力

- **📁 跨目錄分組** — 從任何地方組織檔案，突破資料夾限制
- **🔖 任務導向書籤** — 在群組中標記特定程式碼行，快速導航 `(v0.2.0)`
- **📂 子群組與巢狀結構** — 在群組內建立群組，實現更好的層級組織 `(v0.3.0)`
- **🤖 AI 上下文匯出** — 一鍵複製所有檔案為 LLM 就緒的上下文 `(v0.3.0)`
- **▶️ 腳本執行** — `.bat` 與 `.exe` 檔案的 inline 執行按鈕 `(v0.3.2)`
- **💾 便攜設定** — 設定儲存於 `.vscode/virtualTab.json`，方便團隊共享 `(v0.3.2)`

### ⚡ 工作流程加速

- **📋 智慧複製選單** — 統一的檔案與群組複製選項 `(v0.3.0)`
- **📁 目錄拖放** — 拖曳資料夾以遞迴加入所有檔案 `(v0.3.0)`
- **✂️ 完整的剪貼簿操作** — 支援檔案與群組的剪下/複製/貼上 `(v0.3.0)`
- **⇵ 群組排序** — 透過右鍵選單輕鬆上下移動群組 `(v0.3.2)`
- **📊 智慧組織** — 依副檔名、修改日期自動分組，或自訂排序準則

---

## ⚡ 最新亮點

![複製選單示範](docs/assets/copy_menu_demo.png)

**v0.3.6** 重磅推出強大的多選複製功能:

- 🎯 **多選複寫支援 (核心改進)** — 支援一次選取多個檔案/群組並進行複製。
  - 支援一鍵複製：檔名、相對路徑、絕對路徑。
  - 增強型「複製 AI 上下文」：完美處理混合選擇（檔案 + 群組 + 書籤），並自動執行內容去重。
- 🎨 **智慧整合選單** — 捨棄冗餘的重複選單，將 4 個子目錄整合為單一智慧選單。
- 🔧 **系統擴充性提升** — 引入真正的循環檢測與更強大的型別安全檢查，確保大型專案運作無虞。

**v0.3.3** 使用者體驗優化：

- ⚙️ **操作確認開關** — 可在設定中自由切換刪除檔案時的確認對話框。
- 🌍 **在地化支援** — 全面優化繁體中文與簡體中文的訊息提示。

---

## 🚀 快速開始

### 安裝

1. 開啟 VS Code
2. 按 `Ctrl+Shift+X`（或 `Cmd+Shift+X`）
3. 搜尋 **VirtualTabs** 並點擊安裝

### 首次設定

1. 點擊活動列（左側邊欄）中的 **VirtualTabs** 圖示
2. 在面板中右鍵 → **建立新群組**
3. 將檔案拖曳到群組中
4. 右鍵群組 → **依副檔名自動分組**（可選）

### 基本操作

#### 建立群組

- 在 VirtualTabs 面板中右鍵 → **建立新群組**
- 為群組命名（例如「AI 上下文」、「功能：認證」、「Bug 修復 #123」）
- 右鍵任何群組 → **新增子群組** 以進行巢狀組織

#### 加入檔案

- **拖放檔案**：從檔案總管拖曳檔案到群組
- **拖放資料夾**：拖曳資料夾以遞迴加入所有檔案（v0.3.0）
- **多選**：按住 `Ctrl`（或 `Cmd`）點擊檔案，然後一起拖曳
- **目前開啟**：內建群組自動與您開啟的分頁同步

#### 使用書籤（v0.2.0）

1. 在編輯器中任意行右鍵 → **加入書籤到 VirtualTabs**
2. 書籤會顯示在側邊欄的檔案下方
3. 點擊書籤跳轉到該行
4. 右鍵書籤 → **編輯標籤** 或 **編輯描述**

#### AI 上下文匯出（v0.3.0）

1. 右鍵群組 → **複製...** → **複製 AI 上下文**
2. 直接貼到 ChatGPT、Claude 或任何 LLM
3. 所有檔案都以適當的程式碼區塊格式化

#### 排序檔案（v0.1.0）

- 右鍵群組 → **排序檔案** 子選單
- 選擇：名稱、路徑、副檔名或修改時間
- 切換升序/降序
- 每個群組記住自己的排序偏好

#### 右鍵選單指南

VirtualTabs 提供豐富的右鍵選單選項，讓檔案和群組管理更有效率：

- **群組操作**：新增/重命名/複製、上移/下移、批次開啟/關閉、以及自動分組。
- **檔案操作**：批次開啟/關閉（支援多選）、從群組移除、刪除至回收站、以及腳本執行 (.bat/.exe)。
- **複製選單**：統一的子選單，可複製名稱、路徑或完整的 AI 上下文。
- **書籤**：快速導航、編輯標籤/描述、以及檔案管理。

> [!TIP]
> **技術參考**：如需所有項目類型的完整命令可用性矩陣，請參閱 **[DEVELOPMENT.md (英文)](./DEVELOPMENT.md#menu-availability-matrix)**。

**多選提示：**

- 按住 `Ctrl` (或 `Cmd`) 並點擊以選取多個檔案。
- 右鍵任何選取的檔案以將操作套用到所有檔案。
- 或直接右鍵任何檔案而無需預先選取，快速執行單一項目操作。

---

## 💡 為什麼選擇 VirtualTabs？

### 🧩 解決開發中的痛點

在 MVC/MVVM 或大型專案中，相關聯的檔案往往散布在多個目錄下，切換檔案非常耗時：

```text
❌ 傳統檔案結構：
├── config.json          (根目錄配置)
├── styles/theme.css     (樣式層)
├── src/components/      (元件視圖層)
└── tests/__tests__/     (測試層)

✅ 使用 VirtualTabs 建立的主題目錄：
📁 功能專題：主題系統
  ├── 📁📚 相關配置
  │   └── config.json
  ├── 📁📚 樣式定義
  │   └── theme.css
  ├── 📁📚 元件實作 (View Layer)
  │   └── ThemeProvider.tsx
  │     └── 🔖 第 45 行：Context 初始化邏輯
  └── 📁📚 單元測試 (Testing)
      └── theme.test.ts
```

### 🤖 為 AI 協作而生

在 Copilot 與 ChatGPT 盛行的時代，**「精準的上下文」是得到好結果的關鍵**：

- **精準篩選**：只選取與當前任務 *絕對相關* 的檔案組成群組。
- **一鍵導出**：將整個群組轉換為 AI 友善的 Markdown 格式（v0.3.0）。
- **降低雜訊**：隔離無關代碼，讓 AI 專注於核心邏輯。
- **上下文持久化**：即使重啟專案，開發上下文依然在那裡。

> *「VirtualTabs 讓我能為 AI 圈出最準確的代碼邊界。」*

### 🎯 適用場景

- **Monorepo 管理**：集中管理跨 Package 的相關設定與邏輯。
- **架構導向開發**：依 MVC 邏輯層次組織檔案，而非受限於物理目錄。
- **AI 輔助開發**：為 AI 建立精確的上下文集，大幅提升 Prompt 準確率。
- **程式碼審查 (CR)**：將變動的檔案集中，提高審查效率。
- **專題學習**：建立關鍵代碼的精選輯，不受其他文件干擾。

---

## 📸 功能詳解

### 📁 群組管理

- 建立、刪除、重命名和複製自訂群組
- **子群組** 進行層級組織（v0.3.0）
- 內建 **「目前開啟的檔案」** 群組（自動與 VS Code 分頁同步）
- 拖放檔案到群組內或群組間
- 拖放資料夾以遞迴加入所有檔案（v0.3.0）
- 每個群組獨立且持久化

### 🔖 任務導向書籤（v0.2.0）

- **智慧流程**：右鍵任意行 → 即時建立書籤
- **上下文感知**：書籤綁定到您的群組
- **快速導航**：直接從側邊欄跳轉到特定行
- **智慧標籤**：自動使用行內容或選取內容作為標籤

![Bookmarks Feature](docs/assets/bookmarks_feature.png)

### 🤖 AI 整合（v0.3.0）

- **複製 AI 上下文**：將所有檔案匯出為 markdown 程式碼區塊
- **智慧二進位偵測**：自動跳過圖片、壓縮檔等
- **大檔案處理**：內容超過 50KB 時在編輯器中開啟
- **遞迴匯出**：包含所有子群組的檔案

### 📊 智慧組織（v0.1.0）

**依副檔名自動分組：**

- 右鍵群組 → **依副檔名自動分組**
- 建立子群組：`.js`、`.css`、`.json` 等

**依日期自動分組：**

- 右鍵群組 → **依修改日期自動分組**
- 建立子群組：今天、昨天、本週、本月、更早

**彈性排序：**

- 排序依據：名稱（A-Z）、路徑、副檔名、修改時間
- 切換升序/降序
- 清除排序以恢復插入順序

### 🛠️ 實用工具

- **複製選單** 提供檔案和群組的統一選項
- 複製檔名、相對路徑或絕對路徑
- 開啟包含資料夾
- 多檔案批次操作（開啟/關閉/移除）
- 群組間複製/貼上檔案（v0.3.0）
- 自動儲存群組狀態（持久化在 `workspaceState`）

---

## 💡 最佳實踐

1. **依任務分組，而非資料夾**：思考您正在做什麼，而非檔案在哪裡
2. **使用子群組**：用巢狀結構組織大型群組（v0.3.0）
3. **用書籤標記邏輯流程**：標記程式碼中的關鍵決策點
4. **建立 AI 上下文群組**：將 5-10 個檔案分組以獲得專注的 AI 協助
5. **提示前先匯出**：在詢問 LLM 前使用「複製 AI 上下文」
6. **定期審查整理**：定期清理未使用的群組以保持組織

---

## 🌍 語言支援

VirtualTabs 根據您的 VS Code 語言設定自動切換：

- 🇺🇸 英文 (`en`)
- 🇹🇼 繁體中文 (`zh-tw`)
- 🇨🇳 簡體中文 (`zh-cn`)

更改您的 VS Code 語言設定即可立即切換語言。

---

## ❓ 常見問題

### Q1：我看不到 VirtualTabs 面板？

**檢查：**

- 擴充功能已啟用
- 您的 VS Code 版本是 1.75+
- VirtualTabs 在活動列（左側邊欄）有自己的圖示

### Q2：如何建立子群組？

右鍵任何群組 → **新增子群組**。您也可以將群組拖曳到另一個群組上以進行巢狀。

### Q3：「複製 AI 上下文」如何運作？

它會讀取群組中的所有檔案（包括子群組），將它們格式化為 markdown 程式碼區塊，然後複製到剪貼簿。二進位檔案會自動跳過。

### Q4：可以與團隊分享群組嗎？

目前，群組儲存在 `workspaceState`（本地）或 `.vscode/virtualTab.json`（可共享）。v0.3.2 已支援 `.vscode` 儲存！

### Q5：書籤在檔案重命名後還能用嗎？

可以！書籤追蹤檔案路徑，如果您在 VS Code 內重命名檔案，它們會更新。

### Q6：如何將資料夾拖曳到群組中？

只需從檔案總管面板將資料夾拖曳到群組上。VirtualTabs 會自動遞迴加入所有檔案，跳過目錄項目本身。

---

## 🔧 開發者專區

有興趣貢獻嗎？查看 **[DEVELOPMENT.md](./DEVELOPMENT.md)**：

- 環境設定
- 除錯與發布指南
- 模組結構與資料流程圖
- 常見錯誤排除

---

## 🤝 貢獻

我們歡迎社群貢獻：

- 🐞 **Bug 回報** → [GitHub Issues](https://github.com/winterdrive/virtual-tabs/issues)
- ✨ **功能建議** 和 UI 建議
- 🔧 **程式碼貢獻**（fork 並提交 PR）
- 🌍 **翻譯** 新語言

---

## 🤝 推薦搭配

### 🔥 Quick Prompt

**VirtualTabs 的完美夥伴。**

**VirtualTabs** 組織您的**上下文**（檔案），**Quick Prompt** 組織您的**指示**（提示）。

- **VirtualTabs**：定義 AI 應該*看哪裡*（檔案群組）
- **Quick Prompt**：定義 AI 應該*做什麼*（提示管理）

兩者結合，創造終極 AI 編程工作流程。

在 [**VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=winterdrive.quick-prompt?utm_source=virtualtabs&utm_medium=readme&utm_campaign=cross_promotion) | [**Open VSX Registry**](https://open-vsx.org/extension/winterdrive/quick-prompt?utm_source=virtualtabs&utm_medium=readme&utm_campaign=cross_promotion) 取得 Quick Prompt

---

## 📅 更新日誌

### ✅ v0.3.6（最新）

- 🎯 **多選複製支援** — 所有複製指令現支援選取多個檔案/群組
- 🎨 **統一複製選單** — 將 4 個重複子選單整合為一個智慧選單
- 🔧 **提升可靠性** — 使用 `instanceof` 檢查改善型別安全,Set-based 循環檢測
- 🐛 **Bug 修復** — 修正指令命名空間衝突與書籤上下文處理

### ✅ v0.3.3

- ✅ 可配置的刪除操作確認對話框
- ✅ 國際化確認訊息（EN/ZH-TW/ZH-CN）
- ✅ 重構確認邏輯為可重用工具函式

### ✅ v0.3.2

- ✅ 腳本 inline 執行按鈕 (.bat/.exe)
- ✅ 群組排序（上移/下移）
- ✅ 儲存位置移至 `.vscode/virtualTab.json`
- ✅ 展開狀態記憶

### ✅ v0.3.0

- ✅ 子群組與巢狀結構
- ✅ AI 上下文匯出（「複製 AI 上下文」）
- ✅ 統一複製選單與智慧行為
- ✅ 目錄拖放（遞迴加入檔案）
- ✅ 複製/貼上/刪除操作
- ✅ 多選刪除群組和檔案
- ✅ 增強拖放與書籤保留

### ✅ v0.2.0

- ✅ 任務導向書籤與智慧流程
- ✅ 增強的書籤和檔案樹狀視圖
- ✅ 編輯書籤標籤和描述

### ✅ v0.1.0

- ✅ 檔案排序（名稱、路徑、副檔名、修改時間）
- ✅ 依修改日期自動分組
- ✅ 每群組排序偏好
- ✅ 完整 i18n 支援（EN、ZH-TW、ZH-CN）

---

## 📄 授權

採用 **MIT 授權**。個人和商業使用皆免費。

---

**更聰明地組織，更快速地編程。** 🚀
