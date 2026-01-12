# Change Log

All notable changes to the "VirtualTabs" extension will be documented in this file.

## [0.3.6] - 2026-01-14

### Added

- **🎯 Multi-select Copy (Core Productivity Feature)**: All copy commands now support multi-selection:
  - `Copy File Name` - Select multiple files/groups and copy all names at once.
  - `Copy Relative Path` - Multi-select support with automatic deduplication.
  - `Copy Absolute Path` - Multi-select support with automatic deduplication.
  - `Copy Group Context` - Enhanced to handle mixed selections (files + groups + bookmarks) for better AI prompt preparation.

### Changed

- **Unified Copy Menu**: Consolidated 4 duplicate copy submenus into a single smart menu that adapts to selection type, drastically reducing UI clutter.
- **Robust Selection Logic**: Refactored core commands to consistently prioritize multi-selection over right-clicked items using a unified `resolveTargetItems` helper.
- **Improved Context Menu Precision**: Strict `viewItem` regex checks prevent command "ghosting" on unrelated items.
- **Type Safety & Reliability**: Replaced legacy Duck Typing with `instanceof` checks and implemented Set-based cycle detection for circular references.

### Fixed

- **Command Namespace Conflict**: Renamed `deleteFile` to `virtualTabs.deleteFile` for better system compatibility.
- **Bookmark Context Handling**: `Copy Group Context` now correctly handles bookmark items and displays hierarchical group paths.

## [0.3.3] - 2025-12-31

> **Special Thanks**: [@jianfulin](https://github.com/jianfulin) for the major contribution! 🎉

### Added

- **Configurable Confirmation Dialogs**: New setting `virtualTabs.confirmBeforeDelete` to control whether confirmation dialogs appear before deleting groups or files (default: enabled).
- Confirmation messages now support internationalization (i18n) for English, Traditional Chinese, and Simplified Chinese.

### Changed

- Refactored confirmation logic into reusable `executeWithConfirmation` utility function in `util.ts`.
- Improved user experience with modal confirmation dialogs for delete operations.

## [0.3.2] - 2025-12-21

> **Special Thanks**: [@jianfulin](https://github.com/jianfulin) for the major contribution! 🎉

### Added

- **Group Reordering**: Move groups up or down via context menu commands.
- **Executable File Support**: `.bat` and `.exe` files now have an inline "Run" button. Clicking the file itself still opens it in editor for consistency.
- **Expanded State Persistence**: Remember which groups are expanded/collapsed across VS Code restarts.
- Persist group/bookmark data to `.vscode/virtualTab.json`.
- Store file references in `virtualTab.json` as paths relative to the workspace root.

### Changed

- **Storage Location**: Moved `virtualTab.json` from workspace root to `.vscode/virtualTab.json` for cleaner project structure.
- Allow duplicate group names when IDs differ.

### Fixed

- Improved shell command quoting for cross-platform terminal execution.

## [0.3.0] - 2025-12-13

### Added

- **Sub-Groups & Nested Structure**: Create hierarchical group organization by adding sub-groups or dragging groups onto each other.
- **AI Context Export**: Copy all files in a group as LLM-ready markdown with "Copy Context for AI" command.
- **Unified Copy Menu**: New submenu with smart behavior - copies work differently on groups vs files.
- **Directory Drag & Drop**: Drag folders from Explorer to recursively add all files within.
- **Copy/Paste/Delete Commands**: Full clipboard operations for files and groups within VirtualTabs.
- **Multi-select Delete**: Delete multiple groups or files at once.
- **File Move with Bookmarks**: Dragging files between groups preserves their bookmarks.

### Changed

- Groups now require unique IDs for stable references (auto-migrated from older versions).
- Improved drag-and-drop controller with better file/group/directory detection.
- Context menus reorganized with separate submenus for different item types.
- Copy File Name/Path commands now work on groups (copies all files recursively).

### Fixed

- Fixed circular nesting detection when dragging groups.
- Fixed bookmark preservation when moving files between groups.
- Improved error handling for large file context copying.

## [0.2.0] - 2025-12-01

### Added

- **Task-Oriented Bookmarks**: You can now add bookmarks to specific lines of code within your VirtualTabs groups.
- **Smart Flow**: Right-click to add bookmarks instantly without annoying input boxes. The system automatically labels them based on line content.
- **Bookmark Navigation**: Click on a bookmark in the sidebar to jump directly to the code location.
- **Bookmark Management**: Edit bookmark labels and descriptions, or remove them via the context menu.

### Changed

- Improved TreeView performance when handling groups with many files.
- Updated `package.json` to include new bookmark commands and menus.
- Refined UI for file items in the sidebar (click to open).

### Fixed

- Fixed an issue where file icons might not display correctly in some themes.

## [0.1.0] - 2025-11-20

### Added

- Initial release of VirtualTabs.
- Custom file grouping.
- Built-in "Open Editors" group.
- File sorting (Name, Path, Extension, Modified Time).
- Auto-group by modification date.
- Internationalization (i18n) support for English, Traditional Chinese, and Simplified Chinese.
