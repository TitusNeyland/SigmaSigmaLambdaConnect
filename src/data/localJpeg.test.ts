import { localJpeg } from './localJpeg';

it('retags the fetched blob as image/jpeg', async () => {
  const raw = new Blob(['pic'], { type: 'application/octet-stream' });
  global.fetch = jest.fn(async () => ({ blob: async () => raw })) as never;
  const jpeg = await localJpeg('file:///pic.jpg');
  expect(global.fetch).toHaveBeenCalledWith('file:///pic.jpg');
  expect(jpeg.type).toBe('image/jpeg');
  expect(await jpeg.text()).toBe('pic');
});
