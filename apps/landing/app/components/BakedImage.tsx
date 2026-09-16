import type { StaticImageData } from "next/image";
import type { CSSProperties } from "react";

/**
 * A capture baked by `bun run screenshots`, served straight from
 * /_next/static/media instead of through /_next/image.
 *
 * The optimizer has nothing to do here: every one of these is already encoded
 * at the size it renders at. It only added a round trip to origin, because its
 * responses carry `Vary: Accept` and so are never edge-cached
 * (cf-cache-status: DYNAMIC). Static media is immutable and does cache.
 */
export function BakedImage({
	src,
	eager = false,
	className,
	style,
}: {
	src: StaticImageData;
	eager?: boolean;
	className?: string;
	style?: CSSProperties;
}) {
	return (
		// biome-ignore lint/performance/noImgElement: pre-encoded at its render size, next/image only adds an uncacheable round trip
		<img
			src={src.src}
			width={src.width}
			height={src.height}
			alt=""
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			fetchPriority={eager ? "high" : "auto"}
			className={className}
			style={{
				...(src.blurDataURL
					? {
							backgroundImage: `url("${src.blurDataURL}")`,
							backgroundSize: "cover",
							backgroundPosition: "50% 50%",
						}
					: null),
				...style,
			}}
		/>
	);
}
