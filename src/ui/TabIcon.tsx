import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme';

export type TabName = 'home' | 'events' | 'post' | 'chapter' | 'profile';

export type TabIconProps = {
  name: TabName;
  focused: boolean;
  size?: number;
};

/** Tab bar icons. Active tabs are filled ink; inactive ones are outlined gray. */
export function TabIcon({ name, focused, size = 25 }: TabIconProps) {
  const color = focused ? palette.ink : palette.secondary;
  const stroke = focused ? 1.9 : 1.6;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    testID: `tab-icon-${name}${focused ? '-active' : ''}`,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...common} fill={focused ? color : 'none'}>
          <Path
            d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'events':
      return (
        <Svg {...common} fill="none">
          <Rect
            x={3}
            y={4}
            width={18}
            height={17}
            rx={3}
            fill={focused ? color : 'none'}
            stroke={color}
            strokeWidth={stroke}
          />
          <Path d="M16 2v4M8 2v4" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Path d="M3 10h18" stroke={focused ? palette.bg : color} strokeWidth={stroke} />
        </Svg>
      );
    case 'post':
      return (
        <Svg {...common} fill="none">
          <Rect x={3} y={3} width={18} height={18} rx={5} stroke={color} strokeWidth={stroke} />
          <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        </Svg>
      );
    case 'chapter':
      return (
        <Svg {...common} fill="none">
          <Circle
            cx={9}
            cy={8}
            r={3.5}
            fill={focused ? color : 'none'}
            stroke={color}
            strokeWidth={stroke}
          />
          <Path
            d="M2.5 20a6.5 6.5 0 0 1 13 0z"
            fill={focused ? color : 'none'}
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
          <Path
            d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg {...common} fill="none">
          <Circle
            cx={12}
            cy={8}
            r={4}
            fill={focused ? color : 'none'}
            stroke={color}
            strokeWidth={stroke}
          />
          <Path
            d="M4 21a8 8 0 0 1 16 0z"
            fill={focused ? color : 'none'}
            stroke={color}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
        </Svg>
      );
  }
}
