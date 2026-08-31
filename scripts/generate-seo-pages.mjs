import { mkdir, readFile, writeFile } from "node:fs/promises";

const siteUrl = "https://mebataro.web.app";
const siteName = "Mebae's Kitchen";
const endpoint =
  "https://firestore.googleapis.com/v1/projects/mebataro/databases/(default)/documents/recipes?pageSize=200";

function valueOf(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value)
    return (value.arrayValue.values || []).map(valueOf);
  return undefined;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setMeta(html, attribute, name, content) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(<meta\\s+${attribute}="${escaped}"\\s+content=")[^"]*("\\s*/?>)`,
  );
  return html.replace(pattern, `$1${escapeHtml(content)}$2`);
}

function duration(value) {
  const hours = Number(value.match(/(\d+)\s*時間/)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*分/)?.[1] || 0);
  return hours || minutes
    ? `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}`
    : undefined;
}

function baseSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: siteName,
      alternateName: "芽生のレシピノート",
      inLanguage: "ja",
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": `${siteUrl}/#mebae`,
      name: "芽生",
      alternateName: "Mebae",
      url: `${siteUrl}/`,
    },
  ];
}

function setJsonLd(html, schemas) {
  const json = JSON.stringify(schemas).replaceAll("<", "\\u003c");
  return html.replace(
    /<script id="seo-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script id="seo-jsonld" type="application/ld+json">${json}</script>`,
  );
}

const response = await fetch(endpoint);
if (!response.ok) throw new Error(`Firestore ${response.status}`);
const data = await response.json();
const recipes = (data.documents || []).map((document) => ({
  id: document.name.split("/").at(-1),
  title: valueOf(document.fields.title) || "レシピ",
  category: valueOf(document.fields.category) || "料理",
  time: valueOf(document.fields.time) || "",
  servings: valueOf(document.fields.servings) || "",
  ingredients: valueOf(document.fields.ingredients) || [],
  steps: valueOf(document.fields.steps) || [],
  imageUrl: valueOf(document.fields.imageUrl) || "",
}));

let indexHtml = await readFile("dist/index.html", "utf8");
const homeDescription = `芽生のお気に入り料理${recipes.length}品を、写真・材料・作り方とともにまとめたレシピノート。料理名や複数の材料から検索できます。`;
indexHtml = setMeta(indexHtml, "name", "description", homeDescription);
indexHtml = setMeta(indexHtml, "property", "og:description", homeDescription);
indexHtml = setJsonLd(indexHtml, [
  ...baseSchemas(),
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/#recipes`,
    url: `${siteUrl}/`,
    name: "芽生のレシピ一覧",
    description: homeDescription,
    inLanguage: "ja",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: recipes.length,
      itemListElement: recipes.map((recipe, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: recipe.title,
        url: `${siteUrl}/recipes/${encodeURIComponent(recipe.id)}`,
      })),
    },
  },
]);
await writeFile("dist/index.html", indexHtml);

await mkdir("dist/recipes", { recursive: true });
for (const recipe of recipes) {
  const url = `${siteUrl}/recipes/${encodeURIComponent(recipe.id)}`;
  const title = `${recipe.title}のレシピ | ${siteName}`;
  const description = `${recipe.title}の材料と作り方。${recipe.ingredients
    .slice(0, 5)
    .join("、")}などを使った芽生のレシピです。`.slice(0, 155);
  const recipeDuration = duration(recipe.time);
  const recipeSchema = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "@id": `${url}#recipe`,
    mainEntityOfPage: url,
    name: recipe.title,
    description,
    ...(recipe.imageUrl ? { image: [recipe.imageUrl] } : {}),
    author: { "@id": `${siteUrl}/#mebae` },
    recipeCategory: recipe.category,
    recipeYield: recipe.servings,
    ...(recipeDuration ? { totalTime: recipeDuration } : {}),
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text,
    })),
    inLanguage: "ja",
  };
  let html = indexHtml.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(title)}</title>`,
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = html.replace(
    /<link rel="alternate" hreflang="ja" href="[^"]*"\s*\/>/,
    `<link rel="alternate" hreflang="ja" href="${url}" />`,
  );
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:type", "article");
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:image", recipe.imageUrl);
  html = setMeta(html, "property", "og:image:alt", `${recipe.title}の完成写真`);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = setMeta(html, "name", "twitter:image", recipe.imageUrl);
  html = html.replace(
    /\s*<meta property="og:image:(?:width|height)"[^>]*>/g,
    "",
  );
  html = setJsonLd(html, [
    ...baseSchemas(),
    recipeSchema,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "レシピ一覧",
          item: `${siteUrl}/`,
        },
        { "@type": "ListItem", position: 2, name: recipe.title, item: url },
      ],
    },
  ]);
  await writeFile(`dist/recipes/${encodeURIComponent(recipe.id)}.html`, html);
}

console.log(`Generated ${recipes.length} recipe SEO pages.`);
