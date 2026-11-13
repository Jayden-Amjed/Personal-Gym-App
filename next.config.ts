import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext inspects multipart POSTs before route-handler dispatch. Permit the
  // photo endpoint's bounded envelope; it enforces 4 MB per JPEG and 9 MB total.
  experimental: { serverActions: { bodySizeLimit: 9_000_000 } },
};

export default nextConfig;
