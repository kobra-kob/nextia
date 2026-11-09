import type { NextConfig } from "next";

// Application de gestion entièrement dynamique (session, données par client) :
// on garde le rendu dynamique classique, sans Cache Components.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
