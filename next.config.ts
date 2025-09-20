import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'thumbnail.image.rakuten.co.jp',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'item-shopping.c.yimg.jp',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shopping.c.yimg.jp',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'item-shopping.c.yimg.jp',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
