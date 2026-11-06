import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchDirectory } from '@/data/directory';
import { formatDay } from '@/features/events/eventsLogic';
import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';
import { AppText, Avatar } from '@/ui';

import { anniversariesThisWeek, yearsLabel, type Anniversary } from './anniversaryLogic';

const AVATAR = 36;
// Text on the soft gold card uses the dark gold made for it; gray falls short of contrast.
/** Rows shown before "and N more". */
const SHOWN = 3;

function Row({ a, me, now }: { a: Anniversary; me: string; now: Date }) {
  const when = formatDay(a.date, now);
  return (
    <Pressable
      onPress={() =>
        a.uid === me
          ? router.push('/profile')
          : router.push({ pathname: '/chapter/member/[uid]', params: { uid: a.uid } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${a.displayName}, ${yearsLabel(a.years)}, ${when}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`anniversary-${a.uid}`}
    >
      <Avatar name={a.displayName} uri={a.photoURL} size={AVATAR} />
      <View style={styles.flex}>
        <AppText variant="subhead" weight="600" numberOfLines={1}>
          {a.displayName}
        </AppText>
        <AppText variant="footnote" color={palette.goldSoftText}>
          {yearsLabel(a.years)}
        </AppText>
      </View>
      <AppText variant="footnote" weight="600" color={palette.goldSoftText}>
        {when}
      </AppText>
    </Pressable>
  );
}

/**
 * Line anniversaries this week, at the top of Home. Shows nothing when there are none, so
 * it only appears when there's something to celebrate.
 */
export function LineAnniversaries({ me }: { me: string }) {
  const [list, setList] = useState<Anniversary[]>([]);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    fetchDirectory().then(
      (members) => live && setList(anniversariesThisWeek(members, now)),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [now]);

  if (list.length === 0) return null;
  const more = list.length - SHOWN;
  return (
    <View style={styles.card} testID="anniversaries">
      <AppText variant="headline" accessibilityRole="header">
        Line anniversaries this week
      </AppText>
      {list.slice(0, SHOWN).map((a) => (
        <Row key={a.uid} a={a} me={me} now={now} />
      ))}
      {more > 0 ? (
        <AppText variant="footnote" color={palette.goldSoftText} testID="anniversaries-more">
          and {more} more
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.accentSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
});
