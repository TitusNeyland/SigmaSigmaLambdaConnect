import { router } from 'expo-router';

/**
 * Opens a brother's profile from anywhere. Your own name opens your Profile tab, never a
 * member page about you: that page would only bounce to the Profile tab, and left behind in
 * another tab's stack it would keep bouncing you there every time that tab opened.
 */
export function openMember(uid: string, me: string) {
  if (uid === me) router.navigate('/profile');
  else router.push({ pathname: '/chapter/member/[uid]', params: { uid } }, { withAnchor: true });
}
