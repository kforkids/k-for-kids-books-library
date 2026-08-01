import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCodeGs } from '../support/loadGasSource.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'images');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const app = loadCodeGs();

describe('fixture cover images exist and are non-trivial files', () => {
  it.each([
    ['cover-normal.jpg', 'copy of a real book-images cover (E0089)'],
    ['cover-alt.jpg', 'copy of a real book-images cover (E0263)'],
    ['cover-busy-light.svg', 'synthetic busy/light cover reproducing the hover-legibility bug']
  ])('%s exists and is a real file (%s)', (filename) => {
    const filePath = path.join(FIXTURES_DIR, filename);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(200);
  });
});

describe('findImageFileId_ against REAL book-images filenames (Drive-scan simulation)', () => {
  // Mirrors what recordImageFile_ would populate from a real Drive folder
  // listing: lowercase filename -> fake file id, plus the normalized-name map.
  function buildMapsFromRealFilenames(filenames) {
    const fileIdMap = {};
    const normalizedFileIdMap = {};
    filenames.forEach((name, i) => {
      fileIdMap[name.toLowerCase()] = `file-${i}`;
      normalizedFileIdMap[app.normalizeImageFileName_(name)] = `file-${i}`;
    });
    return { fileIdMap, normalizedFileIdMap };
  }

  it('resolves a real cover by its exact filename as stored in the Image Name column', () => {
    const realFilenames = fs.readdirSync(path.join(REPO_ROOT, 'book-images')).filter(f => f.endsWith('.jpg'));
    const sample = 'E0089 - 365 things to make and do.jpg';
    expect(realFilenames).toContain(sample);

    const { fileIdMap, normalizedFileIdMap } = buildMapsFromRealFilenames(realFilenames);
    const fileId = app.findImageFileId_(sample, '365 things to make and do', 'E0089', fileIdMap, normalizedFileIdMap);
    expect(fileId).toBe(fileIdMap[sample.toLowerCase()]);
  });

  it('resolves by normalized book number when the Image Name column is blank (fallback tier 4)', () => {
    const realFilenames = fs.readdirSync(path.join(REPO_ROOT, 'book-images')).filter(f => f.endsWith('.jpg'));
    const { fileIdMap, normalizedFileIdMap } = buildMapsFromRealFilenames(realFilenames);
    // Seed a normalized-bookNo entry the way a legacy IMAGE_MAP fallback might.
    normalizedFileIdMap['e0263'] = 'legacy-file-e0263';
    const fileId = app.findImageFileId_('', 'Some Renamed Title', 'E0263', {}, { e0263: 'legacy-file-e0263' });
    expect(fileId).toBe('legacy-file-e0263');
  });

  it('produces a working thumbnail URL end-to-end for a real filename match', () => {
    const realFilenames = fs.readdirSync(path.join(REPO_ROOT, 'book-images')).filter(f => f.endsWith('.jpg'));
    const sample = 'E0263 - Harry and the Robots.jpg';
    const { fileIdMap, normalizedFileIdMap } = buildMapsFromRealFilenames(realFilenames);
    const fileId = app.findImageFileId_(sample, 'Harry and the Robots', 'E0263', fileIdMap, normalizedFileIdMap);
    const url = app.buildDriveThumbnailUrl_(fileId);
    expect(url).toMatch(/^https:\/\/drive\.google\.com\/thumbnail\?id=file-\d+&sz=w400$/);
  });
});
