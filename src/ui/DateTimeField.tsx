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
  /** 'date' picks a day only, like a birthday. Defaults to a day and time. */
  mode?: 'datetime' | 'date';
  /** Latest day it allows, like today for something that already happened. */
  maximumDate?: Date;
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

/** "Nov 7, 2021" for a day-only field. */
export function formatDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * A labeled date and time, or just a date. iOS shows the system's compact picker inline;
 * Android opens the date dialog, then (for a date and time) the time dialog.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  maximumDate,
  error,
  testID,
}: DateTimeFieldProps) {
  const shown = mode === 'date' ? formatDate(value) : formatDateTime(value);
  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      maximumDate,
      onChange: (event: DateTimePickerEvent, day?: Date) => {
        if (event.type !== 'set' || !day) return;
        if (mode === 'date') {
          onChange(day);
          return;
        }
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
            mode={mode}
            display="compact"
            maximumDate={maximumDate}
            accentColor={palette.ink}
            onChange={(event, date) => {
              if (event.type === 'set' && date) onChange(date);
            }}
            accessibilityLabel={`${label}, ${shown}`}
            testID={testID}
          />
        ) : (
          <Pressable
            onPress={openAndroid}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${shown}`}
            accessibilityHint={
              mode === 'date' ? 'Opens a date picker' : 'Opens a date and time picker'
            }
            style={styles.button}
            testID={testID}
          >
            <AppText>{shown}</AppText>
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
