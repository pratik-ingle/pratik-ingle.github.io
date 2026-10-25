// The "Latest" list on the home page. `highlight` gives the chip the accent colour;
// `image` (a file in public/) replaces the placeholder thumbnail.
export const latest: {
  kind: string;
  status: string;
  title: string;
  text: string;
  media: string;
  href: string;
  image?: string;
  highlight?: boolean;
}[] = [
  {
    kind: 'Product',
    status: 'Live · open to everyone',
    title: 'Time Weaver',
    text: 'A time-tracking app with a built-in AI assistant and an MCP connector for Claude. Give it a try and tell me what you think.',
    media: '[Screenshot: the Time Weaver landing page]',
    image: '/media/time-weaver.jpg',
    href: 'https://timeweaver.dev/',
    highlight: true,
  },
  {
    kind: 'Research',
    status: 'In progress · manuscript',
    title: 'Retrieve + Refine VLA',
    text: 'Verified VLA actions for about the cost of one plain call. Now testing on LIBERO with π0.5.',
    media: '[Poster: the Retrieve + Refine VLA pipeline]',
    image: '/media/retrieve-refine-poster.jpg',
    href: '/work/retrieve-refine-vla/',
  },
  {
    kind: 'Research',
    status: 'Benchmark report · October 2026',
    title: 'Thermodynamic solvers for robot state estimation',
    text: 'Can a thermodynamic chip replace the digital solver in a robot’s control loop? Warm-started iterative refinement cut device time about 330× while matching an exact solver.',
    media: '[Clip: closed-loop pick-and-place, exact solver and thermox side by side]',
    image: '/media/thermodynamic-pick-place.mp4',
    href: '/work/thermodynamic-solvers/',
  },
  {
    kind: 'Writing',
    status: 'New post',
    title: 'Universal Coding Language',
    text: 'Where programming goes when AI agents write most of the code.',
    media: '[Cover: one task written for each layer of the stack, from English intent to a latent vector]',
    image: '/media/universal-coding-language-cover.png',
    href: 'https://pratik-ingle.github.io/posts/essays/universal-coding-language/',
  },
];
