# One-time GitHub setup — then no PC is required

The connected GitHub integration can read/edit existing repositories, but cannot create a new repository. Once a new empty private repository exists, connected GitHub tools can contribute directly from future conversations.

1. On github.com/new create **private** repository `pokeflip-studio` under your GitHub account. Do **not** add a README or .gitignore in the GitHub creation form.
2. In a terminal in this source folder, run:

```bash
git init
git branch -M main
git add .
git commit -m "Import PokéFlip Studio source with CI and agent handoff"
git remote add origin https://github.com/YOUR_USERNAME/pokeflip-studio.git
git push -u origin main
```

3. In Vercel, open the existing `pokeflip-studio` project and connect the new GitHub repo in **Settings → Git**, with root directory `/`. Do not accidentally create a second Vercel project.
4. Configure Supabase Auth redirect URL(s) for the final Vercel origin. Run app and cloud smoke tests.

Never commit `.env`, service-role credentials, user backups or camera photos. `.vercel/` is excluded from git; relink a local folder to the existing project if needed.
