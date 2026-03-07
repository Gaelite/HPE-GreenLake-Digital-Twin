import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: [
          "/dashboard",
          "/fleet",
          "/map",
          "/insights",
          "/alerts",
          "/command-center",
          "/profile",
          "/simulation",
          "/admin",
          "/api",
          "/auth",
        ],
        allow: ["/login", "/signup"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000"}/sitemap.xml`,
  };
}
