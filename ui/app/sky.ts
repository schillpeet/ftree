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
// altitude above the horizon and azimuth measured from south toward west, and the sun's declination, all in radians.
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
    declination: dec,
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
// 0 by day, 1 once the sun sinks to the end of civil twilight: the evening fades in as the light
// drops, when the little glow orbs above the cards light up.
export const evening = (altitude: number) => 1 - smoothstep(-6 * RAD, 12 * RAD, altitude);
// The night watch over the tiered tree (docs/superpowers/specs/2026-11-17-night-watch-design.md).
// 0 while the sun is up, 1 from 6° below the horizon: how strongly the night's own lights show.
export const nightGlow = (altitude: number) => smoothstep(0, -6 * RAD, altitude);
// The gold's glow (chosen 2026-11-17): by day as faint as before part 4, so the gold still shows against the light; at
// night 4, breathing ±60 % once every 7 s (less is lost in the tone mapping's shoulder and cannot be seen), as a wave
// that climbs the trunk `climb` metres per breath.
export const GOLD_GLOW = { day: 0.3, night: 4, breath: 0.6, period: 7, climb: 20 };
// The gold's warm light around the trunk's foot (chosen 2026-11-17, "weit und schwach"): a faint warmth over the whole
// hilltop, reaching 25 m; strength in candela.
export const TRUNK_LIGHT = { color: '#ffa850', range: 25, strength: 1200 };
// The moon over the clearing (chosen 2026-11-17, "links neben der Krone"): its path centred 15° left of the start view's
// line and swinging 20° to each side, up to 14° high, so all night it stands beside the crown as in image D; its light
// keeps today's strength, and the bark's edges toward it light up a little (`edge`).
export const MOON = { span: 0.2, highest: 14 * RAD, centre: -15 * RAD, light: 1.5, edge: 0.4 };
// The night sky over the clearing (chosen 2026-11-17, "Zielbild", from image D): zenith and horizon as the screen shows
// them, and the sun's altitudes between which the night dome fades in, after the afterglow of civil twilight.
export const NIGHT_SKY = { zenith: '#162238', horizon: '#1d2c43', from: -3 * RAD, to: -12 * RAD };
// How much of the night dome shows: none during the afterglow (above `from`), all of it at night (below `to`).
export const nightSky = (altitude: number, from = NIGHT_SKY.from, to = NIGHT_SKY.to) => smoothstep(from, to, altitude);
// The moon over the clearing (night watch): today's moon, opposite the sun, pulled into the sky behind the tree, since
// the start view looks south: its azimuth (from south toward west) scaled by `span`, so it rises on the left in the
// evening and sets on the right in the morning, and its altitude scaled so that every night, short summer ones too,
// it peaks at `highest` when the sun is lowest; `centre` shifts the whole path sideways (negative: to the left). While the
// sun never sets there is no moon. Radians throughout.
export function moonPosition(
  sun: { altitude: number; azimuth: number; declination: number },
  latitude: number,
  span: number,
  highest: number,
  centre = 0,
) {
  // Opposite the sun, measured so that it passes 0 at the deepest point of the night: there the sun stands due north on
  // the northern hemisphere, due south on the southern one.
  const opposite = latitude >= 0 ? Math.atan2(-Math.sin(sun.azimuth), -Math.cos(sun.azimuth)) : -sun.azimuth;
  const lowest = Math.abs(latitude + sun.declination) - Math.PI / 2;
  const altitude = lowest < 0 ? (highest * Math.sin(-sun.altitude)) / Math.sin(-lowest) : -Math.PI / 2;
  return { altitude, azimuth: centre + span * opposite };
}
// Share of the sky's light that reaches reflections and ambient light: a low level at night, full by day.
const NIGHT_ENVIRONMENT = 0.12;
export const environmentIntensity = (altitude: number) => NIGHT_ENVIRONMENT + (1 - NIGHT_ENVIRONMENT) * daylight(altitude);
// Changes whenever the sun has moved half a degree: the environment cube is re-rendered then.
export const environmentKey = (altitude: number, azimuth: number) =>
  `${Math.round(altitude / RAD / 0.5) * 0.5}:${Math.round(azimuth / RAD / 0.5) * 0.5}`;
