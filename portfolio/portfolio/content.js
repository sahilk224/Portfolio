/* ============================================================
   EDIT EVERYTHING HERE. All text, links and images come from this file.
   image: path or URL ("images/me.jpg").  video: .mp4 path (muted loop).
   Leave image/video empty to show a soft gradient placeholder.
   Text supports [link text](https://url) and **bold**.
   ============================================================ */
window.SITE = {
  /* EDITOR LOGIN (for your own domain). Leave empty to edit only on this computer.
     See README.md > "Turn on the editor" for the 5-minute Supabase setup. */
  backend: {
    supabaseUrl: "https://wilwnluyjfeizsdivxch.supabase.co",              // e.g. "https://abcd1234.supabase.co"
    supabaseAnonKey: "sb_publishable_ObnCZJOpdUx3dSVfz_IGoA_3JBikxlY",          // Project settings > API > anon public key
    editors: ["sahilnaangi225@gmail.com"]                   // Google emails allowed to edit, e.g. ["you@gmail.com"]
  },

  name: "your name",
  initials: "YN",                 // shown in the stamp logo
  logo: "",                       // or a path to your own logo image (square)
  email: "hello@yourdomain.com",
  city: "Your City",
  timezone: "Asia/Kolkata",       // footer clock (any IANA time zone)
  bornYear: "b. 2000",
  domain: "yourdomain.com",       // shown on the Design System page (click the logo)            // shown next to your name on the Art page

  // Tagline under your name, per page (two lines each)
  tagline: {
    work: ["Designing tools for people & creativity.",
           "Currently at [Company A](https://example.com). Previously [Company B](https://example.com), [Company C](https://example.com), & [Company D](https://example.com)."],
    art: ["Currently based in Your City.", "Occasionally, Somewhere Else."],
    about: ["Product, design, <dev>,", "& everything in between."]
  },

  socials: [
    { icon: "linkedin", href: "https://www.linkedin.com/" },
    { icon: "x", href: "https://x.com/" },
    { icon: "instagram", href: "https://www.instagram.com/" },
    { icon: "spark", href: "https://lu.ma/" },
    { icon: "github", href: "https://github.com/" }
  ],
  credit: "Built with care & [a lot of coffee](https://example.com).",
  changelog: { label: "Changelog: 11-05-26", href: "#" },

  /* ---------------- WORK ---------------- */
  /* Each project opens when clicked. type:
       "case"  -> full case-study window (header, facts, hero, then blocks)
       "side"  -> side-project window (title, stack grid, big preview, extra images)
       "embed" -> live demo window: embed = URL of your app/site (shown in a frame) + info button
       "link"  -> just opens href in a new tab
     Each one gets its own address: #p-<slug>  (and #p-<slug>-full when expanded). */
  projects: [
    { slug: "company-a", type: "case", title: "Company A", year: "2025", description: "Designing new features to drive engagement and delight.", image: "", hue: 265,
      logo: "", facts: [["Year", "2025"], ["Role", "Product Design"], ["Org", "Team name"], ["With", "Teammate One\nTeammate Two"]],
      blocks: [
        { type: "mission", label: "The Mission", statement: "One sentence on what you set out to do and why it mattered.", body: ["A paragraph of context: the problem, who it was for, and what made it hard.", "A second paragraph about your approach and what changed because of it."] },
        { type: "divider" },
        { type: "feature", label: "Highlight", title: "A result you're proud of", subtitle: "A one-line detail, like a number or an award", image: "", tilt: true,
          sideLabel: "Team", people: [{ name: "Teammate One", href: "#" }, { name: "Teammate Two", href: "#" }],
          body: ["Tell the story of this part of the project.", "What you did, what you learned, and how it turned out."] },
        { type: "callout", emoji: "🔒", text: "Some of this work is confidential.", sub: "Happy to walk through it, [email me](mailto:hello@yourdomain.com)." },
        { type: "gallery", images: [{}, {}, {}, {}], caption: "A caption for these photos" }
      ] },
    { slug: "company-b", type: "case", title: "Company B", year: "2024", description: "Reimagining social experiences and communication.", image: "", hue: 230,
      facts: [["Year", "2024"], ["Role", "Product Design Intern"], ["Org", "Team name"], ["With", "Teammate"]],
      blocks: [
        { type: "mission", label: "The Mission", statement: "What this project was about, in one sentence.", body: ["Context paragraph.", "Approach paragraph."] },
        { type: "image", image: "", caption: "A wide image with a caption", ratio: 1.85 },
        { type: "text", label: "Process", title: "How you got there", body: ["Describe your process, research, iterations and decisions."] }
      ] },
    { slug: "company-c", type: "case", title: "Company C", year: "2023", description: "Product strategy to grow a new audience.", image: "", hue: 15,
      facts: [["Year", "2023"], ["Role", "Strategy"], ["Org", "Team name"], ["With", "Teammate"]],
      blocks: [{ type: "mission", label: "The Mission", statement: "What this project was about.", body: ["Context paragraph."] }] },
    { slug: "company-d", type: "case", title: "Company D", year: "2023-24", description: "Designing ambitious things with an in-house design lab.", image: "", hue: 200,
      facts: [["Year", "2023-24"], ["Role", "Designer"], ["Org", "Lab name"], ["With", "Teammate"]],
      blocks: [{ type: "mission", label: "The Mission", statement: "What this project was about.", body: ["Context paragraph."] }] },
    { slug: "side-one", type: "side", title: "Side Project One", year: "2026", description: "A new site for a community you help run.", image: "", hue: 300,
      site: "https://example.com", viewOn: { label: "View on", icon: "x", href: "https://x.com/" },
      stack: [["UI & Motion", ["Tailwind CSS", "Motion"]], ["Frontend", ["Next.js", "React", "TypeScript"]], ["Data", ["Supabase"]], ["AI", ["Cursor"]]],
      preview: { image: "", ratio: 1.5 }, more: [{ image: "", ratio: 1.5 }] },
    { slug: "side-two", type: "embed", title: "Side Project Two", year: "2025", description: "A small interactive tool you built.", image: "", hue: 160,
      embed: "", viewOn: { label: "View on", icon: "x", href: "https://x.com/" },
      stack: [["Design", ["Figma"]], ["Frontend", ["TypeScript", "React", "Vite"]], ["Styling", ["Tailwind CSS"]], ["AI", ["Cursor"]]], preview: { image: "" } },
    { slug: "side-three", type: "embed", title: "Side Project Three", year: "2025", description: "Another experiment.", image: "", hue: 40,
      embed: "", stack: [["Design", ["Figma"]], ["Frontend", ["React"]]], preview: { image: "" } },
    { slug: "side-four", type: "side", title: "Side Project Four", year: "2025", description: "A personal project.", image: "", hue: 340,
      site: "https://example.com", stack: [["Frontend", ["React"]], ["Data", ["Local storage"]]], preview: { image: "" } },
    { slug: "side-five", type: "embed", title: "Side Project Five", year: "2025", description: "A playful web toy.", image: "", hue: 120, embed: "", stack: [["Frontend", ["Canvas"]]], preview: { image: "" } },
    { slug: "side-six", type: "link", title: "Side Project Six", year: "2026", description: "Opens straight in a new tab.", href: "https://example.com", image: "", hue: 190 }
  ],

  /* ---------------- ART ---------------- */
  // Each group shows in the left menu; each child is a section on the page.
  artGroups: [
    { label: "Fine Art", children: [
      { key: "painting", label: "Painting", link: { label: "3D Gallery", href: "#" } },
      { key: "conceptual", label: "Conceptual" },
      { key: "graphite", label: "Graphite" }
    ]},
    { label: "Sketchbook", children: [
      { key: "sketch-1", label: "Series One" },
      { key: "sketch-2", label: "Series Two" }
    ]},
    { label: "Murals", children: [
      { key: "mural-1", label: "Wall One" }
    ]}
  ],
  artworks: [
    { cat: "painting", title: "Untitled I", medium: "Oil on Canvas, 30\" x 40\"", year: "2025", image: "", ratio: 0.76, hue: 20 },
    { cat: "painting", title: "Untitled II", medium: "Oil on Canvas, 30\" x 40\"", year: "2024", image: "", ratio: 0.76, hue: 45 },
    { cat: "painting", title: "Untitled III", medium: "Oil on Canvas, 20\" x 16\"", year: "2021", image: "", ratio: 0.8, hue: 350 },
    { cat: "painting", title: "Untitled IV", medium: "Oil on Canvas, 30\" x 40\"", year: "2025", image: "", ratio: 0.76, hue: 10 },
    { cat: "painting", title: "Untitled V", medium: "Oil on Canvas, 24\" x 18\"", year: "2022", image: "", ratio: 0.75, hue: 330 },
    { cat: "painting", title: "Untitled VI", medium: "Oil on Canvas, 20\" x 16\"", year: "2021", image: "", ratio: 0.8, hue: 35 },
    { cat: "conceptual", title: "Concept I", medium: "Mixed media", year: "2023", image: "", ratio: 1, hue: 260 },
    { cat: "conceptual", title: "Concept II", medium: "Mixed media", year: "2022", image: "", ratio: 0.8, hue: 280 },
    { cat: "conceptual", title: "Concept III", medium: "Mixed media", year: "2022", image: "", ratio: 1.25, hue: 300 },
    { cat: "graphite", title: "Study I", medium: "Graphite on paper", year: "2020", image: "", ratio: 0.77, gray: true },
    { cat: "graphite", title: "Study II", medium: "Graphite on paper", year: "2019", image: "", ratio: 0.77, gray: true },
    { cat: "graphite", title: "Study III", medium: "Graphite on paper", year: "2019", image: "", ratio: 1.3, gray: true },
    { cat: "sketch-1", title: "Page 1", medium: "Ink", year: "2025", image: "", ratio: 0.7, hue: 50 },
    { cat: "sketch-1", title: "Page 2", medium: "Ink", year: "2025", image: "", ratio: 0.7, hue: 60 },
    { cat: "sketch-1", title: "Page 3", medium: "Ink", year: "2025", image: "", ratio: 0.7, hue: 70 },
    { cat: "sketch-2", title: "Page 4", medium: "Watercolour", year: "2024", image: "", ratio: 1.4, hue: 190 },
    { cat: "sketch-2", title: "Page 5", medium: "Watercolour", year: "2024", image: "", ratio: 1.4, hue: 210 },
    { cat: "mural-1", title: "Wall One", medium: "Acrylic, 10' x 20'", year: "2022", image: "", ratio: 1.6, hue: 180 }
  ],

  /* ---------------- ABOUT ---------------- */
  hi: {
    heading: "Hi, I'm Your Name!",
    photo: "", photoCaption: "A caption for your photo, with a [link](https://example.com).",
    meta: [{ icon: "pin", text: "Your City" }, { icon: "cap", text: "Your Degree, Your School" }],
    paragraphs: [
      "Write a couple of sentences about what you love and the kind of work you do.",
      "Add a second paragraph about how you think about your craft, with **one bold idea** if you like.",
      "3 words to describe me: Something Fun Here"
    ]
  },
  experience: [
    { org: "Company A", years: "2026 - Present", logo: "", hue: 330 },
    { org: "Your Studio", sub: "Clients include [Client 1](#), [Client 2](#), & [Client 3](#).", years: "2023 - 26", logo: "", hue: 5 },
    { org: "Company B", years: "2025", logo: "", gray: true },
    { org: "Company C", years: "2024", logo: "", hue: 220 },
    { org: "Company D", years: "2023-24", logo: "", hue: 210 }
  ],
  communitiesTitle: "My Communities",
  communitiesSub: "The people who make it all worth it",
  // shape: "tall" (portrait) or "wide" (landscape) for each photo
  communities: [
    { name: "Community One", link: "#", logo: "", desc: "I help lead events & partnerships for this community. Describe what it is and what you've done together.",
      photos: [{ caption: "First event", shape: "tall" }, { caption: "Speaker panel", shape: "wide" }, { caption: "Our launch, with friends", shape: "wide" }, { caption: "Collab night", shape: "wide" }] },
    { name: "Community Two", link: "#", logo: "", desc: "I help curate events for founders & creatives. Describe the group here.",
      photos: [{ caption: "Game night", shape: "wide" }, { caption: "Launch party", shape: "tall" }, { caption: "Beautiful venue", shape: "wide" }, { caption: "Builders & creatives", shape: "tall" }] },
    { name: "Community Three", link: "#", logo: "", desc: "I host a coworking session for creatives. A sentence or two about it.",
      photos: [{ caption: "Coworking", shape: "tall" }, { caption: "Builders & artists", shape: "wide" }, { caption: "Favourite tradition", shape: "tall" }, { caption: "Pop-up day", shape: "tall" }] }
  ],
  // Older communities, hidden under a collapsible "Archive"
  archive: [
    { name: "Old Club", link: "#", logo: "", desc: "A community you were part of before.",
      photos: [{ caption: "Workshop", shape: "wide" }, { caption: "Team", shape: "tall" }, { caption: "Demo day", shape: "wide" }, { caption: "Retreat", shape: "tall" }] }
  ],
  quotesTitle: "My Favorite Quotes",
  quotesSub: "a.k.a. my design & life philosophy",
  quotes: [
    { emoji: "💌", title: "A short principle.", text: "The quote that goes with it.", author: "Who said it" },
    { emoji: "🌓", title: "Another principle.", text: "A slightly longer quote that wraps onto a second line so you can see how it looks.", author: "Who said it" },
    { emoji: "📍", title: "A third one.", text: "Keep these short and personal.", author: "Who said it" },
    { emoji: "💧", title: "And a fourth.", text: "Four cards fill the 2 x 2 grid.", author: "Who said it" }
  ],
  shelfTitle: "Shelf",
  shelfSub: "★ - Favorites",
  // Each shelf row has filter pills; each pill shows up to 5 covers.
  shelves: [
    { name: "Books", shape: "book", link: { label: "Goodreads", href: "https://www.goodreads.com/" },
      filters: [
        { label: "★ Books", items: ["Book One", "Book Two", "Book Three", "Book Four", "Book Five"] },
        { label: "2026", items: ["New One", "New Two", "New Three"] },
        { label: "2025", items: ["Read One", "Read Two", "Read Three", "Read Four"] }
      ] },
    { name: "Music", shape: "square", link: { label: "Spotify", href: "https://open.spotify.com/" },
      filters: [
        { label: "★ Music", items: ["Album One", "Album Two", "Album Three", "Album Four", "Album Five"] },
        { label: "2026", items: ["Album Six", "Album Seven"] }
      ] },
    { name: "Movies", shape: "book", link: { label: "Letterboxd", href: "https://letterboxd.com/" },
      filters: [
        { label: "★ Movies", items: ["Film One", "Film Two", "Film Three", "Film Four", "Film Five"] },
        { label: "2026", items: ["Film Six", "Film Seven", "Film Eight"] }
      ] }
  ],
  // To use real covers, replace a title string with { title: "Name", image: "images/cover.jpg" }
  loreTitle: "Lore",
  loreSub: "Fun snippets from past lives",
  lore: [
    { title: "Something you wrote", year: "2025", desc: "A line about it.", href: "#", image: "", hue: 260 },
    { title: "Something you made", year: "2024", desc: "A line about it.", href: "#", image: "", hue: 120 },
    { title: "A design you did", year: "2021-2022", desc: "A line about it.", href: "#", image: "", hue: 30 },
    { title: "An old project", year: "2022", desc: "A line about it.", href: "#", image: "", hue: 190 },
    { title: "A thing you sold", year: "est. 2019", desc: "A line about it.", href: "#", image: "", hue: 220 },
    { title: "A small business", year: "est. 2018", desc: "A line about it.", href: "#", image: "", gray: true }
  ]
};
