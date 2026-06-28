import type { CallHandler, ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { of } from "rxjs";
import type { AppConfig } from "../../config/app-config";
import type { AuthenticatedUser } from "../authenticated-user";
import { SessionRefreshInterceptor } from "./session-refresh.interceptor";

const COOKIE = "routess_session";

function makeConfig(): AppConfig {
	return {
		app: { isProduction: false },
		auth: { cookieName: COOKIE, sessionTtlMs: 7 * 24 * 60 * 60 * 1000 },
	} as unknown as AppConfig;
}

function makeJwt(signed = "fresh.jwt.token") {
	return { sign: jest.fn(() => signed) } as unknown as JwtService;
}

const cookieUser: AuthenticatedUser = {
	id: 1,
	email: "a@b.com",
	name: "A",
	isEmailVerified: true,
	role: "user",
	authMethod: "cookie",
	jti: "jti-1",
};

function run(opts: {
	user?: AuthenticatedUser;
	requestCookie?: string;
	responseSetCookie?: string | string[];
	headersSent?: boolean;
	jwt?: JwtService;
}): Promise<{ cookie: jest.Mock }> {
	const cookie = jest.fn();
	const response = {
		cookie,
		headersSent: opts.headersSent ?? false,
		getHeader: (_name: string) => opts.responseSetCookie,
	};
	const request = {
		user: opts.user,
		headers: { cookie: opts.requestCookie },
	};
	const context = {
		getType: () => "http",
		switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
	} as unknown as ExecutionContext;
	const next: CallHandler = { handle: () => of({ ok: true }) };

	const interceptor = new SessionRefreshInterceptor(opts.jwt ?? makeJwt(), makeConfig());
	return new Promise((resolve) => {
		interceptor.intercept(context, next).subscribe({ complete: () => resolve({ cookie }) });
	});
}

describe("SessionRefreshInterceptor (rolling session)", () => {
	it("re-issues the session cookie for a cookie-authenticated request", async () => {
		const { cookie } = await run({ user: cookieUser, requestCookie: `${COOKIE}=old.jwt` });
		expect(cookie).toHaveBeenCalledTimes(1);
		expect(cookie.mock.calls[0]?.[0]).toBe(COOKIE);
		expect(cookie.mock.calls[0]?.[1]).toBe("fresh.jwt.token");
	});

	it("does nothing for an unauthenticated request", async () => {
		const { cookie } = await run({ user: undefined, requestCookie: undefined });
		expect(cookie).not.toHaveBeenCalled();
	});

	it("does nothing for a PAT-authenticated request", async () => {
		const { cookie } = await run({
			user: { ...cookieUser, authMethod: "pat" },
			requestCookie: `${COOKIE}=old.jwt`,
		});
		expect(cookie).not.toHaveBeenCalled();
	});

	it("does nothing when the request carried no session cookie (bearer JWT)", async () => {
		const { cookie } = await run({ user: cookieUser, requestCookie: undefined });
		expect(cookie).not.toHaveBeenCalled();
	});

	it("yields to a handler that already wrote the cookie (logout/login)", async () => {
		const { cookie } = await run({
			user: cookieUser,
			requestCookie: `${COOKIE}=old.jwt`,
			responseSetCookie: `${COOKIE}=; Max-Age=0`,
		});
		expect(cookie).not.toHaveBeenCalled();
	});

	it("does not write after the response body already streamed", async () => {
		const { cookie } = await run({ user: cookieUser, requestCookie: `${COOKIE}=old.jwt`, headersSent: true });
		expect(cookie).not.toHaveBeenCalled();
	});
});
