Redesign BobbyBuilds in a new bento style: the home page, the journey page and a new page for each journey post.

REFERENCE DESIGNS
I've put the designs in docs/redesign/designs/. They are the source of truth for layout, spacing, type and colour:
- BobbyBuilds_Home_Desktop.png and BobbyBuilds_Home_Mobile.png
- BobbyBuilds_Journey_Desktop.png and BobbyBuilds_Journey_Mobile.png
- BobbyBuilds_Journey_Post_Desktop.png and BobbyBuilds_Journey_Post_Mobile.png
Read all six before you start. Desktop is 1440px wide, mobile is 390px. Match them closely, but use the live data the site already has, not the numbers in the pictures.

Images for the site are in docs/redesign/assets/: profile.png, portfolio-desktop.jpg, rtj-desktop.jpg, rtj-phone-job.jpg, rtj-phone-search.jpg, rtj-clean-ad.jpg, rtj-messy-ad.jpg. Move the ones you use into the project's usual public images folder and optimise them (WebP or AVIF with sizes), keeping the originals out of the build. github-grid.png is only a picture of the existing GitHub activity component: keep using the real, live component.

Start by looking at how the site is built today (pages, components, where projects, numbers and journey entries come from), then plan the changes before editing. Reuse existing data and components wherever you can.

DESIGN LANGUAGE (apply site-wide)
- Fonts: Geist for everything, Geist Mono for small labels, dates and eyebrow text (uppercase, slight letter spacing). Keep the fonts already loaded if they're these.
- Page background: #F4F5F7. Cards: white, 28px radius for large cards, 24px for small ones, a 1px #E6E8EE outline instead of a heavy shadow.
- Ink: #15171C for text and dark cards. Muted text: #5B6170 (secondary) and #4A4F5C (body). Check every grey passes WCAG AA on its background.
- Accent: RealTechJobs blue #1D4ED8 (the RealTechJobs card, the featured journey card and the post header). Light blue text on blue: #9DB4FF.
- Status and type colours (text on tint): Live/Shipped #15803D on #E8F5EC, Building #1D4ED8 on #EEF2FF, Decision #9A3412 on #FFF1E6, Inspired by #6D28D9 on #F3EEFF. These replace the emoji on journey types.
- Headings: weight 800, tight letter spacing (about -0.035em). Numbers use tabular figures.
- Use CSS variables or the project's existing token setup for all of these. No hard-coded colours in components.
- Layout: a max-width 1200px container with 24px side padding, cards in a CSS grid with 16px gaps.

HOME PAGE (BobbyBuilds_Home_*)
A 6-column bento grid:
1. Intro card (4 columns): photo, name, a green "Building RealTechJobs" status pill, the headline "A product designer, building tools in public.", a short intro line, and LinkedIn, X and GitHub links.
2. RealTechJobs card (2 columns, 2 rows tall, blue): "PROJECT 02" label, Live pill, name, one-line pitch, live job and company counts, and a phone screenshot rising from the bottom. The whole card links to realtechjobs.co.uk.
3. Four number tiles in one row: days building, visitors in the last 30 days, running costs this month (with the tools note), revenue this month (dark ink tile). Use the live values the site already calculates.
4. Portfolio card (3 columns) with a screenshot, linking to wahabalikhan.com. Its description must say "Product design case studies, on a site I designed and built with Claude Code."
5. "Now" card (3 columns): what I'm working on this week, with an optional progress bar. Make this easy for me to edit in one place (a small config or content file), and hide the progress bar when there's no value.
6. GitHub activity card (4 columns), using the existing live component.
7. "Latest from the journey" card (2 columns): the 3 newest entries, each linking to its post, plus "See the full journey".
Top nav: Projects, Numbers, Journey, and a dark "Say hello" button (mailto:hello@bobbybuilds.app). Footer as in the design.

JOURNEY PAGE (BobbyBuilds_Journey_*)
- A header card with the "JOURNEY · N ENTRIES" eyebrow, the headline "Everything I've shipped, decided and learned." and the type filters (All, Shipped, Building, Decision, Inspired by, with counts). Keep the existing ?type= filtering working, using real buttons or links with aria-pressed or aria-current for the active one.
- Entries grouped by month, as a 3-column grid of cards. The newest entry with an image is featured: 2 columns by 2 rows, blue, with a screenshot. Other entries are white cards with a type pill, date, title, summary and "Read →". An entry with an image and nothing beside it can use the wide card style shown for June.
- Every card links to that entry's post page.
- A dashed "Next entry" card at the end of the latest month inviting people to follow on X and LinkedIn.
- Rename the June 2026 portfolio entry to "My portfolio, designed in Figma and built with Claude Code".

JOURNEY POST PAGE (new, BobbyBuilds_Journey_Post_*)
- New route for each entry, for example /journey/[slug]. Give every existing entry a stable slug.
- Blue header card: type and project pills, date and reading time, title, summary, and an optional hero image.
- A two-column layout: the article in a large white card (2 columns) and a sidebar (1 column).
- Article: supports headings, paragraphs, a pull quote and a row of buttons at the end (the project link and share links). Add an optional long-form body to the journey entry data (use whatever content format the project already uses, or Markdown if there isn't one). Entries without a body still get a post page showing their summary.
- Sidebar: an optional "The numbers" card (a small list of label and value pairs set per entry), a card for the related project, and "More from the journey" with 3 other entries.
- Previous and next entry links at the bottom, and "← All journey entries" in the header.
- Add the post page's title, description and Open Graph image to its metadata so shared links look good.
- Write the body for "Tech Jobs went company-first" using the text in the design. For the other entries, use their existing text as the summary and leave the body empty for me to write.

RESPONSIVE AND ACCESSIBILITY
- At phone width, every grid becomes one column (number tiles two per row), as in the mobile designs. Scale the big headlines down on mobile (use clamp) so "A product designer, building tools in public." fits in about 4 lines, not 6.
- Real links and buttons only, visible focus states, alt text on every screenshot, and touch targets of at least 44px.
- Respect prefers-reduced-motion. Small touches only: a gentle lift on card hover, numbers counting up once on load, and a pulsing Live dot. All off with reduced motion.

MY STANDING RULES
- No screenshots.
- Don't run tests, builds or browser checks after each change. After changes to styles or config files, just check the dev server still compiles.
- For new or changed interactive features (filters, post links, previous and next), click through them once in a real browser before saying they're done.
- Only run all the checks when I say "commit": typecheck, lint, relevant test suites, and browser checks in Chrome (and Safari when available). Stop if anything fails. Then commit, push and deploy.
- Always wait for my go-ahead before committing, deploying or changing live data.
- Commit messages: one descriptive line, about 6 to 15 words, starting with a verb, saying what changed. No body and no Co-Authored-By line.
- Never change design values to make a test pass. Update the test and tell me.
- Plain UK English in all copy, and no em dashes.

When you're done, give me a short summary of what changed, the new routes, where I edit the "Now" card and post bodies, and anything you couldn't match from the designs.
