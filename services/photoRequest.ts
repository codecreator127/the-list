type PhotoUser = { uid: string; getIdToken: (forceRefresh?: boolean) => Promise<string> };

/** Retry authentication once, before a rejected request can create an image. */
export async function requestPhoto(
  url: string, method: 'POST' | 'DELETE', body: Blob | string, contentType: string,
  user: PhotoUser, currentUser: () => PhotoUser | null | undefined, fetcher: typeof fetch = fetch,
) {
  for (const forceRefresh of [false, true]) {
    if (currentUser()?.uid !== user.uid) throw new Error('Your account changed. Please try again.');
    const token = await user.getIdToken(forceRefresh);
    if (currentUser()?.uid !== user.uid) throw new Error('Your account changed. Please try again.');
    const response = await fetcher(url, { method, body, headers: { Authorization: 'Bearer ' + token, 'Content-Type': contentType } });
    if (response.status === 401 && !forceRefresh) continue;
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Photo uploads are unavailable. Check that the upload server is deployed.'); }
    if (!response.ok) throw new Error(result.error ?? 'Could not upload your photo.');
    return result;
  }
}
