import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
const trimmedBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
const normalizedBase = trimmedBase.endsWith("/api") ? trimmedBase : `${trimmedBase}/api`;

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
