/** App-wide settings that aren't secrets. */

export const CHAPTER_NAME = 'Sigma Sigma Lambda';

/**
 * Where members send questions and abuse reports. Shown in the app and on the public site.
 * Still a placeholder: the chapter needs to pick a real, monitored address before launch
 * (#54). The App Store requires a working contact.
 */
export const SUPPORT_EMAIL = 'support@example.com';

/**
 * The public site (#54): support, privacy policy, terms and guidelines, built from
 * tools/site and served by Firebase Hosting on the prod project. Change this if the chapter
 * moves it to its own domain.
 */
export const SITE_URL = 'https://sigmasigmalambdaproduction.web.app';
export const SUPPORT_URL = SITE_URL;
/** The in-app guidelines (src/features/guidelines) are the source for this page too. */
export const COMMUNITY_GUIDELINES_URL = `${SITE_URL}/guidelines`;
export const TERMS_URL = `${SITE_URL}/terms`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
