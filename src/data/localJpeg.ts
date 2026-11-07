/**
 * A local photo as a JPEG Blob for Storage. React Native cannot build a Blob from an
 * ArrayBuffer — Firebase Storage tries that and throws. fetch().blob() works, but its type
 * is often application/octet-stream, which the storage rules reject as unauthorized.
 */
export async function localJpeg(uri: string): Promise<Blob> {
  const blob = await (await fetch(uri)).blob();
  // slice() retags without copying through an ArrayBuffer, which RN's Blob cannot wrap.
  return blob.slice(0, blob.size, 'image/jpeg');
}
