# 🍳 The Family Cookbook

A personal recipe catalog engine built with React + Vite, deployable to Vercel.

## Features

- **Recipe catalog** — browse, search, filter by tags
- **AI recipe import** — paste a URL or recipe text, Claude parses it automatically
- **Shopping list** — select recipes, ingredients auto-combine, check off as you shop
- **Meal planner** — assign recipes to days, generate a weekly shopping list
- **Servings scaler** — adjust portions, ingredients scale automatically
- **Cook tracking** — log when you cook, add post-cook notes
- **Side & drink pairings** — curated suggestions per recipe

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub

```bash
cd family-cookbook
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on [github.com](https://github.com/new) (call it `family-cookbook`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/family-cookbook.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `family-cookbook` repo
4. Framework preset: **Vite** (should auto-detect)
5. Click **Deploy**

Your app will be live at `https://family-cookbook-XXXX.vercel.app` in about 60 seconds.

### 3. Enable AI Recipe Import (optional)

The AI import feature uses the Anthropic API. To enable it:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. In your Vercel dashboard, go to **Settings → Environment Variables**
3. Add: `ANTHROPIC_API_KEY` = `your-api-key-here`
4. Redeploy (Vercel → Deployments → click the three dots → Redeploy)

Without this key, everything works except the 🤖 Import button. You can still add recipes manually.

### 4. Share with your wife

Send her the Vercel URL. Done!

**Note:** Since this version uses browser localStorage, your recipes and her recipes are stored separately in each browser. If you want shared/synced data, the next step would be adding Firebase or Supabase as a backend database.

## Local Development

```bash
npm install
npm run dev
```

To test the AI import locally, create a `.env.local` file:

```
ANTHROPIC_API_KEY=your-key-here
```

Then run `npx vercel dev` instead of `npm run dev` to enable the serverless API routes locally.
