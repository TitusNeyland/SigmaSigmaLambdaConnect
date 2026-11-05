/* global jest */
// Global test setup for app unit tests.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The system "new event" sheet is native. Tests set what the person did with it.
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(async () => ({ action: 'saved', id: 'device-event' })),
}));

// Push is native. Tests that care set what the device says; app tests never save tokens.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: 'ExponentPushToken[test]' })),
  AndroidImportance: { DEFAULT: 3 },
}));
// The camera roll is native. By default access is granted and the roll is empty; tests set
// photos (with optional favorite and albumId), albums and permission through the mock's
// helpers (__setPhotos, __setAlbums, __setPermission).
jest.mock('expo-media-library', () => {
  const state = {
    photos: [],
    albums: [],
    permission: { granted: true, canAskAgain: true, accessPrivileges: 'all', status: 'granted' },
  };
  class Query {
    constructor() {
      this.from = 0;
      this.count = Infinity;
      this.favorites = false;
      this.albumId = null;
    }
    eq(field, value) {
      if (field === 'isFavorite') this.favorites = value;
      return this;
    }
    album(album) {
      this.albumId = album.id;
      return this;
    }
    orderBy() {
      return this;
    }
    offset(n) {
      this.from = n;
      return this;
    }
    limit(n) {
      this.count = n;
      return this;
    }
    async exeForMetadata() {
      return state.photos
        .filter(
          (p) => (!this.favorites || p.favorite) && (!this.albumId || p.albumId === this.albumId),
        )
        .slice(this.from, this.from + this.count);
    }
  }
  class Asset {
    constructor(id) {
      this.id = id;
    }
    async getUri() {
      return `file:///${this.id}.jpg`;
    }
  }
  class Album {
    constructor(id) {
      this.id = id;
    }
    static async getAlbumsMetadata() {
      return state.albums;
    }
  }
  const getPermission = jest.fn(async () => state.permission);
  return {
    Query,
    Asset,
    Album,
    AlbumType: { ALBUM: 'album', SMART_ALBUM: 'smartAlbum' },
    AssetField: {
      MEDIA_TYPE: 'mediaType',
      CREATION_TIME: 'creationTime',
      IS_FAVORITE: 'isFavorite',
    },
    MediaType: { IMAGE: 'image' },
    usePermissions: () => {
      const React = jest.requireActual('react');
      const [value, setValue] = React.useState(state.permission);
      const refresh = React.useCallback(async () => {
        const next = await getPermission();
        setValue({ ...next });
        return next;
      }, []);
      return [value, refresh, refresh];
    },
    presentPermissionsPicker: jest.fn(async () => {}),
    __setPhotos: (photos) => {
      state.photos = photos;
    },
    __setAlbums: (albums) => {
      state.albums = albums;
    },
    __setPermission: (permission) => {
      state.permission = permission;
    },
  };
});
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('@/data/push');

// The date picker is native. The mock renders a plain view; tests call its onChange prop.
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  const React = jest.requireActual('react');
  const Picker = (props) =>
    React.createElement(View, { ...props, value: undefined, date: props.value });
  return {
    __esModule: true,
    default: Picker,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  };
});
