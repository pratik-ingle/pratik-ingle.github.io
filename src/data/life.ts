// Text in [brackets] is a placeholder to replace with your own details.
// Add `image: '/media/archery.jpg'` (a file in public/) to any item to swap its placeholder box for a photo or clip.

export const interests: {
  fig: string;
  title: string;
  // Short line beside the title, e.g. "Recurve · club name · best result". Leave out to hide it.
  spec?: string;
  // Placeholder caption until `image` is set; also used as the image's alt text.
  media: string;
  text: string;
  exploring?: boolean;
  image?: string;
}[] = [
  {
    fig: 'FIG. L1',
    title: 'Archery',
    media: '[Photo: arrows grouped around the bullseye]',
    image: '/media/life/archery.jpg',
    text: 'I compete in archery. It’s a sport of calm, focus and doing the same small thing well, over and over.',
  },
  {
    fig: 'FIG. L2',
    title: 'Ceramics',
    media: '[Photo: two glazed ceramic pieces on a studio table]',
    image: '/media/life/ceramics.jpg',
    text: 'Traditional craft I keep coming back to. Clay is slow, tactile and honest about every mistake.',
  },
  {
    fig: 'FIG. L3',
    title: 'Winter bathing',
    media: '[Photo: the sun low over a bathing jetty]',
    image: '/media/life/winter-bathing.jpg',
    text: 'Cold dips through the Danish winter. The first few seconds are hard; the rest of the day feels great.',
  },
  {
    fig: 'FIG. L4',
    title: 'Scuba diving',
    media: '[Photo: divers exploring the seabed]',
    image: '/media/life/scuba-diving.jpg',
    text: 'My newest fascination, and the thing I’m exploring most right now: a whole new world to learn, one dive at a time. [Certification, first dives, dream sites.]',
    exploring: true,
  },
];

// The photo grid shows four at a time and cross-fades through the rest. The first four load first.
export const photos: { caption: string; image?: string }[] = [
  { caption: 'A hand-forged knife with a wooden handle beside its paper template', image: '/media/life/strip-09.jpg' },
  { caption: 'A blue ceramic bowl marked with red lines', image: '/media/life/strip-11.jpg' },
  { caption: 'Shaping glass at a torch flame', image: '/media/life/strip-12.jpg' },
  { caption: 'A hand holding an unfired clay cup', image: '/media/life/strip-05.jpg' },
  { caption: 'Glazed ceramic pieces on a studio table', image: '/media/life/strip-01.jpg' },
  { caption: 'A clay vessel taking shape on a board', image: '/media/life/strip-02.jpg' },
  { caption: 'Unfired clay vessels on a workbench', image: '/media/life/strip-03.jpg' },
  { caption: 'A hand holding a painted porcelain cup', image: '/media/life/strip-04.jpg' },
  { caption: 'A clay bowl on a wooden board', image: '/media/life/strip-06.jpg' },
  { caption: 'Beside a hanging calligraphy scroll', image: '/media/life/strip-07.jpg' },
  { caption: 'Metal held in tongs over an anvil', image: '/media/life/strip-08.jpg' },
  { caption: 'A knife blade laid beside its paper template', image: '/media/life/strip-10.jpg' },
  { caption: 'A small wire-and-bead bonsai tree in a cup', image: '/media/life/strip-13.jpg' },
];

export type BookStatus = 'Reading now' | 'Favourite' | 'Finished';

// Books you're reading now go first; `take` is the one- or two-line summary under the author.
export const books: { status: BookStatus; title: string; author: string; take: string; cover?: string }[] = [
  {
    status: 'Reading now',
    title: 'Sleeping Giants',
    author: 'Sylvain Neuvel',
    take: 'A giant metal hand found buried in South Dakota starts a hunt for the rest of an ancient robot, told entirely through interviews and files.',
    cover: '/media/books/sleeping-giants.jpg',
  },
  {
    status: 'Reading now',
    title: 'Gödel, Escher, Bach: an Eternal Golden Braid',
    author: 'Douglas Hofstadter',
    take: 'How meaning and self-awareness can arise from formal systems, traced through Gödel’s incompleteness, Escher’s art and Bach’s fugues.',
    cover: '/media/books/godel-escher-bach.jpg',
  },
  {
    status: 'Favourite',
    title: 'Factfulness',
    author: 'Hans Rosling, Anna Rosling Rönnlund and Ola Rosling',
    take: 'Ten instincts that distort how we see the world, and the data showing it is, by most measures, better than we think.',
    cover: '/media/books/factfulness.jpg',
  },
  {
    status: 'Finished',
    title: 'The Creative Act: A Way of Being',
    author: 'Rick Rubin',
    take: 'Creativity as a way of living: paying attention, staying open to ideas, and making work for its own sake.',
    cover: '/media/books/the-creative-act.jpg',
  },
  {
    status: 'Finished',
    title: 'Metamorphosis',
    author: 'Franz Kafka',
    take: 'Gregor Samsa wakes up transformed into a giant insect, and his family’s care slowly turns into resentment.',
    cover: '/media/books/metamorphosis.jpg',
  },
  {
    status: 'Favourite',
    title: 'Siddhartha',
    author: 'Hermann Hesse',
    take: 'A young Brahmin leaves home in search of enlightenment and learns that wisdom can’t be taught, only lived.',
    cover: '/media/books/siddhartha.jpg',
  },
];
