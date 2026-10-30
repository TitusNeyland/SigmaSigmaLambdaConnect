import { collection, getCountFromServer, query, where } from 'firebase/firestore';

import { db } from './firebase';

/** What's waiting for officers: membership requests and open reports. */
export type WaitingCounts = { membershipRequests: number; openReports: number };

/** Officers only: the rules let only officers read reports. */
export async function fetchWaitingCounts(): Promise<WaitingCounts> {
  const [requests, reports] = await Promise.all([
    getCountFromServer(query(collection(db, 'members'), where('status', '==', 'pending'))),
    getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'open'))),
  ]);
  return {
    membershipRequests: requests.data().count,
    openReports: reports.data().count,
  };
}
