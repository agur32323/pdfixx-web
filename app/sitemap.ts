import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://pdfixx-web.vercel.app",
      lastModified: new Date(),
    },
  ];
}