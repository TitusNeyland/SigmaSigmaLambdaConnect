import { router } from 'expo-router';

import { PlaceholderScreen } from '@/features/navigation/PlaceholderScreen';
import { RequireCapability, useRole } from '@/features/roles/RoleProvider';
import { ListRow, ListSection } from '@/ui';

export default function ChapterScreen() {
  const { label } = useRole();
  return (
    <PlaceholderScreen
      title="Chapter"
      note="Chapter progress, announcements, the directory and leadership tools go here (#42)."
    >
      <ListSection>
        <ListRow
          title="Directory"
          subtitle="Find brothers by name, job or interest"
          onPress={() => router.push('/chapter/directory')}
          testID="directory-entry"
        />
      </ListSection>
      {/* Officers only. Members never see leadership tools, and the rules block them anyway. */}
      <RequireCapability capability="leadership.view">
        <ListSection header="Leadership">
          <ListRow
            title="Leadership tools"
            subtitle={`Signed in as ${label}. Built in #46.`}
            testID="leadership-entry"
          />
        </ListSection>
      </RequireCapability>
    </PlaceholderScreen>
  );
}
