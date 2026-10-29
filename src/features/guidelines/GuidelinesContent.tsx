import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText } from '@/ui';

import { GUIDELINES, GUIDELINES_INTRO } from './guidelines';

/** The guidelines as a numbered list, used by the read-only screen and the accept step. */
export function GuidelinesContent() {
  return (
    <View style={styles.wrap} testID="guidelines">
      <AppText variant="callout" color={colors.textSecondary}>
        {GUIDELINES_INTRO}
      </AppText>
      {GUIDELINES.map((rule, i) => (
        <View key={rule.title} style={styles.rule}>
          <AppText variant="headline">
            {i + 1}. {rule.title}
          </AppText>
          <AppText variant="callout">{rule.body}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  rule: { gap: spacing.xs },
});
