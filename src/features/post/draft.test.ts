import { addPhotos, makeCover, MAX_PHOTOS, removePhoto, type DraftPhoto } from './draft';

const photo = (n: number): DraftPhoto => ({ uri: `file:///${n}.jpg`, width: 100, height: 100 });
const uris = (photos: DraftPhoto[]) => photos.map((p) => p.uri.replace(/\D/g, ''));

it('allows up to 10 photos per post', () => {
  expect(MAX_PHOTOS).toBe(10);
});

it('adds picks in order after what’s there, skipping repeats', () => {
  expect(uris(addPhotos([photo(1), photo(2)], [photo(2), photo(3)]))).toEqual(['1', '2', '3']);
});

it('stops at 10', () => {
  const nine = Array.from({ length: 9 }, (_, i) => photo(i));
  expect(addPhotos(nine, [photo(20), photo(21)])).toHaveLength(10);
});

it('removes a photo and renumbers the rest', () => {
  expect(uris(removePhoto([photo(1), photo(2), photo(3)], 'file:///2.jpg'))).toEqual(['1', '3']);
});

it('moves a photo to the front as the cover', () => {
  expect(uris(makeCover([photo(1), photo(2), photo(3)], 'file:///3.jpg'))).toEqual(['3', '1', '2']);
  expect(uris(makeCover([photo(1)], 'file:///9.jpg'))).toEqual(['1']);
});
