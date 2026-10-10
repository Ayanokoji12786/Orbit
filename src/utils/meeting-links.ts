const ROOM_CODE = /^[a-z0-9]{6}$/i;

/** Resolve a room code from the code itself or one of Orbit's share links. */
export function parseRoomCode(input: string): string | null {
  const value = input.trim();
  if (ROOM_CODE.test(value)) return value.toLowerCase();

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(candidate);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.protocol === 'https:' && ['orbit.app', 'www.orbit.app'].includes(url.hostname.toLowerCase())) {
      if (parts.length === 2 && ['j', 'meeting'].includes(parts[0]) && ROOM_CODE.test(parts[1])) {
        return parts[1].toLowerCase();
      }
    }

    if (url.protocol === 'orbit:' && url.hostname === 'meeting' && parts.length === 1 && ROOM_CODE.test(parts[0])) {
      return parts[0].toLowerCase();
    }
  } catch {
    // Plain text that is neither a code nor a URL is invalid.
  }

  return null;
}
