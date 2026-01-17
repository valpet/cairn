import { describe, it, expect } from 'vitest';
import * as ContainerExports from './container';

describe('Container Module Exports', () => {
  it('should export createContainer function', () => {
    expect(ContainerExports.createContainer).toBeDefined();
    expect(typeof ContainerExports.createContainer).toBe('function');
  });

  it('should export TYPES object', () => {
    expect(ContainerExports.TYPES).toBeDefined();
    expect(typeof ContainerExports.TYPES).toBe('object');
  });

  it('should export all expected service type symbols', () => {
    expect(ContainerExports.TYPES.IStorageService).toBeDefined();
    expect(typeof ContainerExports.TYPES.IStorageService).toBe('symbol');

    expect(ContainerExports.TYPES.IGraphService).toBeDefined();
    expect(typeof ContainerExports.TYPES.IGraphService).toBe('symbol');

    expect(ContainerExports.TYPES.ICompactionService).toBeDefined();
    expect(typeof ContainerExports.TYPES.ICompactionService).toBe('symbol');
  });
});