# 11+ Succeed Vocab App

This Next.js app now serves two roles:

- A public homepage for the 11+ Succeed tuition centre at `/`
- The existing student platform underneath it, including the quiz at `/quiz`

The goal is to use this project on a temporary Vercel domain first, then point the main domain away from Wix to this deployment once the new homepage is ready.

## Local development

1. Copy `.env.example` to `.env.local`
2. Fill in the Supabase values
3. Install dependencies with `npm install`
4. Start the app with `npm run dev`

## Environment variables

Required values:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For local work, use:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For Vercel preview deployments, you can set `NEXT_PUBLIC_SITE_URL` to the preview domain if you want canonical metadata to reflect that environment.

For the final production setup, set `NEXT_PUBLIC_SITE_URL` to the main custom domain, for example:

```bash
NEXT_PUBLIC_SITE_URL=https://www.11plussucceed.com
```

## Key routes

- `/` public homepage
- `/quiz` student quiz
- `/login` student login
- `/signup` account creation
- `/words` vocabulary bank
- `/dashboard` authenticated student area

## Homepage assets

The repo currently includes a placeholder hero illustration at [public/home-hero-classroom.svg](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/public/home-hero-classroom.svg).

To match the Wix site more closely later:

1. Add the real logo and hero image files to `public/`
2. Update [components/Header.tsx](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/components/Header.tsx) if you want to swap the text logo for an image
3. Update [app/page.tsx](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/app/page.tsx) to point at the final hero asset

## Vercel deployment

Recommended setup:

1. Import this repo into Vercel as a Next.js project
2. Add the environment variables from `.env.example`
3. Deploy to a temporary Vercel domain first
4. Verify the public homepage at `/`
5. Verify student flows at `/login`, `/quiz`, and `/dashboard`
6. Once approved, connect the main domain and update DNS away from Wix
7. Set `NEXT_PUBLIC_SITE_URL` to the final production domain and redeploy

This repo also includes:

- [vercel.json](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/vercel.json) for basic response headers
- [app/robots.ts](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/app/robots.ts) for `robots.txt`
- [app/sitemap.ts](/Users/ranjanmajumdar/DEV/elevenplus-vocab-app/app/sitemap.ts) for `sitemap.xml`

## Checks

Run:

```bash
npm run lint
```

There are currently existing lint warnings in some unrelated admin and performance-test files, but the homepage and deployment changes introduced here do not add new lint errors.
