/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

module.exports = nextConfig;
