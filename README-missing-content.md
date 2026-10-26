# Missing content: fill in and hand back

Everything the site still shows as a placeholder or needs a decision on. Fill in what you have, save the file, and tell me it's ready; I'll plug the values in and rebuild. Entries you've already filled in are on the site and have been removed from this list.

**How to fill it in**

- Type or paste after each **→**.
- Leave a line blank to keep the current placeholder. Write `none` to remove that element (for example a link you don't want).
- **Pictures, GIFs and videos:** drop the file into `public/media/` and write its file name after the arrow (e.g. `→ tactile-grasp.gif`). A web link to an image or video works too. Any of JPG, PNG, HEIC, GIF, MP4 or WebM is fine; I'll crop, compress and convert, and move the full-size original to `media-originals/` so it isn't published.
- **Shapes:** each section says which shape the box is (4:3, 16:10, square…). Close is fine; I'll crop.
- **Short on time?** For any write-up you can just paste a link (repo README, paper, post) and I'll draft the text from it for you to check.

**At a glance**

| Area | Still missing |
| --- | --- |
| Decisions | 7 quick choices (section 1) |
| Work | 2 links, write-ups for 3 projects; optional: a sharper W1 video, real media for the generated figures |
| Publications | 3 preprint links, 3 BibTeX entries |
| Writing | optional: more posts, your own covers for the 2 generated ones |
| Life | optional: your own book takes, 1 sharper cover |
| Home and profile | 2 optional items |

---

## 1. Decisions

**D1. Deployment to pratik-ingle.github.io.** Option 1: one repo, Quarto renders the posts at their current URLs (recommended). Option 2: same, but you run `quarto render` yourself. Option 3: blog moves to its own repo at `/blog/`, post URLs change.
→

**D2. Old site's project pages** (Moving Depot, UVC disinfection drone, decision-making in collectives, quantum influencer agents, robotic boats, the COVID quantum classifier, optical radiation pressure springs, your Master's thesis). Bring them over as they are / add some as projects on the Work page (say which) / drop them.
→

**D3. Writing's "Machine learning" tab is empty.** Hide empty tabs / keep it / retag a post (say which) as Machine learning.
→

**D4. Thesis defence (January 2027)** no longer appears on the home page. Add a line to the bio / leave it out.
→

**D5. Post title.** The site lists "Universal Coding Language"; on your blog it's "The Last Programming Language Won't Be for Humans". Keep / use the blog title.
→

**D6. "Video ↗" YouTube links** on the CASE 2025 and RoboSoft 2025 papers, and the one I added to In-hand tactile perception. Keep / remove.
→

**D7. CASE 2025 arXiv link** (`arxiv.org/abs/2507.14967`, listed on the MANTA-RAY page). Add it next to the DOI / leave it out.
→

---

## 2. Work page: projects

Pictures show at **4:3** on the Work card and **16:9** on the project's own page. Write-ups appear on the project page under the headings shown; plain sentences are fine and Markdown works (lists, links, `**bold**`).

Every project now has a picture. Six of them are figures I generated because their repos had no images: W2, W5, W7, W9, W10 and W12. The charts use the numbers in your READMEs and the diagrams follow your README or CV. Whenever you have a real screenshot or recording for one of them, write it here and I'll swap it in:

- Real media for a generated figure (say which project) →

### W1. In-hand tactile perception

Now shows a clip from your YouTube video, but YouTube only allowed a 640 px copy, so it's soft on the project page. Links: Code (LEAP repo) and Video (YouTube).

- Original video file, for a sharper clip (optional) →
- Different code link? (blank keeps the LEAP repo) →
- Write-up · **Overview** →
- Write-up · **Approach** →
- Write-up · **Results** →

### W2. Human-to-robot hand retargeting

Shows a generated diagram of the webcam-to-LEAP retargeting pipeline. Link is the same LEAP repo as W1.

- Different code link? (blank keeps the LEAP repo) →
- Write-up · **Overview** →
- Write-up · **Approach** →
- Write-up · **Results** →

### W6. JEPA from first principles

Now shows a screenshot of the live demo. Only the "Demo ↗" link is set.

- Also link the code repo `github.com/pratik-ingle/jepa-visualization`? (yes / no) →

### W8. Time Weaver

Shows the landing-page screenshot.

- Better picture, e.g. the assistant answering a question? (blank keeps the screenshot) →

### W11. Warehouse layout optimisation

No link, so the card says "Details →".

- Link, if any (repo, thesis, old project page) →

### W13. Space data-center simulator

Shows a clip of the live OrbitalDC Studio app. Code link is set.

- Also link the live app `pratik-ingle.github.io/Space-data-centers` as "Demo ↗"? (yes / no) →
- Write-up · **Overview** →
- Write-up · **How it works** →
- Write-up · **Results** →

---

## 3. Publications page

Pictures show at **16:10**. Short muted clips work well here, like the MANTA-RAY videos.

### P1. Joint-Embedding Predictive Pretraining for Tactile Shape Recognition… (Manuscript · IEEE RA-L)

Shows an 11-second loop from your explainer video (the object being recognised while the membrane moves it); link reads "Preprint soon" and goes nowhere.

- Preprint link (or blank to keep "Preprint soon") →
- BibTeX (or `none` to hide until it's out) →

### P2. Suspended-Fabric Robotic Manipulation Surfaces… (IEEE ICRA 2027 · under review)

Shows your poster; **"Preprint ↗" goes nowhere.**

- Preprint link (or `none`) →
- BibTeX (or `none`) →

### P3. Survey of Robotic Manipulation Surfaces… (IJRR · under review)

Shows a cover I generated from the paper: the eight families of actuated surfaces it reviews. The manuscript PDF is kept private in `media-originals/publications/`. **"Preprint ↗" goes nowhere**; write `none` to hide it until the paper is public.

- Preprint link (or `none`) →
- BibTeX (or `none`) →

---

## 4. Writing page

Covers show at **16:10**.

Every post has a cover. Universal Coding Language and Simulating a Tactile Sensor in MuJoCo use covers I generated from the posts' content, since the posts have no images. To use your own instead, write it here (say which post):

- Replacement cover →

### B3. More posts to list (optional)

One link per line; I'll pull the title, date and summary from each page.

→

---

## 5. Life page

### L6. Reading shelf

Each book has a short summary, and books you're reading now come first. To swap in your own take for any book, write it here (say which book):

- Your own take →
- The Creative Act's cover is low-resolution (Open Library had no larger scan). A sharper image (optional) →

---

## 6. Home page and profile (optional)

**H2. More profiles.** Your old site also links Twitter (`twitter.com/PratikIngle_`) and Mastodon (`ecoevo.social/@Pratik`). Add them next to Scholar, GitHub, LinkedIn and Email? (yes / no / which)
→

**H3. Contact email.** The "Contact" button and Email link use `pratik.ingle135@gmail.com`. Switch to `prin@itu.dk`?
→
