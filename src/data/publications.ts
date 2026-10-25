export interface Paper {
  venue: string;
  title: string;
  note: string;
  // Shown in order before BibTeX, e.g. DOI, video, project page.
  links: { label: string; href: string }[];
  // In prep or under review: the venue line is drawn in the accent colour.
  pending?: boolean;
  media: string;
  image?: string;
  // Paste the full entry to turn the BibTeX link into an expandable, copyable block.
  // false hides the BibTeX link; leaving it out shows a placeholder link.
  bibtex?: string | false;
}

// Newest first, as listed on the page.
export const papers: Paper[] = [
  {
    venue: 'Manuscript · IEEE RA-L',
    title:
      'Joint-Embedding Predictive Pretraining for Tactile Shape Recognition During Manipulation on a Simulated Membrane Surface',
    note: 'Self-supervised tactile learning',
    links: [{ label: 'Preprint soon', href: '#' }],
    pending: true,
    media: '[Clip: the simulated membrane moving an object while the model recognises its shape from touch]',
    image: '/media/jepa-tactile-recognition.mp4',
  },
  {
    venue: 'IEEE ICRA 2027 · Under review',
    title: 'Suspended-Fabric Robotic Manipulation Surfaces: Modelling, Design Space, and Multimodular Extension',
    note: 'IEEE International Conference on Robotics and Automation',
    links: [{ label: 'Preprint ↗', href: '#' }],
    pending: true,
    media: '[Poster: the suspended-fabric surface, its catenary model, success maps and the four-module layout]',
    image: '/media/suspended-fabric-poster.jpg',
  },
  {
    venue: 'IJRR · Under review',
    title: 'Survey of Robotic Manipulation Surfaces: Challenges and Opportunities',
    note: 'International Journal of Robotics Research',
    links: [{ label: 'Preprint ↗', href: '#' }],
    pending: true,
    media: '[Diagram: eight ways an actuated surface moves an object, from vibration plates to soft surfaces]',
    image: '/media/manipulation-surfaces-survey.png',
  },
  {
    venue: 'SAB 2026',
    title: 'Scalable, Distributed Control of a Manipulation Surface with Emergent Properties',
    note: '18th International Conference on the Simulation of Adaptive Behavior, Germany',
    links: [
      { label: 'DOI ↗', href: 'https://doi.org/10.1007/978-3-032-39953-3_1' },
      { label: 'Code ↗', href: 'https://github.com/kstoy/manta-ray-simulation' },
    ],
    media: '[Clip: simulated MANTA-RAY surface arranging scattered balls into the letters SAB]',
    image: '/media/sab-letter-formation.mp4',
    bibtex: `@inproceedings{10.1007/978-3-032-39953-3_1,
  title = {Scalable, Distributed Control of a Manipulation Surface with Emergent Properties},
  booktitle = {From Animals to Animats 18},
  author = {Stoy, Kasper and Ingle, Pratik and Lambertsen, Jørn and Faíña, Andrés},
  editor = {Brock, Oliver and Krichmar, Jeffrey and Mengers, Vito},
  date = {2027},
  pages = {3--14},
  publisher = {Springer Nature Switzerland},
  location = {Cham},
  abstract = {Distributed manipulation surfaces promise scalable, parallel handling of many objects, but how to control them distributedly remains a challenging question. We address this on the MANTA-RAY distributed manipulation system where a fabric is suspended over a grid of pistons. We report on three contributions. First, a computationally efficient catenary-based simulation whose computational cost is independent of the surface size and in the worst case quadratic in the number of objects allowing for simulation at scale. Second, a strictly local control methodology based on a static control table and local sensing. Despite this locality, global behaviors work as designed and, further, we see emergent clustering behavior for which we did not explicitly design. Third, with a priority-based extension, the same controller produces letter formation (“SAB”) on a 7×15 grid-cell, 128-piston system with a 100/100 success rate. The results are a contribution to efficient simulation and large-scale control in the growing field of distributed manipulation surfaces.},
  isbn = {978-3-032-39953-3}
}`,
  },
  {
    venue: 'arXiv:2601.21884',
    title: 'Scalable Surface-Based Manipulation Through Modularity and Inter-Module Object Transfer',
    note: 'With J. Lambertsen, K. Støy and A. Faíña',
    links: [{ label: 'arXiv ↗', href: 'https://arxiv.org/abs/2601.21884' }],
    media: '[Clip: an object passed between MANTA-RAY modules]',
    image: '/media/modular-surface-transfer.mp4',
    bibtex: `@misc{ingle2026scalablesurfacebasedmanipulationmodularity,
  title={Scalable Surface-Based Manipulation Through Modularity and Inter-Module Object Transfer},
  author={Pratik Ingle and Jørn Lambertsen and Kasper Støy and Andres Faina},
  year={2026},
  eprint={2601.21884},
  archivePrefix={arXiv},
  primaryClass={cs.RO},
  url={https://arxiv.org/abs/2601.21884},
}`,
  },
  {
    venue: 'IEEE CASE 2025',
    title: 'Heterogeneous Object Manipulation on Nonlinear Soft Surface Through Linear Controller',
    note: 'IEEE Conference on Automation Science and Engineering',
    links: [
      { label: 'DOI ↗', href: 'https://doi.org/10.1109/CASE58245.2025.11163787' },
      { label: 'Video ↗', href: 'https://www.youtube.com/watch?v=F_qBqfu3rUY' },
      { label: 'Project page ↗', href: 'https://pratik-ingle.github.io/mantaray.github.io/' },
    ],
    media: '[Clip: MANTA-RAY moving a sphere, a cube and a cylinder to their targets]',
    image: '/media/manta-ray-case25.mp4',
    bibtex: `@INPROCEEDINGS{11163787,
  author={Ingle, Pratik and Støy, Kasper and Faiña, Andres},
  booktitle={2025 IEEE 21st International Conference on Automation Science and Engineering (CASE)},
  title={Heterogeneous object manipulation on nonlinear soft surface through linear controller},
  year={2025},
  volume={},
  number={},
  pages={1780-1787},
  keywords={Training;Actuators;Shape;Soft robotics;Hardware;Fabrics;Robustness;Complexity theory;Trajectory;Surface texture;Manipulation;Soft Robot;Robotic Manipulation Surface},
  doi={10.1109/CASE58245.2025.11163787}}`,
  },
  {
    venue: 'IEEE RoboSoft 2025 · Highlight talk',
    title: 'Soft Manipulation Surface With Reduced Actuator Density for Heterogeneous Object Manipulation',
    note: 'IEEE International Conference on Soft Robotics',
    links: [
      { label: 'DOI ↗', href: 'https://doi.org/10.1109/RoboSoft63089.2025.11020841' },
      { label: 'Video ↗', href: 'https://www.youtube.com/watch?v=Ru1Ulb7aw_Q' },
      { label: 'Project page ↗', href: 'https://pratik-ingle.github.io/mantaray.github.io/' },
    ],
    media: '[Clip: MANTA-RAY moving an egg in circles]',
    image: '/media/manta-ray-robosoft25.mp4',
    bibtex: `@INPROCEEDINGS{11020841,
  author={Ingle, Pratik and Støy, Kasper and Faiña, Andres},
  booktitle={2025 IEEE 8th International Conference on Soft Robotics (RoboSoft)},
  title={Soft Manipulation Surface With Reduced Actuator Density For Heterogeneous Object Manipulation},
  year={2025},
  volume={},
  number={},
  pages={1-8},
  keywords={Meters;Hands;Actuators;Shape;Robot kinematics;Reinforcement learning;Soft robotics;Hardware;Reliability;Grippers;Manipulation;Soft Robot;Surface Manipulation;Robotic Manipulation Surface},
  doi={10.1109/RoboSoft63089.2025.11020841}}`,
  },
  {
    venue: 'ANTS 2024',
    title: 'Moving Depot (MOD): An Efficient Depot Motion Strategy for Multi-Robot Foraging',
    note: '14th International Conference on Swarm Intelligence, Germany',
    links: [],
    media: '[Animation: the depot moving with the swarm]',
    image: '/media/moving-depot.mp4',
    bibtex: false,
  },
];
