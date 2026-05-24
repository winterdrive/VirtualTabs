import { parseToken, isExpired } from '../src/utils/tokenHelper';

const FAKE_TOKEN = 'header.' + btoa(JSON.stringify({ sub: '1', email: 'dev@example.com', exp: 9999999999 })) + '.sig';

describe('Auth', () => {
  it('parseToken extracts email', () => {
    const payload = parseToken(FAKE_TOKEN);
    expect(payload.email).toBe('dev@example.com');
  });

  it('isExpired returns false for future token', () => {
    expect(isExpired(FAKE_TOKEN)).toBe(false);
  });
});
