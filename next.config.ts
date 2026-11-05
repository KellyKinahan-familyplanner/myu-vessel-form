import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/submit": ["./node_modules/@fontsource/rubik/files/rubik-latin-400-normal.woff", "./node_modules/@fontsource/rubik/files/rubik-latin-700-normal.woff", "./public/myu-logo-horizontal.jpg"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
