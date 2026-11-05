// Districts and places of the city. Facts come from window.SITE at runtime;
// this file only adds geography (where each building stands) and theme labels.

export const DISTRICTS = {
  tech: { name: 'Tech District', code: 'T', color: '#2e7a4c', tint: '#7fbf93' },
  civic: { name: 'Civic Center', code: 'C', color: '#a73d5a', tint: '#e48aa2' },
  airfield: { name: 'Airfield', code: 'A', color: '#8a6400', tint: '#e0b54a' },
  desert: { name: 'Desert Edge', code: 'D', color: '#b04e2a', tint: '#ee9a72' },
  harbor: { name: 'Harbor', code: 'H', color: '#2d5b89', tint: '#86b3e0' },
  coast: { name: 'Lighthouse Point', code: 'L', color: '#0f7a7e', tint: '#6fcfcf' },
  campus: { name: 'Campus', code: 'U', color: '#6c4f92', tint: '#b9a0dc' },
  oldtown: { name: 'Old Town', code: 'O', color: '#7a5634', tint: '#d4a679' },
};

// Directory lines, in the order a recruiter reads a resume.
export const LINES = [
  { id: 'experience', name: 'Experience', code: '1' },
  { id: 'projects', name: 'Projects', code: '2' },
  { id: 'more', name: 'Education & more', code: '3' },
];

const placeName = (role) => role.place.split(',')[0];

// Geography: focus point, label anchor height (and an optional x/z for the
// label when it should sit on a landmark other than the focus point), framing
// radius (world units), and the camera azimuth/elevation (degrees) for the close-up.
const GEO = {
  research: { at: [12, 0, -17], top: 9.5, r: 11, az: 32, el: 30 },
  va: { at: [12.5, 0, 3], top: 10.5, r: 12, az: 34, el: 30 },
  bahrain: { at: [-31, 0, -24], top: 13.9, pinAt: [-23.8, -26.8], r: 17, az: -28, el: 36 },
  djibouti: { at: [35, 0, -24], top: 11, r: 15, az: 54, el: 34 },
  navy: { at: [-33, 0, 4], top: 10, r: 15, az: 52, el: 30 },
  projects: { at: [-5, 2, -9], top: 0, r: 20, az: 38, el: 34 },
  tak: { at: [-5, 0, -17], top: 31.5, r: 16, az: 36, el: 24, fy: 11 },
  ironmargins: { at: [-14, 0, -15], top: 15.5, r: 10, az: 44, el: 28 },
  pearltide: { at: [-39, 0, 30], top: 12.6, r: 10, az: 50, el: 26, fy: 4 },
  burpcockpit: { at: [-15, 0, 9], top: 4.4, r: 6, az: 30, el: 30 },
  glassskull: { at: [-11, 0, 9], top: 4.4, r: 6, az: 30, el: 30 },
  smolllm: { at: [-7, 0, 9], top: 4.4, r: 6, az: 30, el: 30 },
  llamacalc: { at: [-3, 0, 9], top: 4.4, r: 6, az: 30, el: 30 },
  hostilevolume: { at: [1, 0, 9], top: 4.4, r: 6, az: 30, el: 30 },
  education: { at: [35, 0, 1], top: 12.6, r: 13, az: 30, el: 28, fy: 4 },
  book: { at: [16.5, 0, 21], top: 9.5, r: 7.5, az: 66, el: 28 },
  contact: { at: [16.5, 0, 29], top: 6.6, r: 7, az: 66, el: 28 },
};

// Builds the ordered list of places from SITE. Every fact shown comes from SITE.
export function buildPlaces(S) {
  const roles = S.roles;
  const places = [];
  const add = (p) => places.push({ ...p, ...GEO[p.id] });

  for (const role of roles) {
    const building = {
      research: 'Research Lab',
      va: 'VA Police Station',
      bahrain: placeName(role),
      djibouti: placeName(role),
      navy: 'Navy Pier',
    }[role.id];
    const district = { research: 'tech', va: 'civic', bahrain: 'airfield', djibouti: 'desert', navy: 'harbor' }[role.id];
    add({
      id: role.id, kind: 'role', line: 'experience', district, data: role,
      building, title: role.short, meta: role.years,
      pin: { name: building, sub: role.years, prio: 9 },
    });
  }

  add({
    id: 'projects', kind: 'district', line: 'projects', district: 'tech', data: S.allProjects,
    building: DISTRICTS.tech.name, title: 'All projects', meta: `${S.allProjects.length} projects`,
    pin: null,
  });
  add({
    id: 'tak', kind: 'tak', line: 'projects', district: 'tech', data: S.tak,
    building: 'TAK Tower', title: S.tak.name, meta: S.tak.subtitle,
    pin: { name: 'TAK Tower', sub: S.tak.subtitle, prio: 10 },
  });
  const featured = { ironmargins: ['Iron Margins', 'tech'], pearltide: ['Pearl Tide Lighthouse', 'coast'] };
  for (const p of S.featured) {
    const [building, district] = featured[p.id] || [p.name, 'tech'];
    add({
      id: p.id, kind: 'featured', line: 'projects', district, data: p,
      building, title: p.name, meta: p.tag,
      pin: { name: p.id === 'pearltide' ? 'Pearl Tide Light' : building, sub: p.tag.split(' · ')[0], prio: 8 },
    });
  }
  for (const p of S.more) {
    add({
      id: p.id, kind: 'kiosk', line: 'projects', district: 'tech', data: p,
      building: 'Project Row', title: p.name, meta: p.tag,
      pin: { name: p.name, sub: p.tag, prio: 3, small: true },
    });
  }

  add({
    id: 'education', kind: 'education', line: 'more', district: 'campus', data: S.education,
    building: 'University Hall', title: 'Education', meta: S.education.degree,
    pin: { name: 'University Hall', sub: 'Education', prio: 8 },
  });
  add({
    id: 'book', kind: 'book', line: 'more', district: 'oldtown', data: S.book,
    building: 'Bookshop', title: 'The book', meta: S.book.title,
    pin: { name: 'Bookshop', sub: 'The book', prio: 7 },
  });
  add({
    id: 'contact', kind: 'contact', line: 'more', district: 'oldtown', data: S.links,
    building: 'Post Office', title: 'Contact', meta: 'Resume, links, and email',
    pin: { name: 'Post Office', sub: 'Contact', prio: 7 },
  });

  places.forEach((p, i) => { p.index = i; });
  return places;
}

// "2026-03" -> "Mar 2026"
export function monthYear(ym) {
  const [y, m] = ym.split('-').map(Number);
  if (!m) return String(y);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
