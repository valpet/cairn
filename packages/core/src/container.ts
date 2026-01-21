import { Container } from 'inversify';
import { IStorageService, StorageService } from './storage';
import { IGraphService, GraphService } from './graph';
import { ICompactionService, CompactionService } from './compaction';
import { ILogger, ConsoleLogger, LogLevel } from './logger';

export const TYPES = {
  IStorageService: Symbol.for('IStorageService'),
  IGraphService: Symbol.for('IGraphService'),
  ICompactionService: Symbol.for('ICompactionService'),
  ILogger: Symbol.for('ILogger'),
};

export function createContainer(cairnDir: string, repoPath: string): Container {
  const container = new Container();
  container.bind<IStorageService>(TYPES.IStorageService).to(StorageService).inSingletonScope();
  container.bind<IGraphService>(TYPES.IGraphService).to(GraphService).inSingletonScope();
  container.bind<ICompactionService>(TYPES.ICompactionService).to(CompactionService).inSingletonScope();
  container.bind<ILogger>(TYPES.ILogger).to(ConsoleLogger).inSingletonScope();

  // Bind config
  container.bind('config').toConstantValue({ cairnDir });
  container.bind('repoPath').toConstantValue(repoPath);

  return container;
}