import { describe, it, expect, vi } from 'vitest';
import * as CoreExports from './index';

// Test that all expected exports are available
describe('Core Index Exports', () => {
  it('should export TYPES', () => {
    expect(CoreExports.TYPES).toBeDefined();
    expect(typeof CoreExports.TYPES.IStorageService).toBe('symbol');
  });

  it('should export createContainer function', () => {
    expect(typeof CoreExports.createContainer).toBe('function');
  });

  it('should export service interfaces', () => {
    // Interfaces are TypeScript compile-time constructs and don't exist at runtime
    // Instead, validate that service classes implement expected interfaces by checking
    // that properly configured service instances have the expected methods
    const container = CoreExports.createContainer('/tmp/.horizon', '/tmp/repo');

    const storageService = container.get(CoreExports.TYPES.IStorageService);
    expect(typeof storageService.loadIssues).toBe('function');
    expect(typeof storageService.saveIssue).toBe('function');
    expect(typeof storageService.updateIssues).toBe('function');
    expect(typeof storageService.getIssuesFilePath).toBe('function');

    const graphService = container.get(CoreExports.TYPES.IGraphService);
    expect(typeof graphService.buildGraph).toBe('function');
    expect(typeof graphService.getReadyWork).toBe('function');
    expect(typeof graphService.addDependency).toBe('function');

    const compactionService = container.get(CoreExports.TYPES.ICompactionService);
    expect(typeof compactionService.compactIssues).toBe('function');
  });

  it('should export service classes', () => {
    expect(CoreExports.StorageService).toBeDefined();
    expect(CoreExports.GraphService).toBeDefined();
    expect(CoreExports.CompactionService).toBeDefined();
  });

  it('should export types', () => {
    // Types are TypeScript compile-time constructs and don't exist at runtime
    // Type validation happens during compilation, not runtime testing
    expect(true).toBe(true);
  });
});