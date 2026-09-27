import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Standalone output pour le déploiement Docker sur VPS
  output: "standalone",

  // Build ID déterministe basé sur le commit Git
  generateBuildId: async () => process.env.GIT_COMMIT_HASH ?? "local",

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default nextConfig
