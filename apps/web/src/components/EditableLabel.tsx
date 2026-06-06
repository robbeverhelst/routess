import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { RDS_COLORS } from "./primitives";
import { Tooltip } from "./Tooltip";

interface EditableLabelProps {
	value: string | undefined;
	placeholder: string;
	onSave: (next: string | undefined) => void;
	style?: CSSProperties;
	hintStyle?: CSSProperties;
	disabled?: boolean;
	ariaLabel?: string;
}

export function EditableLabel({
	value,
	placeholder,
	onSave,
	style,
	hintStyle,
	disabled,
	ariaLabel,
}: EditableLabelProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? "");
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (editing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [editing]);

	useEffect(() => {
		if (!editing) setDraft(value ?? "");
	}, [value, editing]);

	const commit = () => {
		const trimmed = draft.trim();
		const next = trimmed.length > 0 ? trimmed : undefined;
		if (next !== value) onSave(next);
		setEditing(false);
	};

	const cancel = () => {
		setDraft(value ?? "");
		setEditing(false);
	};

	const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			commit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancel();
		}
	};

	if (editing) {
		return (
			<input
				ref={inputRef}
				value={draft}
				placeholder={placeholder}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={onKey}
				aria-label={ariaLabel ?? "Rename waypoint"}
				style={{
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.borderStrong}`,
					borderRadius: 6,
					padding: "2px 6px",
					height: 22,
					fontSize: 13,
					color: RDS_COLORS.fg,
					outline: "none",
					width: "100%",
					...style,
				}}
			/>
		);
	}

	const display = value ?? placeholder;
	const isPlaceholder = !value;
	return (
		<Tooltip label={disabled ? undefined : t("common.clickToRename")}>
			<button
				type="button"
				disabled={disabled}
				onClick={(e) => {
					e.stopPropagation();
					if (!disabled) setEditing(true);
				}}
				style={{
					background: "transparent",
					border: 0,
					padding: 0,
					margin: 0,
					cursor: disabled ? "default" : "text",
					textAlign: "left",
					font: "inherit",
					color: isPlaceholder ? RDS_COLORS.fgMuted : RDS_COLORS.fg,
					...(isPlaceholder ? hintStyle : null),
					...style,
				}}
			>
				{display}
			</button>
		</Tooltip>
	);
}
