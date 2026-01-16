import { Container } from 'inversify';
import { IStorageService, StorageService } from './storage';
import { IGraphService, GraphService } from './graph';
import { ICompactionService, CompactionService } from './compaction';
import { IGitService, GitService } from './git';

export const TYPES = {
  IStorageService: Symbol.for('IStorageService'),
  IGraphService: Symbol.for('IGraphService'),
  ICompactionService: Symbol.for('ICompactionService'),
  IGitService: Symbol.for('IGitService'),
};

export function createContainer(horizonDir: string, repoPath: string): Container {
  const container = new Container();
  container.bind<IStorageService>(TYPES.IStorageService).to(StorageService).inSingletonScope();
  container.bind<IGraphService>(TYPES.IGraphService).to(GraphService).inSingletonScope();
  container.bind<ICompactionService>(TYPES.ICompactionService).to(CompactionService).inSingletonScope();
  container.bind<IGitService>(TYPES.IGitService).to(GitService).inSingletonScope();

  // Bind config
  container.bind('config').toConstantValue({ horizonDir });
  container.bind('repoPath').toConstantValue(repoPath);

  return container;
}