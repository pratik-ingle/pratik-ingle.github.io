export const site = {
  name: 'Pratik Ingle',
  role: 'Embodied AI and LLM safety researcher',
  description:
    'Pratik Ingle is a PhD candidate at the IT University of Copenhagen working on robot learning, tactile perception and world models.',
  tagline: 'Embodied AI, LLM inference & safety — 55.68°N 12.57°E',
  location: 'Copenhagen · 55.68°N 12.57°E',
  email: 'pratik.ingle135@gmail.com',
};

export const socials = [
  { label: 'Scholar', icon: 'scholar', href: 'https://scholar.google.com/citations?hl=en&user=J_lEQ7kAAAAJ' },
  { label: 'GitHub', icon: 'code', href: 'https://github.com/pratik-ingle' },
  { label: 'LinkedIn', icon: 'briefcase', href: 'https://www.linkedin.com/in/pratik-ingle-03034b152' },
  { label: 'Email', icon: 'mail', href: `mailto:${site.email}` },
] as const;

export const nav = [
  { label: 'Work', path: '/work/' },
  { label: 'Publications', path: '/publications/' },
  { label: 'Writing', path: '/writing/' },
  { label: 'Life', path: '/life/' },
];
