# Changelog

All notable changes to the Cairn VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.4] - 2026-01-26

### Changed
- Updated README description to better emphasize Cairn's value proposition for AI agents
- Improved documentation highlighting structured collaboration between developers and AI agents

### Fixed
- CLI version display now reads from package.json instead of hardcoded value
- Fixed version consistency across monorepo packages


## [1.2.3] - 2026-01-26

### Fixed
- Proper package imports

## [1.2.2] - 2026-01-25

### Changed
- Minor improvement

## [1.2.1] - 2026-01-25

### Added
- Screenshots section in README showing Task List and Task Editor interfaces

### Changed
- Updated README with improved documentation and visual examples
- Removed redundant "Active" indicator behind the issue file selector for cleaner UI

## [1.2.0] - 2026-01-25

### Added
- Completion percentage calculation for issues based on acceptance criteria and subtasks
- Automatic migration system for legacy issue formats (blocked status → open, blocks dependency → blocked_by)
- Cycle detection to prevent circular dependencies in parent-child and blocking relationships
- Support for multiple issue files with file switching capabilities

### Changed
- Rewrote VS Code extension UI using React components with comprehensive test coverage

## [1.1.0] - 2026-01-21

### Added
- Empty states for Acceptance Criteria, Sub-issues, Blocked by and Blocking sections with helpful guidance messages
- Dropdown button styling for Type, Priority, and Status selectors with dynamic color coding
- Consistent icons for dropdown buttons and status indicators for better visual recognition
- Comprehensive input validation for JSONL storage system with type guards and runtime validation
- File path sanitization to prevent directory traversal attacks
- Detailed error reporting for invalid issue data with specific validation messages
- Validation to prevent closing issues with open sub-issues across all interfaces
- Computed sub-issue status display showing "Issue Status / Computed Status" when computed status differs from actual status
- Status pill colors that reflect computed sub-issue status when it differs from the issue's own status

### Changed
- Redesigned edit view layout with header/property row structure for improved information hierarchy
- Moved Created/Updated dates to header section for better context
- Removed Properties section entirely, consolidating information into cleaner layout
- Updated "In Progress" status icon from ▶ to ◐ for better consistency
- Made section/accordion titles match "Edit Issue" title color for visual consistency
- Lowered opacity of empty states for more subtle visual presence
- Status pills now prevent text wrapping with white-space: nowrap for single-line display
- Type, Status, and Priority pills are now horizontally centered within their containers
- Pills in edit view are centered within their flex containers for improved alignment

### Security
- Enhanced data integrity validation for all Issue object properties
- Runtime type checking for status, priority, type, and dependency fields
- ISO date string validation to prevent malformed timestamp data

## [1.0.4] - 2024-01-21

### Added
- Acceptance criteria management for tasks
- Issue ID display with copy-to-clipboard functionality

### Fixed
- Improved task description display with better truncation and expansion
- Enhanced title truncation for better readability in panels
- Updated default status filters for improved task management
- Updated API documentation to reflect current interface changes
- Improved markdown rendering performance in webviews
- Various bug fixes and UI improvements

## [1.0.3] - 2024-01-21

### Fixed
- Bug fixes and technical improvements

## [1.0.2] - 2024-01-21

### Fixed
- Bug fixes and technical improvements

## [1.0.1] - 2024-01-20

### Fixed
- Fixed VSCode extension activation issues
- Improved build and publishing processes

## [1.0.0] - 2024-01-20

### Added
- Initial release of Cairn extension
- Task management integration
- AI agent context persistence
- Dependency-aware task graphs