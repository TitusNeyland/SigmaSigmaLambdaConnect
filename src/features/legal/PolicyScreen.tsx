import { router } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { colors } from '@/theme';
import { NavHeader } from '@/ui';

import { fillPolicy, IN_APP_LINK, POLICIES, policyDocument, type PolicyKind } from './policies';

/** Where a link inside a policy goes in the app. */
const IN_APP: Record<string, '/guidelines' | '/profile/privacy' | '/profile/terms'> = {
  guidelines: '/guidelines',
  privacy: '/profile/privacy',
  terms: '/profile/terms',
};

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile/settings');
}

/**
 * Opens a link tapped inside the page: other policies and the guidelines in the app, email in
 * the mail app, anything else in the browser. The page itself never navigates away.
 */
export function openPolicyLink(url: string): boolean {
  if (url === 'about:blank') return true;
  if (url.startsWith(IN_APP_LINK)) {
    const target = IN_APP[url.slice(IN_APP_LINK.length)];
    if (target) router.push(target);
    return false;
  }
  Linking.openURL(url).catch(() => {});
  return false;
}

/** The privacy policy or terms, shown in the app as static HTML (#54). */
export function PolicyScreen({ kind }: { kind: PolicyKind }) {
  const policy = POLICIES[kind];
  const html = useMemo(
    () => policyDocument(policy.title, fillPolicy(policy.body), 'app'),
    [policy],
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <NavHeader title={policy.title} onBack={goBack} backTestID="policy-back" />
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(req: WebViewNavigation) => openPolicyLink(req.url)}
        style={styles.page}
        accessibilityLabel={policy.title}
        testID={`policy-${kind}`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, backgroundColor: colors.background },
});
