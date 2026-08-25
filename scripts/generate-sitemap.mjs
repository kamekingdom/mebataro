import { mkdir, writeFile } from "node:fs/promises";

const siteUrl = "https://mebataro.web.app";
const endpoint =
  "https://firestore.googleapis.com/v1/projects/mebataro/databases/(default)/documents/recipes";

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function updatedDate(document) {
  const value = document.fields?.updatedAt;
  const timestamp = value?.timestampValue || value?.stringValue;
  const date = timestamp ? new Date(timestamp) : null;
  return date && !Number.isNaN(date.valueOf())
    ? date.toISOString().slice(0, 10)
    : undefined;
}

async function getRecipes() {
  const recipes = [];
  let pageToken = "";
  do {
    const url = new URL(endpoint);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Firestore ${response.status}`);
    const data = await response.json();
    recipes.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return recipes;
}

const recipes = await getRecipes();
const today = new Date().toISOString().slice(0, 10);
const urls = [
  `  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod></url>`,
  ...recipes.map((recipe) => {
    const id = recipe.name.split("/").at(-1);
    const lastmod = updatedDate(recipe);
    return `  <url><loc>${escapeXml(`${siteUrl}/recipes/${encodeURIComponent(id)}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
  }),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

await mkdir("public", { recursive: true });
await writeFile("public/sitemap.xml", sitemap);
console.log(`Generated sitemap with ${urls.length} URLs.`);
