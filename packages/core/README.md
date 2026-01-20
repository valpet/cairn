# @valpet/cairn-core

Core library for Cairn task management system.

## Installation

```bash
npm install @valpet/cairn-core
```

## Overview

This package provides the foundational data structures and business logic for Cairn, a task management system designed for AI agents and developers. It handles:

- JSONL-based storage with file locking
- Dependency graph management
- Issue compaction and optimization
- TypeScript interfaces and types

## Usage

```typescript
import { createContainer, TYPES, IStorageService, IGraphService } from '@valpet/cairn-core';

const container = createContainer('/path/to/.cairn', '/path/to/repo');
const storage = container.get<IStorageService>(TYPES.IStorageService);
const graph = container.get<IGraphService>(TYPES.IGraphService);

// Create and save a task
const task = {
  id: 'task-1',
  title: 'Implement user authentication',
  status: 'open',
  type: 'feature',
  priority: 'high',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

await storage.saveIssue(task);

// Get ready work
const readyTasks = graph.getReadyWork(await storage.loadIssues());
```

## API Reference

See the [full documentation](https://your-org.github.io/cairn/api/) for complete API reference.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.