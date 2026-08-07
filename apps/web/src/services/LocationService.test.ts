import { LocationService } from "@/services/LocationService";

describe("LocationService", () => {
	beforeEach(() => {
		LocationService.destroyInstance();
		localStorage.clear();

		vi.spyOn(navigator.permissions, "query").mockResolvedValue({
			state: "prompt",
			addEventListener: vi.fn(),
		} as unknown as PermissionStatus);
		vi.spyOn(navigator.geolocation, "watchPosition").mockReturnValue(1);
		vi.spyOn(navigator.geolocation, "clearWatch").mockImplementation(() => {});
		vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		LocationService.destroyInstance();
	});

	it("notifies all subscribers and supports unsubscribe", () => {
		const service = LocationService.getInstance();
		const firstTracking = vi.fn();
		const secondTracking = vi.fn();

		const unsubscribeFirst = service.subscribe({
			onTrackingStateChange: firstTracking,
		});
		service.subscribe({
			onTrackingStateChange: secondTracking,
		});

		service.startTracking();
		expect(firstTracking).toHaveBeenCalledWith(true);
		expect(secondTracking).toHaveBeenCalledWith(true);

		unsubscribeFirst();
		service.stopTracking();

		expect(firstTracking).toHaveBeenCalledTimes(1);
		expect(secondTracking).toHaveBeenNthCalledWith(2, false);
	});
});
