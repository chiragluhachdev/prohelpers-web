import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      /**
       * The marketing site is plain static HTML in `public/site`. Serving it
       * through a rewrite rather than porting it to JSX keeps its stylesheet
       * out of the Next document entirely, so it cannot leak into the admin
       * pages — the two areas share a domain but not a design system.
       *
       * `beforeFiles` so these win over the filesystem route for `/`.
       */
      beforeFiles: [
        { source: "/", destination: "/site/index.html" },
        { source: "/index.html", destination: "/site/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
