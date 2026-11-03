/** @type {import('next').NextConfig} */

const nextConfig = {
  // The pre-push hook sets NEXT_DIST_DIR so its production build does not
  // overwrite the .next folder a running `npm run dev` is serving from.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  redirects: async () => {
    return [
      {
        // The console has no landing page of its own; the overview is home.
        // Temporary rather than permanent, so a browser never caches a stale
        // destination if this ever moves again.
        source: "/",
        destination: "/overview",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
