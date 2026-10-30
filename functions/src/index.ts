import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';

/**
 * Cloud Functions for Sigma Sigma Lambda Connect.
 *
 * Feature functions land here as their issues are built, for example event reminders
 * (#26) and KPI calculations (#47). Keep each area in its own file and re-export it here.
 */

initializeApp();

// Small chapter app: cap instances to keep costs predictable.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

export { deleteAccount } from './account.js';
export { notifyAnnouncement } from './announcements.js';
export { eventNotifications, notifyEventCancelled, notifyNewEvent } from './events.js';
export { kpisHourly, kpisOnGoalChange } from './kpis.js';
export { cleanUpDeletedPost, countCommentLikes, countComments, countLikes } from './posts.js';
export { notifyProgramHelp } from './programs.js';
export { notifyApproval } from './push.js';
export {
  likeDigests,
  notifyNewComment,
  queueLikeNotification,
  unqueueLikeNotification,
} from './social.js';

/** Confirms deploys work. Returns the project the function is running in. */
export const health = onRequest((_req, res) => {
  res.json({ ok: true, project: process.env.GCLOUD_PROJECT ?? 'unknown' });
});
