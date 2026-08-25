import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { ingredientOptions, ingredientTags } from "./ingredients";
import { setHomeSeo, setManagerSeo, setRecipeSeo } from "./seo";

type Category = "ごはん" | "おかず" | "おやつ" | "その他";
type Recipe = {
  id: string;
  title: string;
  category: Category;
  time: string;
  servings: string;
  ingredients: string[];
  steps: string[];
  note: string;
  icon: string;
  color: string;
  imageUrl?: string;
  sourceFile?: string;
};
type RecipeInput = Omit<Recipe, "id">;
const categories: Array<"すべて" | Category> = [
  "すべて",
  "ごはん",
  "おかず",
  "おやつ",
  "その他",
];
const foodIcons = [
  "🍽️",
  "🍳",
  "🍚",
  "🍙",
  "🍛",
  "🍝",
  "🍜",
  "🥣",
  "🥗",
  "🍲",
  "🥘",
  "🍖",
  "🍗",
  "🐟",
  "🍤",
  "🥪",
  "🍞",
  "🥞",
  "🧁",
  "🍰",
  "🍪",
  "🍮",
];
const recipeColors = [
  { value: "#f6bd49", name: "たまご" },
  { value: "#ec7657", name: "トマト" },
  { value: "#9fbd73", name: "ハーブ" },
  { value: "#dca5b5", name: "ベリー" },
  { value: "#82b8b4", name: "ミント" },
  { value: "#e3a46f", name: "キャラメル" },
  { value: "#9aaed0", name: "ブルーベリー" },
  { value: "#c7a9d3", name: "ラベンダー" },
];

function splitCookingTime(value?: string) {
  if (!value || value.trim() === "—") return { hours: "", minutes: "" };
  const hourMatch = value.match(/(\d+)\s*時間/);
  const minuteMatch = value.match(/(\d+)\s*分/);
  if (hourMatch)
    return { hours: hourMatch[1], minutes: minuteMatch?.[1] || "" };
  if (minuteMatch) {
    const total = Number(minuteMatch[1]);
    return {
      hours: total >= 60 ? String(Math.floor(total / 60)) : "",
      minutes: String(total % 60 || (total < 60 ? total : "")),
    };
  }
  return { hours: "", minutes: "" };
}
const ADMIN_UIDS = new Set([
  "Z2YLjPzwFEWGtWVs8BHhvb43bQI3",
  "w41JQF9EuDcLL2pfMpbDuI5q6Eh1",
]);

const starterRecipes: RecipeInput[] = [
  {
    title: "ふわふわオムライス",
    category: "ごはん",
    time: "25分",
    servings: "2人分",
    icon: "🍳",
    color: "#f6bd49",
    ingredients: [
      "ごはん 300g",
      "鶏もも肉 100g",
      "玉ねぎ 1/4個",
      "卵 4個",
      "ケチャップ 大さじ4",
    ],
    steps: [
      "具材を小さく切り、フライパンで炒める。",
      "ごはんとケチャップを加えて混ぜる。",
      "半熟に焼いた卵をのせて、やさしく包む。",
    ],
    note: "卵にバターを少し加えるとふんわり。",
  },
  {
    title: "トマトクリームパスタ",
    category: "ごはん",
    time: "20分",
    servings: "2人分",
    icon: "🍅",
    color: "#ec7657",
    ingredients: [
      "パスタ 180g",
      "カットトマト 200g",
      "生クリーム 100ml",
      "にんにく 1片",
      "粉チーズ 適量",
    ],
    steps: [
      "パスタを表示時間より1分短く茹でる。",
      "にんにくとトマトを煮詰め、生クリームを加える。",
      "パスタを絡め、粉チーズで仕上げる。",
    ],
    note: "トマトをしっかり煮詰めると酸味がまろやか。",
  },
  {
    title: "ごろごろ野菜のスープ",
    category: "おかず",
    time: "35分",
    servings: "4人分",
    icon: "🥕",
    color: "#9fbd73",
    ingredients: [
      "じゃがいも 2個",
      "にんじん 1本",
      "玉ねぎ 1個",
      "キャベツ 1/4個",
      "コンソメ 2個",
    ],
    steps: [
      "野菜を食べやすい大きさに切る。",
      "鍋に野菜と水を入れ、やわらかくなるまで煮る。",
      "コンソメと塩こしょうで味を整える。",
    ],
    note: "冷蔵庫にある野菜で自由にアレンジ。",
  },
  {
    title: "キャロットケーキ",
    category: "おやつ",
    time: "50分",
    servings: "18cm型",
    icon: "🧁",
    color: "#dca5b5",
    ingredients: [
      "にんじん 150g",
      "薄力粉 150g",
      "卵 2個",
      "きび砂糖 70g",
      "植物油 80ml",
    ],
    steps: [
      "にんじんを細かくすりおろす。",
      "卵、砂糖、油を混ぜ、粉類とにんじんを加える。",
      "型に流し、170℃のオーブンで35分焼く。",
    ],
    note: "くるみやシナモンを加えるのもおすすめ。",
  },
];

function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(
    () =>
      onSnapshot(
        collection(db, "recipes"),
        (snap) => {
          setRecipes(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recipe),
          );
          setLoading(false);
        },
        () => {
          setError("レシピを読み込めませんでした。");
          setLoading(false);
        },
      ),
    [],
  );
  return { recipes, loading, error };
}

function Card({ recipe, open }: { recipe: Recipe; open: () => void }) {
  const hasTime = Boolean(recipe.time?.trim() && recipe.time.trim() !== "—");
  return (
    <a
      className="recipe-card"
      href={`/recipes/${encodeURIComponent(recipe.id)}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        open();
      }}
      aria-label={`${recipe.title}を見る`}
    >
      <div className="recipe-picture" style={{ background: recipe.color }}>
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={`${recipe.title}の完成写真`}
            loading="lazy"
          />
        ) : (
          <span className="food-icon">{recipe.icon}</span>
        )}
        <i />
        <i />
        <small>MEBAE'S RECIPE</small>
      </div>
      <div className="recipe-info">
        <span>{recipe.category}</span>
        <h3>{recipe.title}</h3>
        <div>
          {hasTime && <span>◷ {recipe.time}</span>}
          <span>分量 {recipe.servings}</span>
          <b>→</b>
        </div>
      </div>
    </a>
  );
}

function RecipeDetail({
  recipe,
  close,
}: {
  recipe: Recipe;
  close: () => void;
}) {
  const hasTime = Boolean(recipe.time?.trim() && recipe.time.trim() !== "—");
  return (
    <div
      className="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <article className="recipe-modal">
        <button className="close" aria-label="閉じる" onClick={close}>
          ×
        </button>
        <div
          className={`modal-head ${recipe.imageUrl ? "has-photo" : ""}`}
          style={{ background: recipe.color }}
        >
          {recipe.imageUrl ? (
            <img src={recipe.imageUrl} alt={recipe.title} />
          ) : (
            <span>{recipe.icon}</span>
          )}
          <div>
            <small>
              {recipe.category}
              {hasTime && ` · ${recipe.time}`}
            </small>
            <h2>{recipe.title}</h2>
            <p>{recipe.servings}</p>
          </div>
        </div>
        <div className="modal-body">
          <section>
            <h3>材料</h3>
            <ul>
              {recipe.ingredients.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>作り方</h3>
            <ol>
              {recipe.steps.map((s, i) => (
                <li key={s}>
                  <b>{i + 1}</b>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>
          {recipe.note && (
            <aside>
              <b>MEMO</b>
              <p>{recipe.note}</p>
            </aside>
          )}
        </div>
      </article>
    </div>
  );
}

function PublicSite() {
  const { recipes, loading, error } = useRecipes(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<(typeof categories)[number]>("すべて"),
    [selected, setSelected] = useState<Recipe | null>(null),
    [selectedIngredients, setSelectedIngredients] = useState<string[]>([]),
    [ingredientQuery, setIngredientQuery] = useState(""),
    [pageSize, setPageSize] = useState(() =>
      window.matchMedia("(max-width: 950px)").matches ? 6 : 12,
    ),
    [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 950px)");
    const updatePageSize = () => setPageSize(media.matches ? 6 : 12);
    media.addEventListener("change", updatePageSize);
    return () => media.removeEventListener("change", updatePageSize);
  }, []);
  useEffect(
    () => setVisibleCount(pageSize),
    [query, category, pageSize, selectedIngredients],
  );
  const source = useMemo(
    () =>
      recipes.length
        ? recipes
        : starterRecipes.map((recipe, index) => ({
            id: `starter-${index}`,
            ...recipe,
          })),
    [recipes],
  );
  const availableIngredients = useMemo(
    () => ingredientOptions(source),
    [source],
  );
  const ingredientChoices = availableIngredients
    .filter(({ name }) =>
      name
        .toLocaleLowerCase("ja")
        .includes(ingredientQuery.toLocaleLowerCase("ja")),
    )
    .slice(0, ingredientQuery ? 40 : 18);
  const toggleIngredient = (name: string) =>
    setSelectedIngredients((current) =>
      current.includes(name)
        ? current.filter((ingredient) => ingredient !== name)
        : [...current, name],
    );
  const shown = useMemo(
    () =>
      source.filter(
        (r) =>
          (category === "すべて" || r.category === category) &&
          (r.title.includes(query) ||
            r.ingredients.some((i) => i.includes(query))) &&
          selectedIngredients.every((ingredient) =>
            ingredientTags(r.ingredients).includes(ingredient),
          ),
      ),
    [source, query, category, selectedIngredients],
  );
  const visibleRecipes = shown.slice(0, visibleCount);
  useEffect(() => {
    const syncRecipeFromUrl = () => {
      const match = location.pathname.match(/^\/recipes\/([^/]+)$/);
      if (!match) {
        setSelected(null);
        return;
      }
      const recipeId = decodeURIComponent(match[1]);
      const recipe = recipes.find((item) => item.id === recipeId);
      if (recipe) setSelected(recipe);
    };
    syncRecipeFromUrl();
    window.addEventListener("popstate", syncRecipeFromUrl);
    return () => window.removeEventListener("popstate", syncRecipeFromUrl);
  }, [recipes]);
  useEffect(() => {
    if (selected) setRecipeSeo(selected);
    else setHomeSeo(recipes);
  }, [selected, recipes]);
  const openRecipe = (recipe: Recipe) => {
    history.pushState({}, "", `/recipes/${encodeURIComponent(recipe.id)}`);
    setSelected(recipe);
  };
  const closeRecipe = () => {
    if (location.pathname.startsWith("/recipes/"))
      history.pushState({}, "", "/");
    setSelected(null);
  };
  return (
    <>
      <header>
        <a className="logo" href="/">
          <small>MEBAE'S</small>
          <strong>KITCHEN</strong>
        </a>
        <nav>
          <a href="/#recipes">Recipes</a>
          <a href="/#about">About</a>
        </nav>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">KAMEOKA MEBAE'S RECIPE NOTE</p>
            <h1>
              おいしいを、
              <br />
              <em>忘れない。</em>
            </h1>
            <p>
              作っておいしかったもの、また食べたいもの。
              <br />
              お気に入りのレシピを集める、小さなキッチンノート。
            </p>
            <a href="/#recipes">レシピを見る　↓</a>
          </div>
          <div
            className="hero-plate"
            role="img"
            aria-label="木べらを持って料理を楽しむ亀岡芽生"
          >
            <b className="tomato">🍅</b>
            <b className="lemon">🍋</b>
            <b className="herb">🌿</b>
            <svg
              viewBox="0 0 520 520"
              role="img"
              aria-label="鍋で料理をする人のイラスト"
            >
              <circle
                cx="260"
                cy="260"
                r="207"
                fill="#f9f5ec"
                stroke="#292721"
                strokeWidth="6"
              />
              <path
                className="steam"
                d="M190 104c-28-30 27-42 1-77M252 89c-24-28 23-39 4-68M314 106c-28-30 28-43 5-76"
              />
              <path
                d="M160 396c4-96 39-150 100-150s98 55 102 150"
                fill="#ef7752"
                stroke="#292721"
                strokeWidth="7"
              />
              <circle
                cx="260"
                cy="206"
                r="73"
                fill="#f9d7ba"
                stroke="#292721"
                strokeWidth="7"
              />
              <path
                d="M190 200c-3-66 35-94 73-91 42 3 78 36 67 92-26-5-48-28-55-52-19 31-46 47-85 51z"
                fill="#292721"
              />
              <path
                d="M228 211l10 3M282 214l10-3M244 238c12 10 25 10 37 0"
                fill="none"
                stroke="#292721"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M214 280l46 53 45-53M260 333v63"
                fill="#f9f5ec"
                stroke="#292721"
                strokeWidth="7"
              />
              <path
                d="M198 311l-92 47 24 42 102-40M322 311l92 47-24 42-102-40"
                fill="#f6bd49"
                stroke="#292721"
                strokeWidth="7"
              />
              <circle
                cx="119"
                cy="383"
                r="25"
                fill="#f9d7ba"
                stroke="#292721"
                strokeWidth="7"
              />
              <circle
                cx="402"
                cy="383"
                r="25"
                fill="#f9d7ba"
                stroke="#292721"
                strokeWidth="7"
              />
              <path
                d="M151 379h218l-20 83H171z"
                fill="#9fbd73"
                stroke="#292721"
                strokeWidth="7"
              />
              <path
                d="M133 369h254M316 252l60-154"
                fill="none"
                stroke="#292721"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <ellipse
                cx="388"
                cy="75"
                rx="29"
                ry="16"
                transform="rotate(-68 388 75)"
                fill="#f6bd49"
                stroke="#292721"
                strokeWidth="7"
              />
            </svg>
            <small>COOK · EAT · SMILE</small>
          </div>
        </section>
        <section className="recipes" id="recipes">
          <div className="section-title">
            <div>
              <p className="kicker">MY RECIPE COLLECTION</p>
              <h2>きょう、何つくる？</h2>
            </div>
            <span>{shown.length} RECIPES</span>
          </div>
          <div className="tools">
            <label>
              ⌕{" "}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="料理名・食材から探す"
              />
            </label>
            <div>
              {categories.map((c) => (
                <button
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                  key={c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="ingredient-panel">
            <div className="ingredient-panel-head">
              <div>
                <strong>材料から絞る</strong>
                <small>複数選ぶと、すべてを含むレシピを表示します</small>
              </div>
              {selectedIngredients.length > 0 && (
                <button onClick={() => setSelectedIngredients([])}>
                  選択をクリア
                </button>
              )}
            </div>
            <label className="ingredient-search">
              ⌕
              <input
                value={ingredientQuery}
                onChange={(event) => setIngredientQuery(event.target.value)}
                placeholder="材料名を探す"
              />
            </label>
            <div className="ingredient-chips">
              {ingredientChoices.map(({ name, count }) => (
                <button
                  className={selectedIngredients.includes(name) ? "active" : ""}
                  onClick={() => toggleIngredient(name)}
                  key={name}
                >
                  {name} <small>{count}</small>
                </button>
              ))}
            </div>
            {selectedIngredients.length > 0 && (
              <p className="selected-ingredients">
                選択中：{selectedIngredients.join(" ＋ ")}
              </p>
            )}
          </div>
          {loading ? (
            <div className="empty">
              <p>読み込み中...</p>
            </div>
          ) : error ? (
            <div className="empty">
              <p>{error}</p>
            </div>
          ) : shown.length ? (
            <>
              <div className="grid">
                {visibleRecipes.map((r) => (
                  <Card key={r.id} recipe={r} open={() => openRecipe(r)} />
                ))}
              </div>
              {visibleCount < shown.length && (
                <button
                  className="load-more"
                  onClick={() => setVisibleCount((count) => count + pageSize)}
                >
                  さらに表示
                  <small>
                    {Math.min(pageSize, shown.length - visibleCount)}件を追加
                  </small>
                </button>
              )}
            </>
          ) : (
            <div className="empty">
              🥣<p>レシピがまだありません。</p>
            </div>
          )}
        </section>
        <section className="about" id="about">
          <span>🥄</span>
          <div>
            <p className="kicker">ABOUT THIS NOTE</p>
            <h2>
              <span>暮らしの中の、</span>
              <br />
              <span>おいしい記録。</span>
            </h2>
          </div>
          <p>
            特別な日のごちそうも、いつもの朝ごはんも。
            <br />
            亀岡芽生のお気に入りを、少しずつ集めています。
          </p>
        </section>
      </main>
      <footer>
        <p>MEBAE'S KITCHEN</p>
        <a href="/project-manager">PROJECT MANAGER</a>
        <p>© 2026 KAMEOKA MEBAE</p>
      </footer>
      {selected && <RecipeDetail recipe={selected} close={closeRecipe} />}
    </>
  );
}

function RecipeForm({
  recipe,
  onClose,
  ingredientSuggestions,
}: {
  recipe?: Recipe;
  onClose: () => void;
  ingredientSuggestions: string[];
}) {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [imagePreview, setImagePreview] = useState(recipe?.imageUrl || ""),
    [ingredientsText, setIngredientsText] = useState(
      recipe?.ingredients.join("\n") || "",
    ),
    [ingredientCandidate, setIngredientCandidate] = useState("");
  const cookingTime = splitCookingTime(recipe?.time);
  const selectedColor = recipeColors.some(
    ({ value }) => value === recipe?.color,
  )
    ? recipe!.color
    : recipeColors[0].value;
  const previewImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result));
    reader.readAsDataURL(file);
  };
  const addIngredientCandidate = () => {
    const ingredient = ingredientCandidate.trim();
    if (!ingredient) return;
    setIngredientsText((current) =>
      current.trimEnd()
        ? `${current.trimEnd()}\n${ingredient}：`
        : `${ingredient}：`,
    );
    setIngredientCandidate("");
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const d = new FormData(e.currentTarget);
    const image = d.get("image") as File;
    const hours = Math.max(0, Number(d.get("timeHours")) || 0);
    const minutes = Math.min(
      59,
      Math.max(0, Number(d.get("timeMinutes")) || 0),
    );
    const time = `${hours ? `${hours}時間` : ""}${minutes ? `${minutes}分` : ""}`;
    try {
      let imageUrl = recipe?.imageUrl;
      if (image?.size) {
        if (image.size >= 10 * 1024 * 1024)
          throw new Error("画像は10MB未満にしてください。");
        const extension =
          image.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";
        const imageRef = ref(
          storage,
          `recipe-images/uploads/${crypto.randomUUID()}.${extension}`,
        );
        await uploadBytes(imageRef, image, { contentType: image.type });
        imageUrl = await getDownloadURL(imageRef);
      }
      const value = {
        title: String(d.get("title")).replaceAll("レシピ", "").trim(),
        category: d.get("category") as Category,
        time,
        servings: String(d.get("servings")),
        ingredients: String(d.get("ingredients"))
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        steps: String(d.get("steps"))
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        note: String(d.get("note")),
        icon: String(d.get("icon") || "🍽️"),
        color: String(d.get("color")),
        ...(imageUrl ? { imageUrl } : {}),
        updatedAt: serverTimestamp(),
      };
      if (recipe) await updateDoc(doc(db, "recipes", recipe.id), value);
      else
        await addDoc(collection(db, "recipes"), {
          ...value,
          createdAt: serverTimestamp(),
        });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "保存できませんでした。管理者権限を確認してください。",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="backdrop">
      <form className="add-modal" onSubmit={submit}>
        <button
          type="button"
          className="close"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </button>
        <p className="kicker">{recipe ? "EDIT RECIPE" : "NEW RECIPE"}</p>
        <h2>{recipe ? "レシピを編集" : "レシピを追加"}</h2>
        {error && <p className="form-error">{error}</p>}
        <div className="form-row">
          <label>
            料理名
            <input name="title" required defaultValue={recipe?.title} />
          </label>
          <label>
            絵文字
            <select name="icon" defaultValue={recipe?.icon || "🍽️"}>
              {foodIcons.map((icon) => (
                <option value={icon} key={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row three">
          <label>
            カテゴリ
            <select name="category" defaultValue={recipe?.category}>
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            調理時間 <small>任意</small>
            <span className="time-picker">
              <span>
                <input
                  name="timeHours"
                  type="number"
                  min="0"
                  max="24"
                  inputMode="numeric"
                  defaultValue={cookingTime.hours}
                  aria-label="調理時間の時間"
                />
                <b>時間</b>
              </span>
              <span>
                <input
                  name="timeMinutes"
                  type="number"
                  min="0"
                  max="59"
                  inputMode="numeric"
                  defaultValue={cookingTime.minutes}
                  aria-label="調理時間の分"
                />
                <b>分</b>
              </span>
            </span>
          </label>
          <label>
            分量
            <input name="servings" required defaultValue={recipe?.servings} />
          </label>
        </div>
        <label className={`image-picker ${imagePreview ? "has-preview" : ""}`}>
          {imagePreview ? (
            <img src={imagePreview} alt="選択した料理写真のプレビュー" />
          ) : (
            <span className="image-placeholder">📷</span>
          )}
          <span className="image-picker-copy">
            <strong>
              {recipe?.imageUrl ? "料理写真を置き換える" : "料理写真を選択"}
            </strong>
            <small>クリックして画像を選択（10MB未満）</small>
          </span>
          <input
            name="image"
            type="file"
            accept="image/*"
            required={!recipe?.imageUrl}
            onChange={(event) => previewImage(event.target.files?.[0])}
          />
        </label>
        <fieldset className="color-palette">
          <legend>カードの色</legend>
          <div>
            {recipeColors.map(({ value, name }) => (
              <label title={name} key={value}>
                <input
                  name="color"
                  type="radio"
                  value={value}
                  defaultChecked={selectedColor === value}
                />
                <span style={{ background: value }} />
                <small>{name}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          材料 <small>1行にひとつ</small>
          <span className="ingredient-assist">
            <input
              list="ingredient-suggestions"
              value={ingredientCandidate}
              onChange={(event) => setIngredientCandidate(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addIngredientCandidate();
                }
              }}
              placeholder="候補から材料を選択"
            />
            <button type="button" onClick={addIngredientCandidate}>
              材料欄へ追加
            </button>
            <datalist id="ingredient-suggestions">
              {ingredientSuggestions.map((ingredient) => (
                <option value={ingredient} key={ingredient} />
              ))}
            </datalist>
          </span>
          <textarea
            name="ingredients"
            required
            rows={5}
            value={ingredientsText}
            onChange={(event) => setIngredientsText(event.target.value)}
          />
        </label>
        <label>
          作り方 <small>1工程を1行で</small>
          <textarea
            name="steps"
            required
            rows={5}
            defaultValue={recipe?.steps.join("\n")}
          />
        </label>
        <label>
          メモ
          <textarea name="note" rows={2} defaultValue={recipe?.note} />
        </label>
        <button className="submit" disabled={saving}>
          {saving ? "画像とレシピを保存中..." : "保存する →"}
        </button>
      </form>
    </div>
  );
}

function Login({ onUser }: { onUser: (user: User) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      const result = await signInWithEmailAndPassword(
        auth,
        String(d.get("email")),
        String(d.get("password")),
      );
      onUser(result.user);
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="manager-login">
      <a className="logo" href="/">
        <small>MEBAE'S</small>
        <strong>KITCHEN</strong>
      </a>
      <form onSubmit={submit}>
        <p className="kicker">PROJECT MANAGER</p>
        <h1>管理者ログイン</h1>
        <p>レシピを追加・編集するにはログインしてください。</p>
        {error && <p className="form-error">{error}</p>}
        <label>
          メールアドレス
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          パスワード
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button className="submit" disabled={busy}>
          {busy ? "確認中..." : "ログイン →"}
        </button>
        <a href="/">← 公開サイトへ戻る</a>
      </form>
    </main>
  );
}

function Manager() {
  const { recipes } = useRecipes(),
    [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [isAdmin, setIsAdmin] = useState(false),
    [editing, setEditing] = useState<Recipe | undefined>(),
    [creating, setCreating] = useState(false);
  const ingredientSuggestions = useMemo(
    () => ingredientOptions(recipes).map(({ name }) => name),
    [recipes],
  );
  useEffect(() => setManagerSeo(), []);
  const verify = async (u: User | null) => {
    setUser(u);
    setIsAdmin(Boolean(u && ADMIN_UIDS.has(u.uid)));
    setAuthReady(true);
  };
  useEffect(() => onAuthStateChanged(auth, verify), []);
  const remove = async (recipe: Recipe) => {
    if (!confirm(`「${recipe.title}」を削除しますか？`)) return;
    await deleteDoc(doc(db, "recipes", recipe.id));
  };
  if (!authReady)
    return <div className="manager-loading">認証を確認しています...</div>;
  if (!user) return <Login onUser={verify} />;
  if (!isAdmin)
    return (
      <main className="manager-denied">
        <h1>権限がありません</h1>
        <p>このアカウントは管理者として登録されていません。</p>
        <button onClick={() => signOut(auth)}>別のアカウントでログイン</button>
      </main>
    );
  return (
    <>
      <header className="manager-header">
        <a className="logo" href="/">
          <small>MEBAE'S</small>
          <strong>KITCHEN</strong>
        </a>
        <strong>PROJECT MANAGER</strong>
        <div>
          <span>{user.email}</span>
          <button onClick={() => signOut(auth)}>ログアウト</button>
        </div>
      </header>
      <main className="manager-main">
        <div className="manager-title">
          <div>
            <p className="kicker">RECIPE MANAGEMENT</p>
            <h1>レシピ一覧</h1>
          </div>
          <div className="manager-actions">
            <button className="pill" onClick={() => setCreating(true)}>
              ＋ 新しいレシピ
            </button>
          </div>
        </div>
        <div className="manager-list">
          {recipes.map((r) => (
            <article key={r.id}>
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" />
              ) : (
                <span style={{ background: r.color }}>{r.icon}</span>
              )}
              <div>
                <small>
                  {r.category}
                  {r.time?.trim() && r.time.trim() !== "—" && ` · ${r.time}`}
                </small>
                <h2>{r.title}</h2>
              </div>
              <button onClick={() => setEditing(r)}>編集</button>
              <button className="danger" onClick={() => remove(r)}>
                削除
              </button>
            </article>
          ))}
        </div>
      </main>
      {creating && (
        <RecipeForm
          ingredientSuggestions={ingredientSuggestions}
          onClose={() => setCreating(false)}
        />
      )}{" "}
      {editing && (
        <RecipeForm
          recipe={editing}
          ingredientSuggestions={ingredientSuggestions}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}

export default function App() {
  return location.pathname.startsWith("/project-manager") ? (
    <Manager />
  ) : (
    <PublicSite />
  );
}
