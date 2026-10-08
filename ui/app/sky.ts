const RAD = Math.PI / 180;

export type Location = { latitude: number; longitude: number };

// Without a browser location: the time zone's standard-time meridian (no daylight saving shift),
// at the latitude of central Germany.
export function fallbackLocation(): Location {
  const year = new Date().getFullYear();
  const standardOffset = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
  return { latitude: 51, longitude: -standardOffset / 4 };
}

// Sun position from the usual low-precision ephemeris (about 0.01° here, plenty for a sky):
// altitude above the horizon and azimuth measured from south toward west, both in radians.
export function sunPosition(date: Date, { latitude, longitude }: Location) {
  const d = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const l = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  const h = (280.46061837 + 360.98564736629 * d + longitude) * RAD - ra;
  const phi = latitude * RAD;
  return {
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)),
    azimuth: Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)),
  };
}

// Unit vector toward the sun in scene coordinates; `south` is the scene heading (angle in the
// x/z plane) that counts as south, so west lies to its right.
// ponytail: south is fixed, so on the southern hemisphere the sun crosses behind that heading.
export function sunDirection(altitude: number, azimuth: number, south: number): [number, number, number] {
  const heading = south + azimuth;
  return [Math.cos(altitude) * Math.cos(heading), Math.sin(altitude), Math.cos(altitude) * Math.sin(heading)];
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// 0 at night, 1 by day, with civil twilight (sun 6° below to 6° above the horizon) in between.
export const daylight = (altitude: number) => smoothstep(-6 * RAD, 6 * RAD, altitude);
// Share of the stars shown: they come out one by one as the sun sinks to 14° below the horizon.
export const starlight = (altitude: number) => 1 - smoothstep(-14 * RAD, 0, altitude);
// 0 at the horizon, 1 once the sun stands 30° high: from warm low light to plain daylight.
export const highSun = (altitude: number) => smoothstep(0, 30 * RAD, altitude);
