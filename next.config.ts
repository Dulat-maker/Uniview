import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pre-computed demo data (scripts/seed.mjs) is read with fs at runtime, which the file tracer
  // can't see, so bundle it into every API function explicitly (needed on Vercel).
  outputFileTracingIncludes: {
    "/api/**": ["./data/seed/**/*"],
  },
  images: {
    // `search` is omitted so sizing params (?w=…, ?width=…) are allowed.
    remotePatterns: [
      // Stock photos used in the landing page mock-up.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      // Real university photos and logos (rendered with `unoptimized`, straight from Wikimedia).
      { protocol: "https", hostname: "commons.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "thumb.wikimedia.org", pathname: "/**" },
    ],
  },
};

export default nextConfig;
