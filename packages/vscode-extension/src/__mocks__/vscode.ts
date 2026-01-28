import { vi } from 'vitest';

// Track registered tools for testing
export const registeredTools: Record<string, any> = {};

export const lm = {
  registerTool: vi.fn().mockImplementation((name, tool) => {
    registeredTools[name] = tool;
    return { dispose: vi.fn() };
  }),
};

export const commands = {
  registerCommand: vi.fn(),
};

export const window = {
  createWebviewPanel: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    dispose: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    dispose: vi.fn(),
  })),
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
};

export const ViewColumn = {
  One: 1,
  Beside: 2,
};

export const Uri = {
  file: vi.fn(),
};

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
};

export class ExtensionContext {
  subscriptions: any[] = [];
}

export class LanguageModelToolResult {
  constructor(public parts: unknown[]) {
    return { content: parts } as any;
  }
}

export class LanguageModelTextPart {
  constructor(public text: string) {
    return { text } as any;
  }
}
