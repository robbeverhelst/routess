declare global {
	var jest: typeof import("vitest")["vi"];

	namespace jest {
		type Mock = any;
	}
}

export {};
