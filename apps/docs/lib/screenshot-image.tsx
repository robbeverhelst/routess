import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ComponentProps } from "react";

const BaseImg = defaultMdxComponents.img;

/** Portrait screenshots (phone captures, sidebar clips) render at a phone-like width instead of the full content column. */
export function ScreenshotImage(props: ComponentProps<"img">) {
	const src = props.src as unknown;
	const isPortrait =
		typeof src === "object" &&
		src !== null &&
		"width" in src &&
		"height" in src &&
		Number(src.height) > Number(src.width);

	if (!isPortrait) return <BaseImg {...props} />;
	return <BaseImg {...props} sizes="320px" style={{ maxWidth: 320, marginInline: "auto", ...props.style }} />;
}
