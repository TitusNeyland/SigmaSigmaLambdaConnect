// Checks the build and app config so a bad edit fails CI instead of a store build.
const eas = require('../../eas.json');
const app = require('../../app.json');

type Profile = {
  extends?: string;
  distribution?: string;
  developmentClient?: boolean;
  env?: Record<string, string>;
  ios?: { simulator?: boolean };
};

function resolveProfile(name: string): Profile {
  const profile: Profile = eas.build[name];
  if (!profile) throw new Error(`No profile ${name}`);
  if (!profile.extends) return profile;
  const parent = resolveProfile(profile.extends);
  return {
    ...parent,
    ...profile,
    env: { ...parent.env, ...profile.env },
    ios: { ...parent.ios, ...profile.ios },
  };
}

describe('EAS build profiles', () => {
  it.each(['development', 'development-device', 'preview', 'production'])(
    'has a %s profile',
    (name) => {
      expect(eas.build[name]).toBeDefined();
    },
  );

  it('only production talks to the production Firebase project', () => {
    expect(resolveProfile('production').env?.EXPO_PUBLIC_APP_ENV).toBe('production');
    for (const name of ['development', 'development-device', 'preview']) {
      expect(resolveProfile(name).env?.EXPO_PUBLIC_APP_ENV).toBe('development');
    }
  });

  it('development builds use the dev client; store builds do not', () => {
    expect(resolveProfile('development').developmentClient).toBe(true);
    expect(resolveProfile('development-device').developmentClient).toBe(true);
    expect(resolveProfile('preview').developmentClient).toBeFalsy();
    expect(resolveProfile('production').developmentClient).toBeFalsy();
  });

  it('the simulator build is the only simulator build', () => {
    expect(resolveProfile('development').ios?.simulator).toBe(true);
    expect(resolveProfile('development-device').ios?.simulator).toBe(false);
    expect(resolveProfile('preview').ios?.simulator).toBeFalsy();
  });

  it('preview and production are store builds so they can go to TestFlight and Play', () => {
    expect(resolveProfile('preview').distribution).toBe('store');
    expect(resolveProfile('production').distribution).toBe('store');
  });

  it('preview submits to Play internal testing, production to the production track', () => {
    expect(eas.submit.preview.android.track).toBe('internal');
    expect(eas.submit.production.android.track).toBe('production');
  });

  it('every profile pins a Node version through the base profile', () => {
    for (const name of Object.keys(eas.build)) {
      if (name === 'base') continue;
      expect(resolveProfile(name)).toEqual(expect.anything());
    }
    expect(eas.build.base.node).toMatch(/^22\./);
  });
});

describe('app config', () => {
  it('uses the same bundle ID on iOS and Android', () => {
    expect(app.expo.ios.bundleIdentifier).toBe('com.sigmasigmalambda.connect');
    expect(app.expo.android.package).toBe('com.sigmasigmalambda.connect');
  });

  it('declares no custom encryption, which skips the export question in TestFlight', () => {
    expect(app.expo.ios.config.usesNonExemptEncryption).toBe(false);
  });

  it('has the chapter name and a URL scheme', () => {
    expect(app.expo.name).toBe('Sigma Sigma Lambda Connect');
    expect(app.expo.scheme).toMatch(/^[a-z][a-z0-9+.-]*$/);
  });

  it('is phone-only and portrait for now', () => {
    expect(app.expo.ios.supportsTablet).toBe(false);
    expect(app.expo.orientation).toBe('portrait');
  });
});
