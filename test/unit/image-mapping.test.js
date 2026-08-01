import { describe, it, expect } from 'vitest';
import { loadCodeGs } from '../support/loadGasSource.js';

const app = loadCodeGs();

describe('normalizeImageFileName_ (Drive filename -> lookup key)', () => {
  it('strips the file extension', () => {
    expect(app.normalizeImageFileName_('The Gruffalo.jpg')).toBe('the gruffalo');
  });

  it('collapses punctuation/casing differences the same way normalizeHeader_ does', () => {
    expect(app.normalizeImageFileName_('Franklin_chi-christmas.PNG')).toBe('franklin chi christmas');
  });

  it('handles a filename with no extension', () => {
    expect(app.normalizeImageFileName_('NoExtensionFile')).toBe('noextensionfile');
  });

  it('handles null/empty input without throwing', () => {
    expect(app.normalizeImageFileName_(null)).toBe('');
    expect(app.normalizeImageFileName_('')).toBe('');
  });
});

describe('buildDriveThumbnailUrl_', () => {
  it('builds a w400 thumbnail URL from a Drive file id', () => {
    expect(app.buildDriveThumbnailUrl_('abc123')).toBe(
      'https://drive.google.com/thumbnail?id=abc123&sz=w400'
    );
  });

  it('URL-encodes a file id containing special characters', () => {
    expect(app.buildDriveThumbnailUrl_('abc 123/xyz')).toBe(
      'https://drive.google.com/thumbnail?id=abc%20123%2Fxyz&sz=w400'
    );
  });
});

describe('findImageFileId_ (resolving a book cover from precomputed Drive maps, in fallback order)', () => {
  it('tier 1: finds an exact (case-insensitive) filename match first', () => {
    const fileIdMap = { 'the gruffalo.jpg': 'file-1' };
    const fileId = app.findImageFileId_('The Gruffalo.jpg', 'The Gruffalo', 'E0001', fileIdMap, {});
    expect(fileId).toBe('file-1');
  });

  it('tier 2: falls back to the normalized IMAGE PATH filename when no exact match exists', () => {
    // "the_gruffalo.jpg" normalizes to "the gruffalo" (underscore -> space,
    // extension stripped) — a different raw string than the exact key tier.
    const normalizedFileIdMap = { 'the gruffalo': 'file-2' };
    const fileId = app.findImageFileId_('the_gruffalo.jpg', 'Some Other Title', 'E9999', {}, normalizedFileIdMap);
    expect(fileId).toBe('file-2');
  });

  it('tier 3: falls back to the normalized BOOK NAME when the image path itself has no match', () => {
    const normalizedFileIdMap = { 'the gruffalo': 'file-3' };
    // imagePath normalizes to something unrelated, so tier 2 misses; bookName ("The Gruffalo") should hit.
    const fileId = app.findImageFileId_('unrelated-file.jpg', 'The Gruffalo', 'E9999', {}, normalizedFileIdMap);
    expect(fileId).toBe('file-3');
  });

  it('tier 4: falls back to the normalized BOOK NUMBER as a last resort', () => {
    const normalizedFileIdMap = { e0001: 'file-4' };
    const fileId = app.findImageFileId_('unrelated.jpg', 'Unrelated Title', 'E0001', {}, normalizedFileIdMap);
    expect(fileId).toBe('file-4');
  });

  it('returns empty string when nothing matches any tier', () => {
    const fileId = app.findImageFileId_('totally-unrelated.jpg', 'Unrelated Title', 'ZZ999', {}, {});
    expect(fileId).toBe('');
  });

  it('strips a folder path prefix before matching the filename', () => {
    const fileIdMap = { 'cover.jpg': 'file-5' };
    const fileId = app.findImageFileId_('some/nested/folder/Cover.jpg', 'Any Title', 'E0001', fileIdMap, {});
    expect(fileId).toBe('file-5');
  });
});
