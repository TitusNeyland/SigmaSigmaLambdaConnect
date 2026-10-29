import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, MIN_TOUCH, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type DateTimeFieldProps = {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  error?: string;
  testID?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Sat, Nov 7, 7:00 PM" for the Android button and screen readers. */
export function formatDateTime(d: Date): string {
  const h = d.getHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${
    h < 12 ? 'AM' : 'PM'
  }`;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${time}`;
}

/**
 * A labeled date and time. iOS shows the system's compact picker inline; Android opens the
 * date dialog, then the time dialog.
 */
export function DateTimeField({ label, value, onChange, error, testID }: DateTimeFieldProps) {
  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (event: DateTimePickerEvent, day?: Date) => {
        if (event.type !== 'set' || !day) return;
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          onChange: (timeEvent: DateTimePickerEvent, time?: Date) => {
            if (timeEvent.type === 'set' && time) onChange(time);
          },
        });
      },
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <AppText style={styles.label}>{label}</AppText>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            accentColor={palette.ink}
            onChange={(event, date) => {
              if (event.type === 'set' && date) onChange(date);
            }}
            accessibilityLabel={`${label}, ${formatDateTime(value)}`}
            testID={testID}
          />
        ) : (
          <Pressable
            onPress={openAndroid}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${formatDateTime(value)}`}
            accessibilityHint="Opens a date and time picker"
            style={styles.button}
            testID={testID}
          >
            <AppText>{formatDateTime(value)}</AppText>
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="footnote" color={colors.destructive} testID={testID && `${testID}-error`}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH,
    gap: spacing.md,
  },
  label: { flexShrink: 1 },
  button: {
    minHeight: MIN_TOUCH - spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.fill,
  },
});
