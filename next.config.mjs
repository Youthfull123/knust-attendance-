export default {
  serverExternalPackages: ['pdfkit', 'pg'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (c) => {
    c.resolve.fallback = { ...c.resolve.fallback, fs: false, path: false, encoding: false };
    c.ignoreWarnings = [...(c.ignoreWarnings || []), { module: /face-api\.esm\.js/ }];
    return c;
  },
};
