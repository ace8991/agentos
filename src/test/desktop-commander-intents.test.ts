import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDirectoryMock: vi.fn(),
  getDCConfigMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock('@/lib/desktop-commander', () => ({
  createDirectory: mocks.createDirectoryMock,
  executeCommand: vi.fn(),
  getDCConfig: mocks.getDCConfigMock,
  getSystemInfo: vi.fn(),
  listDirectory: vi.fn(),
  readFile: vi.fn(),
  searchFiles: vi.fn(),
  writeFile: mocks.writeFileMock,
}));

import { executeDesktopCommanderIntent } from '@/lib/desktop-commander-intents';

describe('desktop commander intents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDCConfigMock.mockResolvedValue({
      home: 'C:/Users/User',
    });
  });

  it('creates a desktop folder when the request targets the Windows screen', async () => {
    mocks.createDirectoryMock.mockResolvedValue({
      success: true,
      description: 'Created directory: C:/Users/User/Desktop/zopbop',
      path: 'C:/Users/User/Desktop/zopbop',
    });

    const result = await executeDesktopCommanderIntent('cree un folder nommer zopbop sur mon windows ecran');

    expect(mocks.createDirectoryMock).toHaveBeenCalledWith('C:/Users/User/Desktop/zopbop');
    expect(result?.actionType).toBe('dir_create');
    expect(result?.resultMarkdown).toContain('C:/Users/User/Desktop/zopbop');
  });

  it('still creates a text file for a plain file request', async () => {
    mocks.writeFileMock.mockResolvedValue({
      success: true,
      description: 'Wrote 5 bytes to test.txt',
      path: 'C:/Users/User/Documents/test.txt',
      bytes_written: 5,
    });

    const result = await executeDesktopCommanderIntent('cree un fichier nomme test avec hello');

    expect(mocks.writeFileMock).toHaveBeenCalledWith('C:/Users/User/Documents/test.txt', 'hello', 'rewrite');
    expect(result?.actionType).toBe('file_write');
  });
});
