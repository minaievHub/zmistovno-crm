import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "teleproto"],
  poweredByHeader: false,
  devIndicators: false,
  distDir:
    process.env.CRM_TEST_MODE === "1" && process.env.NODE_ENV !== "production"
      ? ".next-test"
      : ".next",
};
export default config;
