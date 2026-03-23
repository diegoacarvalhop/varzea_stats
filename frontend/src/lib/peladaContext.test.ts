import { afterEach, describe, expect, it } from 'vitest';
import {
  clearPeladaContext,
  getPeladaHasLogo,
  getPeladaId,
  getPeladaName,
  setPeladaContext,
} from '@/lib/peladaContext';

describe('peladaContext', () => {
  afterEach(() => {
    clearPeladaContext();
  });

  it('setPeladaContext persiste id, nome e logo', () => {
    setPeladaContext(42, 'Grupo X', true);
    expect(getPeladaId()).toBe('42');
    expect(getPeladaName()).toBe('Grupo X');
    expect(getPeladaHasLogo()).toBe(true);
  });

  it('clearPeladaContext remove chaves', () => {
    setPeladaContext(1, 'A', false);
    clearPeladaContext();
    expect(getPeladaId()).toBeNull();
    expect(getPeladaName()).toBeNull();
    expect(getPeladaHasLogo()).toBe(false);
  });
});
