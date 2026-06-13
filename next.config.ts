import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native ffmpeg binary and the heavy résumé parsers out of the
  // server bundle — they're loaded at runtime in the candidate evaluator.
  serverExternalPackages: ["ffmpeg-static", "unpdf", "mammoth"],
};

export default nextConfig;
