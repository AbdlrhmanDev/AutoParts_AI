import { describe, expect, it } from 'vitest';
import { verifyVin } from './authorizedCatalog.js';

describe('authorized catalog', () => {
  it('rejects malformed VINs locally and never claims verification', async () => {
    await expect(verifyVin('123')).resolves.toMatchObject({ verified: false, reason: 'invalid_format' });
  });
});
