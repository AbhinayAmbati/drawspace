import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fabric.js uses node-canvas as optional peer dep. Exclude it from server bundle.
  serverExternalPackages: ["canvas"],

  // Image optimization for user-uploaded images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Turbopack is default in dev; no special config needed
};

export default nextConfig;
