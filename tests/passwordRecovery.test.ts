import { expect, it } from 'vitest';
import { recoveryToken } from '../src/passwordRecovery.js';

it('extracts a recovery token without navigating to a pasted host', () => {
  const token = 'a'.repeat(43);
  expect(recoveryToken(` ${token} `)).toBe(token);
  expect(recoveryToken(`http://127.0.0.1:8787/#admin-setup/${token}`)).toBe(token);
  expect(recoveryToken(`https://untrusted.example/#admin-setup/${token}`)).toBe(token);
  expect(recoveryToken(`javascript:alert(1)#admin-setup/${token}`)).toBeNull();
  expect(recoveryToken('not a reset link')).toBeNull();
  expect(recoveryToken(`#admin-setup/${token}/extra`)).toBeNull();
});
