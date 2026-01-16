import { injectable, inject } from 'inversify';
import simpleGit, { SimpleGit } from 'simple-git';

export interface IGitService {
  initIfNeeded(): Promise<void>;
  commitChanges(message: string): Promise<void>;
  isGitRepo(): Promise<boolean>;
}

@injectable()
export class GitService implements IGitService {
  private git: SimpleGit;

  constructor(@inject('repoPath') private repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async initIfNeeded(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
    }
  }

  async commitChanges(message: string): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) return;
    await this.git.add('.horizon');
    const status = await this.git.status();
    if (status.modified.length > 0 || status.not_added.length > 0) {
      await this.git.commit(message);
    }
  }

  async isGitRepo(): Promise<boolean> {
    return await this.git.checkIsRepo();
  }
}