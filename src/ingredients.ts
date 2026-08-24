const sectionLabels = new Set([
  "材料",
  "タレ",
  "たれ",
  "ソース",
  "ドレッシング",
  "生地",
  "フィリング",
  "トッピング",
  "合わせ調味料",
  "合わせタレ",
]);

const aliases: Array<[string, string[]]> = [
  ["塩こしょう", ["塩コショウ", "塩胡椒", "塩こしょう", "塩・こしょう"]],
  ["鶏がらスープの素", ["鶏ガラスープの素", "鶏がらスープの素"]],
  ["にんにく", ["ニンニク", "にんにく", "大蒜", "ニンニクチューブ"]],
  ["しょうが", ["生姜", "しょうが", "ショウガ", "しょうがチューブ"]],
  ["玉ねぎ", ["玉ねぎ", "玉葱", "たまねぎ"]],
  ["にんじん", ["にんじん", "人参", "ニンジン"]],
  ["ねぎ", ["白ネギ", "長ネギ", "青ネギ", "ねぎ", "ネギ", "葱"]],
  ["醤油", ["濃口醤油", "薄口醤油", "しょうゆ", "醤油"]],
  ["はちみつ", ["蜂蜜", "ハチミツ", "はちみつ"]],
  ["酢", ["お酢", "穀物酢", "米酢", "酢"]],
  ["えび", ["むきえび", "海老", "エビ", "えび"]],
  ["コンソメ", ["コンソメキューブ", "固形コンソメ", "コンソメ"]],
  ["トマト缶", ["カットトマト缶", "ホールトマト缶", "トマト缶"]],
  ["パスタ", ["スパゲッティ", "スパゲティ", "パスタ"]],
  ["米", ["お米", "白米", "米"]],
  ["ごま", ["いりごま", "すりごま", "炒りごま", "ごま"]],
  ["チーズ", ["ミックスチーズ", "ピザ用チーズ", "とろけるチーズ", "チーズ"]],
  ["こしょう", ["黒コショウ", "コショウ", "胡椒", "こしょう"]],
  ["砂糖", ["上白糖", "グラニュー糖", "きび砂糖", "砂糖"]],
  ["サラダ油", ["植物油", "サラダ油"]],
  ["バター", ["無塩バター", "有塩バター", "バター"]],
  ["卵", ["たまご", "玉子", "卵"]],
  ["ご飯", ["ごはん", "御飯", "ご飯"]],
  ["酒", ["料理酒", "日本酒", "酒"]],
  ["味噌", ["みそ", "味噌"]],
  ["オリーブオイル", ["オリーブ油", "オリーブオイル"]],
  ["ごま油", ["胡麻油", "ごま油"]],
  ["かつお節", ["鰹節", "かつおぶし", "かつお節"]],
  ["トマト", ["プチトマト", "ミニトマト", "トマト"]],
];

const aliasLookup = new Map(
  aliases.flatMap(([canonical, variants]) =>
    variants.map((variant) => [variant.normalize("NFKC"), canonical] as const),
  ),
);

export function ingredientName(line: string): string {
  let name = line
    .normalize("NFKC")
    .replace(/^[●•・\-＊*]+\s*/, "")
    .split(/[：:]/, 1)[0]
    .trim();
  name = name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(
      /\s*(?:約|お好みで)?(?:\d[\d./〜~～-]*|適量|少々|ひとつまみ|お好みで).*/,
      "",
    )
    .trim();
  if (!name || /^\d+$/.test(name) || sectionLabels.has(name)) return "";
  return aliasLookup.get(name) || name;
}

export function ingredientTags(lines: string[]): string[] {
  return [...new Set(lines.map(ingredientName).filter(Boolean))];
}

export function ingredientOptions(recipes: Array<{ ingredients: string[] }>) {
  const counts = new Map<string, number>();
  recipes.forEach((recipe) =>
    ingredientTags(recipe.ingredients).forEach((name) =>
      counts.set(name, (counts.get(name) || 0) + 1),
    ),
  );
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([name, count]) => ({ name, count }));
}
