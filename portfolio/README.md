# Your portfolio

Plain HTML/CSS/JS, no build step. Pages are #work, #art, #about, projects open at #p-<name>, the logo opens #design-system.

## Editing (no code)
Go to **yoursite.com/login** (or /#login), sign in, and edit right on the page:
- **Text:** click any text and type. Select words for **B**, *I* or a link. Enter adds a new paragraph in long text.
- **Logo:** click it for initials, colour and shape, or upload / paste a logo image.
- **Images & videos:** hover and click **Change media** to upload, or paste a YouTube, Vimeo, Loom, image or MP4 link.
  You can also drag a file straight onto any image. Videos get **Video settings**: pick a frame as the thumbnail
  (or upload one), and turn autoplay, loop, sound and play-on-hover on or off.
- **Lists** (projects, art, experience, photos, quotes, shelf, lore, socials…): hover an item and drag the dots to reorder,
  use the eye to hide it from visitors, the bin to delete, and the dashed **Add** tile to add one.
- **Gear:** settings you can't see on the page (what a project opens, its address and links, art section links, shelf filters, clock time zone…).
- **Case studies:** open one; hover a section for move up / duplicate / delete / drag, and hover between sections for the blue **Add section** line.
- Everything saves on its own (the pill shows Saving… / Saved). **Undo** or ⌘Z / Ctrl+Z undoes. **Preview** shows exactly what visitors see.

Where edits are saved:
- **Published on Claude (the preview link):** saved to the page itself. Only you (the owner) can sign in.
- **Your own domain with Supabase (recommended):** Google sign-in, only the emails you list can edit. Setup below.
- **No backend:** "Edit on this computer" saves in your browser only. Use **Export** to download a new content.js and replace the old one.

## Turn on the editor for your own domain (about 5 minutes, free)
1. Create a project at supabase.com.
2. SQL Editor > paste `supabase/setup.sql`, change `you@gmail.com` to your Google email, Run.
3. Authentication > Sign In / Providers > Google: turn on (follow Supabase's Google steps to get the Client ID/Secret).
4. Authentication > URL Configuration: set Site URL to your domain (e.g. https://yourname.com) and add it to Redirect URLs.
5. Project Settings > API: copy the Project URL and the anon public key into `content.js` > `backend`,
   and put your email in `editors`. Deploy. Visit /login.

## Files
- content.js: the starting content (the editor saves over it).
- styles.css / app.js: the site. editor.css / editor.js: the editor.
- Images: when using the editor they're uploaded for you. Without it, put them in images/ and reference "images/name.jpg".
