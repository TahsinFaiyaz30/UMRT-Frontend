/**
 * Declarative map of every raw asset in RESOURCES/ to a stable media ID.
 *
 * `scripts/build-media-library.mjs` reads this file, produces responsive
 * derivatives under `public/media/`, and writes `data/media-manifest.json`.
 *
 * The IDs here are the contract with the content datasets in `data/` (and
 * eventually with the backend): a record never points at a file path, it
 * points at a media ID. Re-encoding, re-cropping, or moving an original
 * therefore never invalidates content.
 *
 * RESOURCES/ itself is intentionally NOT committed — it is 1.3 GB of camera
 * originals. Only the derivatives and this manifest ship.
 */

/** Width ladders per profile. Widths above an original's own width are skipped. */
export const profiles = {
  /** Landscape documentary photography: rover, field, competition, outreach. */
  photo: { widths: [480, 960, 1600], quality: 76 },
  /** 9:16 studio portraits of crew members. */
  portrait: { widths: [320, 640, 960], quality: 78 },
  /** Square pre-composed roster graphics (text is baked in — keep them crisp). */
  card: { widths: [400, 800], quality: 78 },
  /** Transparent institutional marks. */
  logo: { widths: [128, 256, 512], quality: 86, alpha: true },
};

export const videoProfile = {
  /** height, crf, audio bitrate */
  renditions: [
    { height: 1080, crf: 27, audioKbps: 128 },
    { height: 720, crf: 29, audioKbps: 96 },
  ],
  /** Second offset the poster frame is grabbed from. */
  posterAtSeconds: 6,
  posterWidths: [640, 1280, 1920],
  posterQuality: 74,
};

const roverPhotos = [
  {
    id: 'rover-sunset-playa',
    file: 'Rover Photo/Messenger_creation_CD8AE212-21D7-401C-BA75-2768A31DFC40.jpeg',
    alt: 'The rover alone on a flat desert pan at sunset, antennas raised against a low orange sun.',
    caption: 'Sundown on the competition pan.',
    tags: ['rover', 'field', 'hero'],
  },
  {
    id: 'rover-field-poles',
    file: 'Rover Photo/IMG_2647.JPG',
    alt: 'The rover parked on dry desert ground beneath utility poles and a wide blue sky, mast and antennas deployed.',
    caption: 'Field configuration, mast deployed.',
    tags: ['rover', 'field', 'hero'],
  },
  {
    id: 'rover-terrain-climb',
    file: 'Rover Photo/IMG-20260331-WA0032.jpg',
    alt: 'The rover climbing a mound of broken earth with its orange wheels dug in, apartment blocks behind.',
    caption: 'Traverse test on excavated ground.',
    tags: ['rover', 'testing', 'hero'],
  },
  {
    id: 'rover-studio-night',
    file: 'Rover Photo/20260227_040515.jpg',
    alt: 'The rover lit by a single lamp on a dark studio floor, manipulator arm raised.',
    caption: 'Arm raised, single-light study.',
    tags: ['rover', 'studio', 'hero'],
  },
  {
    id: 'rover-sunset-wide',
    file: 'Rover Photo/Messenger_creation_F48669A0-5B62-427A-9FA7-0E52DF0C133B.jpeg',
    alt: 'Wide view of the rover on open desert at sunset with distant mesas on the horizon.',
    caption: 'Open desert, last light.',
    tags: ['rover', 'field'],
  },
  {
    id: 'rover-field-open',
    file: 'Rover Photo/IMG_2663.JPG',
    alt: 'The rover on open desert ground under a bright sky, seen from behind.',
    caption: 'Rear quarter on open ground.',
    tags: ['rover', 'field'],
  },
  {
    id: 'rover-terrain-traverse',
    file: 'Rover Photo/IMG-20260331-WA0033.jpg',
    alt: 'The rover crossing packed dirt beside a bare tree during a local traverse test.',
    caption: 'Local traverse validation run.',
    tags: ['rover', 'testing'],
  },
  {
    id: 'rover-field-camp',
    file: 'Rover Photo/IMG_2673.JPG',
    alt: 'The rover on gravel with the competition site buildings in the background.',
    caption: 'Staged beside the field site.',
    tags: ['rover', 'field'],
  },
  {
    id: 'rover-terrain-approach',
    file: 'Rover Photo/IMG-20260331-WA0036.jpg',
    alt: 'The rover driving across grass with a domed building behind it.',
    caption: 'Approach geometry check.',
    tags: ['rover', 'testing'],
  },
  {
    id: 'rover-grass-trial',
    file: 'Rover Photo/20260227_173525.jpg',
    alt: 'The rover on a stretch of grass with construction cranes and city buildings behind.',
    caption: 'Drive trial on soft ground.',
    tags: ['rover', 'testing'],
  },
  {
    id: 'rover-sunset-horizon',
    file: 'Rover Photo/Messenger_creation_F284152D-4359-4D3C-B7C3-BC8647EBA67A.jpeg',
    alt: 'The rover silhouetted on a desert flat as the sun drops to the horizon.',
    caption: 'Silhouette at the horizon.',
    tags: ['rover', 'field'],
  },
];

const urcPhotos = [
  {
    id: 'urc26-team-banner',
    file: 'URC 2026/IMG-20260531-WA0013.jpg',
    alt: 'The UMRT crew standing with the rover, the Bangladesh flag and a United International University banner in front of a University Rover Challenge backdrop.',
    caption: 'Crew and rover at the University Rover Challenge.',
    tags: ['urc', 'competition', 'crew', 'hero'],
  },
  {
    id: 'urc26-podium-announcement',
    file: 'URC 2026/image_2026-05-31_182314864.png',
    alt: 'Announcement graphic: UIU Mars Rover Team ranks 3rd worldwide at University Rover Challenge 2026 with the Best Autonomous System recognition, the first Asian team on the podium in twenty years.',
    caption: '3rd worldwide. First Asian team on the podium in 20 years.',
    tags: ['urc', 'competition', 'announcement'],
  },
  {
    id: 'urc26-butte-celebration',
    file: 'URC 2026/IMG-20260531-WA0015.jpg',
    alt: 'The team celebrating with raised arms beside the rover, holding the Bangladesh flag and a university banner below a desert butte.',
    caption: 'Celebration below the butte.',
    tags: ['urc', 'competition', 'crew'],
  },
  {
    id: 'urc26-butte-group',
    file: 'URC 2026/IMG-20260531-WA0017(1).jpg',
    alt: 'The full team posed with the rover and flags in front of a red desert butte.',
    caption: 'Team portrait at the field site.',
    tags: ['urc', 'competition', 'crew'],
  },
  {
    id: 'urc26-team-rovers',
    file: 'URC 2026/IMG-20260531-WA0019.jpg',
    alt: 'Team members standing behind two rovers on the desert competition ground.',
    caption: 'Both platforms on the line.',
    tags: ['urc', 'competition'],
  },
  {
    id: 'urc26-teams-lineup',
    file: 'URC 2026/IMG-20260531-WA0021.jpg',
    alt: 'Competing teams and their rovers lined up together beside a support vehicle at the competition site.',
    caption: 'Teams and machines, end of day.',
    tags: ['urc', 'competition'],
  },
  {
    id: 'urc26-flag-plain',
    file: 'URC 2026/IMG-20260531-WA0025.jpg',
    alt: 'The team holding the Bangladesh flag and a university banner on an open desert plain with the rover in front.',
    caption: 'Flag on the plain.',
    tags: ['urc', 'competition', 'crew'],
  },
  {
    id: 'urc26-banner-group',
    file: 'URC 2026/IMG-20260531-WA0028.jpg',
    alt: 'The team gathered with the rover and flags in front of the University Rover Challenge banner.',
    caption: 'Under the competition banner.',
    tags: ['urc', 'competition', 'crew'],
  },
  {
    id: 'urc26-banner-wide',
    file: 'URC 2026/IMG-20260531-WA0035.jpg',
    alt: 'Wide view of the team with two rovers and flags in front of the University Rover Challenge banner.',
    caption: 'Both rovers under the banner.',
    tags: ['urc', 'competition', 'crew'],
  },
  {
    id: 'urc26-rover-field',
    file: 'URC 2026/IMG_2649.JPG',
    alt: 'The rover standing ready on desert ground at the competition, utility poles behind it.',
    caption: 'Ready state on the course.',
    tags: ['urc', 'competition', 'rover'],
  },
  {
    id: 'urc26-service-task',
    file: 'URC 2026/IMG_2654.JPG',
    alt: 'Two crew members crouched beside the rover working on it during a competition task.',
    caption: 'Servicing between tasks.',
    tags: ['urc', 'competition', 'rover'],
  },
];

const bearSummitPhotos = [
  {
    id: 'bear26-visitor-child',
    file: 'Bear summit 2026/IMG_9863.JPG',
    alt: 'A young visitor looking closely at the rover on an exhibition floor while a crowd moves around the stand.',
    caption: 'First contact, exhibition floor.',
    tags: ['outreach', 'bear-summit', 'hero'],
  },
  {
    id: 'bear26-stand-a',
    file: 'Bear summit 2026/IMG_9867.JPG',
    alt: 'The rover displayed on the exhibition floor with visitors around it.',
    caption: 'Stand traffic.',
    tags: ['outreach', 'bear-summit'],
  },
  {
    id: 'bear26-stand-b',
    file: 'Bear summit 2026/IMG_9870.JPG',
    alt: 'The rover at the UMRT booth with team signage behind it.',
    caption: 'At the booth.',
    tags: ['outreach', 'bear-summit'],
  },
  {
    id: 'bear26-stand-c',
    file: 'Bear summit 2026/IMG_9893.jpg',
    alt: 'Visitors gathered around the rover at the exhibition stand.',
    caption: 'Visitors at the stand.',
    tags: ['outreach', 'bear-summit'],
  },
  {
    id: 'bear26-record-banner',
    file: 'Bear summit 2026/Copy of IMG_9669.JPG',
    alt: 'The UMRT booth with a banner reading "UIU broke the record 2026" and attendees in conversation.',
    caption: 'The record, on the wall.',
    tags: ['outreach', 'bear-summit'],
  },
  {
    id: 'bear26-hall',
    file: 'Bear summit 2026/Copy of IMG_9773.JPG',
    alt: 'Attendees moving through the summit exhibition hall past the team stand.',
    caption: 'Exhibition hall.',
    tags: ['outreach', 'bear-summit'],
  },
];

const outreachPhotos = [
  {
    id: 'iut26-crew-rover',
    file: 'Dev Hub (Videos)/IUT ROVER SUMMIT/20260711_123002(0).jpg',
    alt: 'The full UMRT crew posed with the rover in a brick colonnade at the IUT Rover Summit.',
    caption: 'Crew and rover, IUT Rover Summit.',
    tags: ['outreach', 'iut-summit', 'crew', 'hero'],
  },
  {
    id: 'iut26-panel-speaker',
    file: 'Dev Hub (Videos)/IUT ROVER SUMMIT/IMG-20260712-WA0033.jpg',
    alt: 'A UMRT member speaking into a microphone on stage under a Rover Summit panel discussion backdrop.',
    caption: 'On the summit panel.',
    tags: ['outreach', 'iut-summit'],
  },
  {
    id: 'iut26-panel-stage',
    file: 'Dev Hub (Videos)/IUT ROVER SUMMIT/IMG-20260712-WA0233.jpg',
    alt: 'The Rover Summit panel on stage, one speaker standing and addressing the room.',
    caption: 'Panel discussion, 11 July.',
    tags: ['outreach', 'iut-summit'],
  },
  {
    id: 'iut26-award',
    file: 'Dev Hub (Videos)/IUT ROVER SUMMIT/IMG-20260712-WA0238.jpg',
    alt: 'A certificate being handed to a UMRT member on stage at the Rover Summit.',
    caption: 'Recognition on stage.',
    tags: ['outreach', 'iut-summit'],
  },
  {
    id: 'ieeb26-stand',
    file: 'Dev Hub (Videos)/IEEB/20260613_140835.jpg',
    alt: 'Three crew members standing behind the rover on a display table at an IEEE Bangladesh event, ground station laid out beside it.',
    caption: 'Open bench at the IEEE showcase.',
    tags: ['outreach', 'ieeb'],
  },
  {
    id: 'udayan26-students',
    file: 'Dev Hub (Videos)/Udayan Science Fest Event Photos/Copy of IMG-20260409-WA0037.jpg',
    alt: 'School students crowding around the rover in a courtyard at the Udayan Science Carnival.',
    caption: 'Students meeting the rover.',
    tags: ['outreach', 'udayan', 'hero'],
  },
  {
    id: 'udayan26-group',
    file: 'Dev Hub (Videos)/Udayan Science Fest Event Photos/Copy of IMG-20260409-WA0040.jpg',
    alt: 'A large group of students and staff gathered behind the rover for a photograph at the carnival.',
    caption: 'The whole hall, one frame.',
    tags: ['outreach', 'udayan'],
  },
  {
    id: 'udayan26-reach',
    file: 'Dev Hub (Videos)/Udayan Science Fest Event Photos/Copy of IMG-20260409-WA0041.jpg',
    alt: 'A boy reaching toward the rover on a display table while a crew member explains it.',
    caption: 'Hands on the hardware.',
    tags: ['outreach', 'udayan'],
  },
  {
    id: 'udayan26-demo',
    file: 'Dev Hub (Videos)/Udayan Science Fest Event Photos/Copy of IMG-20260409-WA0043.jpg',
    alt: 'A crew member demonstrating the manipulator arm to a circle of school children.',
    caption: 'Demonstrating the arm.',
    tags: ['outreach', 'udayan'],
  },
  {
    id: 'udayan26-courtyard',
    file: 'Dev Hub (Videos)/Udayan Science Fest Event Photos/Copy of IMG-20260409-WA0047.jpg',
    alt: 'The rover driving along a courtyard path beneath a university canopy while students watch from both sides.',
    caption: 'Courtyard traverse.',
    tags: ['outreach', 'udayan'],
  },
  {
    id: 'uiu26-welcome-crowd',
    file: 'Dev Hub (Videos)/UIU Celebration/DSC02458.jpg',
    alt: 'A large crowd of students raising phones to record the team returning to campus.',
    caption: 'Campus welcome.',
    tags: ['outreach', 'uiu-celebration', 'hero'],
  },
  {
    id: 'uiu26-garlands',
    file: 'Dev Hub (Videos)/UIU Celebration/DSC02473.jpg',
    alt: 'Team members wearing flower garlands as they are honoured in front of the assembled students.',
    caption: 'Honoured on return.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-unveiling',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120459.jpg',
    alt: 'The team unveiling a commemorative plaque together on stage under a "STARS" backdrop.',
    caption: 'Unveiling the plaque.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-stage',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120503.jpg',
    alt: 'The team gathered on stage around the commemorative plaque during the campus ceremony.',
    caption: 'On stage together.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-hands',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120505.jpg',
    alt: 'Many hands together on the commemorative plaque as the team unveils it.',
    caption: 'Every hand on it.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-close',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120505(1).jpg',
    alt: 'Close view of the team around the plaque during the unveiling.',
    caption: 'The moment itself.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-confetti',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120510.jpg',
    alt: 'Confetti falling over the team as the commemorative plaque is revealed.',
    caption: 'Confetti over the plaque.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-wide',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120517.jpg',
    alt: 'Wide view of the ceremony stage with the team and university banners.',
    caption: 'Ceremony, wide.',
    tags: ['outreach', 'uiu-celebration'],
  },
  {
    id: 'uiu26-stars-after',
    file: 'Dev Hub (Videos)/UIU Celebration/20260607_120521.jpg',
    alt: 'The team standing together after the unveiling as confetti settles.',
    caption: 'After the reveal.',
    tags: ['outreach', 'uiu-celebration'],
  },
];

/**
 * The roster. Index N maps to `Cards/N.png` (the pre-composed graphic with the
 * name baked in) and to the matching raw studio portrait. Members 1-9 keep
 * their portraits in the `Mentor & Leads` subfolder.
 */
export const roster = [
  { n: 1, name: 'Abid Hossain', role: 'Mentor', unit: null, portrait: 'Raw Photos/Mentor & Leads/MENTOR.png' },
  { n: 2, name: 'Saif Al Saad', role: 'Team Lead', unit: null, portrait: 'Raw Photos/Mentor & Leads/2.png' },
  { n: 3, name: 'Sheikh Shakib', role: 'Co-Team Lead', unit: null, portrait: 'Raw Photos/Mentor & Leads/3.jpg' },
  { n: 4, name: 'Mosfiqur Rahman', role: 'Senior Lead', unit: null, portrait: 'Raw Photos/Mentor & Leads/4.png' },
  { n: 5, name: 'Nadim Hossain', role: 'Sub-Team Lead', unit: 'Media and Branding', portrait: 'Raw Photos/Mentor & Leads/5.png' },
  { n: 6, name: 'Salman Kabir', role: 'Sub-Team Lead', unit: 'Autonomous Team', portrait: 'Raw Photos/Mentor & Leads/6.png' },
  { n: 7, name: 'Sabbir Ahmed', role: 'Sub-Team Lead', unit: 'Aerial and Communication Team', portrait: 'Raw Photos/Mentor & Leads/7.png' },
  { n: 8, name: 'Ayesha Sayma', role: 'Sub-Team Lead', unit: 'Science Team', portrait: 'Raw Photos/Mentor & Leads/8.png' },
  { n: 9, name: 'Siam Ibne Sarwar', role: 'Sub-Team Lead', unit: 'Mechanical Team', portrait: 'Raw Photos/Mentor & Leads/9.jpg' },
  { n: 10, name: 'Mahin Hasan Upol', role: 'Member', unit: 'Autonomous Team' },
  { n: 11, name: 'Talha Jubayer', role: 'Member', unit: 'Autonomous Team' },
  { n: 12, name: 'Muhutasim Sadik', role: 'Member', unit: 'Autonomous Team' },
  { n: 13, name: 'Shahriar Siyam', role: 'Member', unit: 'Autonomous Team' },
  { n: 14, name: 'Bakhtiar Fahim', role: 'Member', unit: 'Autonomous Team' },
  { n: 15, name: 'Arman Hossain', role: 'Member', unit: 'Autonomous Team' },
  { n: 16, name: 'Marina Montaz', role: 'Member', unit: 'Media and Branding' },
  { n: 17, name: 'Zihad Shariar', role: 'Member', unit: 'Media and Branding' },
  { n: 18, name: 'Riad Hossen', role: 'Member', unit: 'Mechanical Team' },
  { n: 19, name: 'Nazmuz Sakib', role: 'Member', unit: 'Mechanical Team' },
  { n: 20, name: 'Miraz Al Hyder', role: 'Member', unit: 'Mechanical Team' },
  { n: 21, name: 'Alif Nebir', role: 'Member', unit: 'Mechanical Team' },
  { n: 22, name: 'Mimtiage Hemal', role: 'Member', unit: 'Mechanical Team' },
  { n: 23, name: 'Adipta Shaha', role: 'Member', unit: 'Logistics' },
  { n: 24, name: 'Shanjida Shopna', role: 'Member', unit: 'Science Team' },
  { n: 25, name: 'Nowshin Faria', role: 'Member', unit: 'Science Team' },
  { n: 26, name: 'Epshita Sara', role: 'Member', unit: 'Science Team' },
  { n: 27, name: 'Syed Thuha', role: 'Member', unit: 'Electrical Team' },
  { n: 28, name: 'Sabik Sifat', role: 'Member', unit: 'Electrical Team' },
  { n: 29, name: 'Partha Podder', role: 'Member', unit: 'Electrical Team' },
  { n: 30, name: 'Abir Saba', role: 'Member', unit: 'Autonomous Team' },
  { n: 31, name: 'Abrar Adib', role: 'Member', unit: 'Media and Branding' },
  { n: 32, name: 'Aninda Talukdar', role: 'Member', unit: 'Aerial and Communication Team' },
];

/** `crew-<slug>` portraits and `crew-card-<slug>` roster graphics. */
export function crewSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const crewPortraits = roster.map((person) => ({
  id: `crew-${crewSlug(person.name)}`,
  file: person.portrait ?? `Raw Photos/${person.n}.png`,
  alt: `Studio portrait of ${person.name}, ${person.role.toLowerCase()}${person.unit ? `, ${person.unit.toLowerCase()}` : ''}, UIU Mars Rover Team.`,
  caption: person.name,
  tags: ['crew', 'portrait'],
}));

const crewCards = roster.map((person) => ({
  id: `crew-card-${crewSlug(person.name)}`,
  file: `Cards/${person.n}.png`,
  alt: `UIU Mars Rover Team roster card for ${person.name}, ${person.role}${person.unit ? `, ${person.unit}` : ''}.`,
  caption: person.name,
  tags: ['crew', 'card'],
}));

const logos = [
  {
    id: 'mark-umrt',
    file: 'Logoo/umrt.png',
    alt: 'UIU Mars Rover Team emblem.',
    caption: 'UIU Mars Rover Team',
    tags: ['mark'],
  },
  {
    id: 'mark-umrt-wordmark',
    file: 'Logoo/uiu mars rover team.png',
    alt: 'UIU Mars Rover Team vertical wordmark.',
    caption: 'UIU Mars Rover Team wordmark',
    tags: ['mark'],
  },
  {
    id: 'mark-uiu',
    file: 'Logoo/uiu.png',
    alt: 'United International University emblem.',
    caption: 'United International University',
    tags: ['mark', 'partner'],
  },
  {
    id: 'mark-cair',
    file: 'Logoo/cair.png',
    alt: 'Center for Advanced Intelligent Robotics emblem.',
    caption: 'Center for Advanced Intelligent Robotics',
    tags: ['mark', 'partner'],
  },
];

/** @type {{ id: string, label: string, profile: keyof typeof profiles, items: Array<{ id: string, file: string, alt: string, caption: string, tags: string[] }> }[]} */
export const collections = [
  { id: 'rover', label: 'Rover platform', profile: 'photo', items: roverPhotos },
  { id: 'urc', label: 'University Rover Challenge', profile: 'photo', items: urcPhotos },
  { id: 'summit', label: 'Bear Summit', profile: 'photo', items: bearSummitPhotos },
  { id: 'outreach', label: 'Outreach and exhibitions', profile: 'photo', items: outreachPhotos },
  { id: 'crew', label: 'Crew portraits', profile: 'portrait', items: crewPortraits },
  { id: 'roster', label: 'Roster graphics', profile: 'card', items: crewCards },
  { id: 'marks', label: 'Institutional marks', profile: 'logo', items: logos },
];

export const videos = [
  {
    id: 'film-promo',
    /**
     * `PROMO VIDEO .mp4` and `Dev Hub (Videos)/Copy of PROMO VIDEO FINAL V2.mp4`
     * are byte-identical masters; only one is encoded.
     */
    file: 'PROMO VIDEO .mp4',
    alt: 'UIU Mars Rover Team promotional film.',
    title: 'The machine, the crew, the distance',
    caption: 'UMRT promotional film.',
    tags: ['film', 'promo'],
    // The opening is a letterboxed title card; 00:52 is the lit night shot of
    // the rover alone on a dark floor, which matches the site's palette.
    posterAtSeconds: 52,
  },
  {
    id: 'film-final-cut',
    file: 'FINAL OUTPUT.mp4',
    alt: 'UIU Mars Rover Team mission film.',
    title: 'Mission cut',
    caption: 'Mission film, final cut.',
    tags: ['film'],
    posterAtSeconds: 6,
  },
];
