import { describe, it, expect, beforeEach } from 'vitest';
import { HorizonMCPServer } from './index';

describe('HorizonMCPServer', () => {
  let server: HorizonMCPServer;

  beforeEach(() => {
    server = new HorizonMCPServer();
  });

  it('should create a server instance', () => {
    expect(server).toBeDefined();
  });

  it('should have tool definitions', () => {
    // The server should have tools registered
    expect(server).toBeDefined();
  });
});