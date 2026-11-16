import { afterEach } from 'vitest';

// Deterministic env for every test; individual tests override per case.
process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234';
delete process.env.FAST2SMS_API_KEY;
delete process.env.AERODATABOX_API_KEY;

// Component tests (jsdom): unmount between tests.
if (typeof document !== 'undefined') {
  afterEach(async () => {
    (await import('@testing-library/react')).cleanup();
    localStorage.clear();
  });
}
