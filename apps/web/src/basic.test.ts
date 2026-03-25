describe("Basic Test Setup", () => {
	it("should run a basic test", () => {
		expect(1 + 1).toBe(2);
	});

	it("should have access to globals", () => {
		expect(typeof window).toBe("object");
		expect(typeof document).toBe("object");
	});
});
