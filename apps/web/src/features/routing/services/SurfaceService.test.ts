import { fetchSurfaceBreakdown } from "@/features/routing/services/SurfaceService";

describe("SurfaceService", () => {
	it("sends cycle activity to the trace-attributes proxy as bicycle costing", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				edges: [
					{ surface: "paved", length: 1.2 },
					{ surface: "gravel", length: 0.8 },
				],
			}),
		} as Response);

		const result = await fetchSurfaceBreakdown(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			"cycle",
		);

		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
		const body = JSON.parse(String(init?.body));

		expect(String(url)).toContain("/api/v1/routing/trace-attributes");
		expect(body.costing).toBe("bicycle");
		expect(body.shape).toHaveLength(2);
		expect(result).toEqual({
			meters: {
				paved: 1200,
				compacted: 0,
				unpaved: 800,
				path: 0,
			},
			total: 2000,
			segments: [],
		});
	});

	it("maps run and walk to pedestrian costing", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ edges: [{ surface: "paved", length: 1.0 }] }),
		} as Response);

		await fetchSurfaceBreakdown(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			"run",
		);
		const [, runInit] = vi.mocked(fetch).mock.calls[0] ?? [];
		expect(JSON.parse(String(runInit?.body)).costing).toBe("pedestrian");

		vi.mocked(fetch).mockClear();
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ edges: [{ surface: "paved", length: 1.0 }] }),
		} as Response);
		await fetchSurfaceBreakdown(
			[
				[4.3517, 50.8503],
				[4.4025, 51.2194],
			],
			"walk",
		);
		const [, walkInit] = vi.mocked(fetch).mock.calls[0] ?? [];
		expect(JSON.parse(String(walkInit?.body)).costing).toBe("pedestrian");
	});
});
