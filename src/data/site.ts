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

// Rows in the "Let's talk!" contact window, in order. `copy` adds a button that copies the value.
export const contact: { label: string; text: string; href: string; copy?: string }[] = [
  { label: 'Email', text: site.email, href: `mailto:${site.email}`, copy: site.email },
  { label: 'X', text: '@PratikIngle_', href: 'https://x.com/PratikIngle_' },
  { label: 'LinkedIn', text: 'Pratik Ingle', href: 'https://www.linkedin.com/in/pratik-ingle-03034b152' },
  { label: 'GitHub', text: '@pratik-ingle', href: 'https://github.com/pratik-ingle' },
  { label: 'Feedback', text: 'Give me anonymous feedback!', href: 'https://www.admonymous.co/pratik-ingle' },
];

export const nav = [
  { label: 'Work', path: '/work/' },
  { label: 'Publications', path: '/publications/' },
  { label: 'Writing', path: '/writing/' },
  { label: 'Life', path: '/life/' },
];
