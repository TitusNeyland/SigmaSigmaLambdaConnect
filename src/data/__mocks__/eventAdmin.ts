/** Test double for src/data/eventAdmin.ts. Use with `jest.mock('@/data/eventAdmin')`. */
import type { EventInput } from '../eventAdmin';

export const newEventId = jest.fn(() => 'new-event');
export const createEvent = jest.fn(async (_id: string, _uid: string, _input: EventInput) => {});
export const updateEvent = jest.fn(async (_id: string, _input: EventInput) => {});
export const cancelEvent = jest.fn(async (_id: string) => {});
export const uploadEventPhoto = jest.fn(
  async (id: string, _uri: string) => `https://example.test/events/${id}.jpg`,
);

export function resetEventAdminMock() {
  newEventId.mockClear();
  for (const fn of [createEvent, updateEvent, cancelEvent])
    fn.mockReset().mockResolvedValue(undefined);
  uploadEventPhoto
    .mockReset()
    .mockImplementation(async (id: string) => `https://example.test/events/${id}.jpg`);
}
