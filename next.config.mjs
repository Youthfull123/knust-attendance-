export default {
  serverExternalPackages: ['pdfkit', 'pg'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (c) => {
    c.resolve.fallback = { ...c.resolve.fallback, fs: false, path: false, encoding: false };
    return c;
  },
};
