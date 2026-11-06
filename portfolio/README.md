# Your portfolio

Plain HTML/CSS/JS, no build step. Pages are #work, #art, #about, projects open at #p-<name>, the logo opens #design-system.

## Editing (no code)
Go to **yoursite.com/#login**, sign in, and pencil buttons appear on every section:
profile & intro lines, each project (thumbnail, title, case study sections, links, type), art, intro/bio,
experience, communities & photos, quotes, shelf, lore, contact & social links.
The bottom bar has **Preview** (hide pencils), save status, and **Sign out**.
In lists: eye = hide without deleting, arrows = reorder, bin = delete, "+ Add" = new item.

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
   and put your email in `editors`. Deploy. Visit /#login.

## Files
- content.js: the starting content (the editor saves over it).
- styles.css / app.js: the site. editor.css / editor.js: the editor.
- Images: when using the editor they're uploaded for you. Without it, put them in images/ and reference "images/name.jpg".
