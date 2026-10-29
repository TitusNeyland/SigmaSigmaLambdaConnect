import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type ListSectionProps = {
  header?: string;
  footer?: string;
  children: ReactNode;
  testID?: string;
};

/** An iOS-style grouped list: white rounded card on the grouped gray background. */
export function ListSection({ header, footer, children, testID }: ListSectionProps) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.section} testID={testID}>
      {header ? (
        <AppText
          variant="sectionHeader"
          color={colors.textSecondary}
          style={styles.header}
          accessibilityRole="header"
        >
          {header.toUpperCase()}
        </AppText>
      ) : null}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {row}
            {i < rows.length - 1 ? <View style={styles.separator} /> : null}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="footnote" color={colors.textSecondary} style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md + 2,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
});
