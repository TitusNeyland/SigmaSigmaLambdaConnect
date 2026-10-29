import { Text, type TextProps } from 'react-native';

import { colors, type, type TypeName } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypeName;
  color?: string;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
};

/** All text in the app goes through this so it uses the type scale. */
export function AppText({
  variant = 'body',
  color = colors.text,
  weight,
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
