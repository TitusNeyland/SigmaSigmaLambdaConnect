import { getFirebaseConfig, parseAppEnv, shouldUseEmulators } from './env';

describe('parseAppEnv', () => {
  it('returns production only for the exact value "production"', () => {
    expect(parseAppEnv('production')).toBe('production');
  });

  it.each([undefined, '', 'development', 'prod', 'PRODUCTION', 'staging'])(
    'falls back to development for %p',
    (value) => {
      expect(parseAppEnv(value)).toBe('development');
    },
  );
});

describe('getFirebaseConfig', () => {
  it('uses the dev project for development', () => {
    expect(getFirebaseConfig('development').projectId).toBe('sigmasigmalambdadev');
  });

  it('uses the production project for production', () => {
    expect(getFirebaseConfig('production').projectId).toBe('sigmasigmalambdaproduction');
  });

  it.each(['development', 'production'] as const)('has every required field for %s', (env) => {
    const config = getFirebaseConfig(env);
    for (const key of [
      'apiKey',
      'authDomain',
      'projectId',
      'storageBucket',
      'messagingSenderId',
      'appId',
    ] as const) {
      expect(config[key]).toEqual(expect.any(String));
      expect(config[key]).not.toBe('');
    }
    expect(config.authDomain).toBe(`${config.projectId}.firebaseapp.com`);
    expect(config.appId).toContain(config.messagingSenderId);
  });
});

describe('shouldUseEmulators', () => {
  it('turns on in development when the flag is "true"', () => {
    expect(shouldUseEmulators('development', 'true')).toBe(true);
  });

  it.each([undefined, '', 'false', '1', 'TRUE'])('stays off in development for %p', (flag) => {
    expect(shouldUseEmulators('development', flag)).toBe(false);
  });

  it('never turns on in production', () => {
    expect(shouldUseEmulators('production', 'true')).toBe(false);
  });
});
