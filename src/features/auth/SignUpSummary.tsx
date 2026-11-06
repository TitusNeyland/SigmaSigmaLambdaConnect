import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';
import { AppText, Avatar, ListRow, ListSection } from '@/ui';

/** Everything a new brother entered, as it'll go to the chapter. */
export type SignUpSummaryInfo = {
  displayName: string;
  initiationTerm: string;
  headline: string;
  industry: string;
  businesses: string[];
  interests: string[];
  photoUri: string | null;
  email: string;
};

export type SummarySection =
  'name' | 'initiated' | 'work' | 'business' | 'interests' | 'photo' | 'email';

const NOT_ADDED = 'Not added';

/**
 * A review of a new brother's answers: his photo and name on top, then each answer in a
 * grouped list. With onEdit, each row opens that question again.
 */
export function SignUpSummary({
  info,
  onEdit,
  lockEmail = false,
}: {
  info: SignUpSummaryInfo;
  onEdit?: (section: SummarySection) => void;
  /** The account's email, which can't change here. */
  lockEmail?: boolean;
}) {
  const edit = (section: SummarySection) => (onEdit ? () => onEdit(section) : undefined);
  const work = [info.headline.trim(), info.industry.trim()].filter(Boolean).join(' · ');

  return (
    <View style={styles.wrap} testID="sign-up-summary">
      <Pressable
        onPress={edit('photo')}
        disabled={!onEdit}
        accessibilityRole={onEdit ? 'button' : undefined}
        accessibilityLabel={onEdit ? (info.photoUri ? 'Change photo' : 'Add a photo') : undefined}
        style={styles.who}
        testID="summary-photo"
      >
        <Avatar name={info.displayName || 'New brother'} uri={info.photoUri} size={88} ring />
        <View style={styles.whoText}>
          <AppText variant="title3" weight="700" align="center">
            {info.displayName}
          </AppText>
          <AppText variant="subhead" color={colors.textSecondary} align="center">
            {`Initiated ${info.initiationTerm}`}
          </AppText>
          {onEdit ? (
            <AppText variant="footnote" weight="600" color={colors.link} align="center">
              {info.photoUri ? 'Change photo' : 'Add a photo'}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      <ListSection header="Your information">
        <ListRow
          title="Name"
          subtitle={info.displayName}
          onPress={edit('name')}
          testID="summary-name"
        />
        <ListRow
          title="Initiated"
          subtitle={info.initiationTerm}
          onPress={edit('initiated')}
          testID="summary-initiated"
        />
        <ListRow
          title="Work"
          subtitle={work || NOT_ADDED}
          onPress={edit('work')}
          testID="summary-work"
        />
        <ListRow
          title="Businesses"
          subtitle={info.businesses.length ? info.businesses.join(', ') : NOT_ADDED}
          onPress={edit('business')}
          testID="summary-business"
        />
        <ListRow
          title="Interests"
          subtitle={info.interests.length ? info.interests.join(', ') : NOT_ADDED}
          onPress={edit('interests')}
          testID="summary-interests"
        />
        <ListRow
          title="Email"
          subtitle={info.email}
          onPress={lockEmail ? undefined : edit('email')}
          testID="summary-email"
        />
      </ListSection>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl },
  who: { alignItems: 'center', gap: spacing.md },
  whoText: { gap: spacing.xxs, alignItems: 'center' },
});
