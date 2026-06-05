import type { Locale } from "@/lib/i18n";

export type ArticleSection = "compare" | "guides";

export type Inline = string | { readonly text: string; readonly href?: string; readonly strong?: boolean };
export type RichText = ReadonlyArray<Inline>;

export type ArticleBlock =
	| { readonly kind: "h2"; readonly text: string }
	| { readonly kind: "h3"; readonly text: string }
	| { readonly kind: "p"; readonly content: RichText }
	| { readonly kind: "ul"; readonly items: ReadonlyArray<RichText> }
	| {
			readonly kind: "table";
			readonly headers: ReadonlyArray<string>;
			readonly rows: ReadonlyArray<ReadonlyArray<RichText>>;
	  }
	| { readonly kind: "note"; readonly content: RichText }
	| { readonly kind: "cta"; readonly label: string; readonly href: string };

export interface ArticleContent {
	readonly slug: string;
	readonly metaTitle: string;
	readonly title: string;
	readonly description: string;
	readonly intro: RichText;
	readonly blocks: ReadonlyArray<ArticleBlock>;
}

export interface Article {
	readonly key: string;
	readonly section: ArticleSection;
	readonly datePublished: string;
	readonly dateModified: string;
	readonly content: Record<Locale, ArticleContent>;
}
