interface JwtPayload {
	userId: string;
	email: string;
}

export const mockAuthService = {
	verifyGoogleToken: jest.fn(),
	generateJwtToken: jest.fn((payload: JwtPayload) => {
		return `mock-jwt-token-${payload.userId}`;
	}),
};

export const createMockAuthService = () => ({
	...mockAuthService,
	verifyGoogleToken: jest.fn(),
	generateJwtToken: jest.fn((payload: JwtPayload) => {
		return `mock-jwt-token-${payload.userId}`;
	}),
});
