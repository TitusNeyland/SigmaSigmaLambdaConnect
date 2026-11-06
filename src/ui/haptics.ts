import * as Haptics from 'expo-haptics';

/**
 * Small taps you feel, so the app answers your finger like a native one. Best effort: on a
 * device or simulator without haptics these do nothing, and they never throw.
 */
export const haptics = {
  /** A light tap: liking, pulling to refresh. */
  tap() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** A tick for picking an option: RSVP, checking someone in. */
  select() {
    Haptics.selectionAsync().catch(() => {});
  },
  /** Something worked: a scanned check-in, saved attendance. */
  success() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
