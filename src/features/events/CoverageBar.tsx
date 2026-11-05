import { StyleSheet, View } from 'react-native';

import { colors, palette, spacing } from '@/theme';
import { AppText, ProgressBar } from '@/ui';

import { coverageLine, type Coverage } from './eventsLogic';

/**
 * How many of the brothers an event needs have RSVPed Going: "6 of 10 brothers · 60%"
 * over a bar. The bar fills gold, then green once every slot is filled.
 */
export function CoverageBar({ coverage, testID }: { coverage: Coverage; testID?: string }) {
  const line = coverageLine(coverage);
  return (
    <View style={styles.wrap} testID={testID} accessible accessibilityLabel={`Coverage, ${line}`}>
      <AppText
        variant="footnote"
        weight="600"
        color={coverage.full ? colors.success : colors.text}
        testID={testID ? `${testID}-line` : undefined}
      >
        {line}
      </AppText>
      <ProgressBar
        percent={coverage.percent}
        color={coverage.full ? palette.healthGreen : undefined}
        testID={testID ? `${testID}-bar` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
});
