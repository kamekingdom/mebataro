const SITE_URL = "https://mebataro.web.app";
const SITE_NAME = "Mebae's Kitchen";
const AUTHOR_ID = `${SITE_URL}/#mebae`;
const DEFAULT_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/mebataro.firebasestorage.app/o/site-assets%2Fog-image.jpg?alt=media";
const DEFAULT_DESCRIPTION =
  "芽生のお気に入り料理を、写真・材料・作り方とともにまとめたレシピノート。料理名や複数の材料からレシピを検索できます。";

type SeoRecipe = {
  id: string;
  title: string;
  category: string;
  time: string;
  servings: string;
  ingredients: string[];
  steps: string[];
  note: string;
  imageUrl?: string;
};

function setMeta(
  selector: string,
  attribute: string,
  value: string,
  content: string,
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.append(element);
  }
  element.content = content;
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  link.href = url;
  const alternate = document.head.querySelector<HTMLLinkElement>(
    'link[rel="alternate"][hreflang="ja"]',
  );
  if (alternate) alternate.href = url;
}

function setJsonLd(data: unknown) {
  let script = document.querySelector<HTMLScriptElement>("#seo-jsonld");
  if (!script) {
    script = document.createElement("script");
    script.id = "seo-jsonld";
    script.type = "application/ld+json";
    document.head.append(script);
  }
  script.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove();
}

function applyMeta({
  title,
  description,
  url,
  image = DEFAULT_IMAGE,
  type = "website",
}: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: "website" | "article";
}) {
  document.title = title;
  setCanonical(url);
  setMeta('meta[name="description"]', "name", "description", description);
  setMeta('meta[property="og:type"]', "property", "og:type", type);
  setMeta('meta[property="og:title"]', "property", "og:title", title);
  setMeta(
    'meta[property="og:description"]',
    "property",
    "og:description",
    description,
  );
  setMeta('meta[property="og:url"]', "property", "og:url", url);
  setMeta('meta[property="og:image"]', "property", "og:image", image);
  setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  setMeta(
    'meta[name="twitter:description"]',
    "name",
    "twitter:description",
    description,
  );
  setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
}

function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": AUTHOR_ID,
    name: "芽生",
    alternateName: "Mebae",
    url: `${SITE_URL}/`,
  };
}

function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    alternateName: "芽生のレシピノート",
    inLanguage: "ja",
    author: { "@id": AUTHOR_ID },
  };
}

function isoDuration(value: string) {
  const hours = Number(value.match(/(\d+)\s*時間/)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*分/)?.[1] || 0);
  if (!hours && !minutes) return undefined;
  return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}`;
}

export function setHomeSeo(recipes: SeoRecipe[]) {
  const title = "芽生のレシピノート | Mebae's Kitchen";
  const description = recipes.length
    ? `芽生のお気に入り料理${recipes.length}品を、写真・材料・作り方とともにまとめたレシピノート。料理名や複数の材料から検索できます。`
    : DEFAULT_DESCRIPTION;
  applyMeta({ title, description, url: `${SITE_URL}/` });
  setMeta(
    'meta[property="og:image:alt"]',
    "property",
    "og:image:alt",
    "Mebae's Kitchenのメインページ",
  );
  setMeta(
    'meta[property="og:image:width"]',
    "property",
    "og:image:width",
    "1200",
  );
  setMeta(
    'meta[property="og:image:height"]',
    "property",
    "og:image:height",
    "630",
  );
  setMeta(
    'meta[name="robots"]',
    "name",
    "robots",
    "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  );
  setJsonLd([
    websiteSchema(),
    personSchema(),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/#recipes`,
      url: `${SITE_URL}/`,
      name: "芽生のレシピ一覧",
      description,
      inLanguage: "ja",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: recipes.length,
        itemListElement: recipes.map((recipe, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: recipe.title,
          url: `${SITE_URL}/recipes/${encodeURIComponent(recipe.id)}`,
        })),
      },
    },
  ]);
}

export function setRecipeSeo(recipe: SeoRecipe) {
  const url = `${SITE_URL}/recipes/${encodeURIComponent(recipe.id)}`;
  const description = `${recipe.title}の材料と作り方。${recipe.ingredients
    .slice(0, 5)
    .join("、")}などを使った芽生のレシピです。`.slice(0, 155);
  const title = `${recipe.title}のレシピ | Mebae's Kitchen`;
  applyMeta({
    title,
    description,
    url,
    image: recipe.imageUrl || DEFAULT_IMAGE,
    type: "article",
  });
  setMeta(
    'meta[property="og:image:alt"]',
    "property",
    "og:image:alt",
    `${recipe.title}の完成写真`,
  );
  removeMeta('meta[property="og:image:width"]');
  removeMeta('meta[property="og:image:height"]');
  setMeta(
    'meta[name="robots"]',
    "name",
    "robots",
    "index,follow,max-image-preview:large,max-snippet:-1",
  );

  const duration = isoDuration(recipe.time);
  const recipeSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "@id": `${url}#recipe`,
    mainEntityOfPage: url,
    name: recipe.title,
    description,
    author: { "@id": AUTHOR_ID },
    recipeCategory: recipe.category,
    recipeYield: recipe.servings,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.steps.map((text, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      text,
    })),
    inLanguage: "ja",
  };
  if (recipe.imageUrl) recipeSchema.image = [recipe.imageUrl];
  if (duration) recipeSchema.totalTime = duration;
  setJsonLd([
    websiteSchema(),
    personSchema(),
    recipeSchema,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "レシピ一覧",
          item: `${SITE_URL}/`,
        },
        { "@type": "ListItem", position: 2, name: recipe.title, item: url },
      ],
    },
  ]);
}

export function setManagerSeo() {
  document.title = `管理画面 | ${SITE_NAME}`;
  setMeta(
    'meta[name="robots"]',
    "name",
    "robots",
    "noindex,nofollow,noarchive",
  );
  setCanonical(`${SITE_URL}/project-manager`);
}
