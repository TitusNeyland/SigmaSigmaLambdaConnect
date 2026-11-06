import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fetchEventPhotos, type EventPhoto } from '@/data/events';
import { useStorageUrl } from '@/features/feed/useStorageUrl';
import { colors, motion, spacing } from '@/theme';
import { ListSection } from '@/ui';

const COLUMNS = 3;
const GAP = spacing.xxs;

function Photo({ photo, size }: { photo: EventPhoto; size: number }) {
  const uri = useStorageUrl(photo.path);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/events/post/[id]', params: { id: photo.postId } })}
      accessibilityRole="button"
      accessibilityLabel="Photo from this event"
      accessibilityHint="Opens the post"
      style={({ pressed }) => [
        styles.photo,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
      testID={`event-photo-${photo.path}`}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={motion.photoFade}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The event's album: photos brothers posted from it, three to a row. Tapping one opens its
 * post. Shows nothing until someone has posted a photo from the event.
 */
export function EventPhotos({ eventId }: { eventId: string }) {
  const [loaded, setLoaded] = useState<{ eventId: string; photos: EventPhoto[] } | null>(null);
  const [width, setWidth] = useState(0);

  // Reload on focus, so a photo just posted from the event shows when you come back.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchEventPhotos(eventId).then(
        (photos) => live && setLoaded({ eventId, photos }),
        () => {},
      );
      return () => {
        live = false;
      };
    }, [eventId]),
  );

  const photos = loaded?.eventId === eventId ? loaded.photos : [];
  if (photos.length === 0) return null;
  const size = width ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  return (
    <ListSection header={`Photos · ${photos.length}`} testID="event-photos">
      <View
        style={styles.grid}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        testID="event-photos-grid"
      >
        {size > 0 ? photos.map((p) => <Photo key={p.path} photo={p} size={size} />) : null}
      </View>
    </ListSection>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  photo: { backgroundColor: colors.fill, overflow: 'hidden' },
  pressed: { opacity: 0.7 },
});
