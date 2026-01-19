import { Container } from 'inversify';
import { IStorageService, StorageService } from './storage';
import { IGraphService, GraphService } from './graph';
import { ICompactionService, CompactionService } from './compaction';

export const TYPES = {
  IStorageService: Symbol.for('IStorageService'),
  IGraphService: Symbol.for('IGraphService'),
  ICompactionService: Symbol.for('ICompactionService'),
};

export function createContainer(cairnDir: string, repoPath: string): Container {
  const container = new Container();
  container.bind<IStorageService>(TYPES.IStorageService).to(StorageService).inSingletonScope();
  container.bind<IGraphService>(TYPES.IGraphService).to(GraphService).inSingletonScope();
  container.bind<ICompactionService>(TYPES.ICompactionService).to(CompactionService).inSingletonScope();

  // Bind config
  container.bind('config').toConstantValue({ cairnDir });
  container.bind('repoPath').toConstantValue(repoPath);

  return container;
}