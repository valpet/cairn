import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from './git';
import simpleGit from 'simple-git';

vi.mock('simple-git');

const mockSimpleGit = vi.mocked(simpleGit);

describe('GitService', () => {
  let gitService: GitService;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      checkIsRepo: vi.fn(),
      init: vi.fn(),
      add: vi.fn(),
      status: vi.fn(),
      commit: vi.fn(),
    };
    mockSimpleGit.mockReturnValue(mockGit as any);
    gitService = new GitService('/fake/repo');
  });

  it('should init if not repo', async () => {
    mockGit.checkIsRepo.mockResolvedValue(false);
    mockGit.init.mockResolvedValue(undefined);

    await gitService.initIfNeeded();

    expect(mockGit.checkIsRepo).toHaveBeenCalled();
    expect(mockGit.init).toHaveBeenCalled();
  });

  it('should not init if already repo', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);

    await gitService.initIfNeeded();

    expect(mockGit.checkIsRepo).toHaveBeenCalled();
    expect(mockGit.init).not.toHaveBeenCalled();
  });

  it('should commit changes when there are modified files', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);
    mockGit.add.mockResolvedValue(undefined);
    mockGit.status.mockResolvedValue({ modified: ['.horizon/issues.jsonl'], not_added: [] });
    mockGit.commit.mockResolvedValue(undefined);

    await gitService.commitChanges('Test commit');

    expect(mockGit.add).toHaveBeenCalledWith('.horizon');
    expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
  });

  it('should not commit when no changes', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);
    mockGit.add.mockResolvedValue(undefined);
    mockGit.status.mockResolvedValue({ modified: [], not_added: [] });

    await gitService.commitChanges('Test commit');

    expect(mockGit.add).toHaveBeenCalledWith('.horizon');
    expect(mockGit.commit).not.toHaveBeenCalled();
  });

  it('should not commit if not a git repo', async () => {
    mockGit.checkIsRepo.mockResolvedValue(false);

    await gitService.commitChanges('Test commit');

    expect(mockGit.add).not.toHaveBeenCalled();
    expect(mockGit.commit).not.toHaveBeenCalled();
  });

  it('should return isGitRepo status', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);

    const result = await gitService.isGitRepo();

    expect(result).toBe(true);
    expect(mockGit.checkIsRepo).toHaveBeenCalled();
  });
});