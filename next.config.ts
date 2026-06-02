import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // three.js ships ESM but some examples/jsm subpaths benefit from being
  // transpiled through Next's pipeline so they resolve consistently under
  // both the dev server and a production worker build.
  transpilePackages: ['three'],
  // The planet is a heavy WebGL client island; React StrictMode double-invokes
  // effects in dev. The canvas mount has a full dispose() teardown so this is
  // safe and surfaces any leak early. Leave it on.
  reactStrictMode: true,
};

export default nextConfig;
