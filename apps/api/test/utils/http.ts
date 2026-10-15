import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// A fetch-based stand-in for the slice of supertest the API tests use:
// request(app.getHttpServer()).post(path).set(...).send(...).expect(status).
// The first request binds the Nest HTTP server to an ephemeral port; it stays
// bound until the test closes the app (app.close() closes the server).

export type TestResponse = {
	status: number;
	headers: Record<string, string>;
	text: string;
	body: any;
};

type Expectation = (response: TestResponse) => void;

export class TestRequest implements PromiseLike<TestResponse> {
	private readonly headers = new Headers();
	private payload: string | undefined;
	private binary = false;
	private readonly expectations: Expectation[] = [];

	constructor(
		private readonly server: Server,
		private readonly method: string,
		private readonly path: string,
	) {}

	set(name: string | Record<string, string>, value?: string): this {
		const entries = typeof name === "string" ? [[name, value ?? ""]] : Object.entries(name);
		for (const [key, headerValue] of entries) {
			this.headers.set(key, headerValue);
		}
		return this;
	}

	send(body?: unknown): this {
		if (body === undefined) return this;
		if (typeof body === "string") {
			this.payload = body;
			if (!this.headers.has("content-type")) this.headers.set("content-type", "application/x-www-form-urlencoded");
		} else {
			this.payload = JSON.stringify(body);
			if (!this.headers.has("content-type")) this.headers.set("content-type", "application/json");
		}
		return this;
	}

	/** Keeps the response body as a Buffer instead of parsing it. */
	responseType(_type: "blob"): this {
		this.binary = true;
		return this;
	}

	expect(statusOrCheck: number | Expectation): this {
		if (typeof statusOrCheck === "function") {
			this.expectations.push(statusOrCheck);
		} else {
			this.expectations.push((response) => {
				if (response.status !== statusOrCheck) {
					throw new Error(
						`expected ${statusOrCheck}, got ${response.status} for ${this.method} ${this.path}: ${response.text}`,
					);
				}
			});
		}
		return this;
	}

	// biome-ignore lint/suspicious/noThenProperty: awaiting a request sends it, as with supertest
	then<TResult1 = TestResponse, TResult2 = never>(
		onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}

	private async execute(): Promise<TestResponse> {
		const port = await listeningPort(this.server);
		const res = await fetch(`http://127.0.0.1:${port}${this.path}`, {
			method: this.method,
			headers: this.headers,
			body: this.payload,
			redirect: "manual",
			keepalive: false,
		});
		const raw = Buffer.from(await res.arrayBuffer());
		const text = this.binary ? "" : raw.toString("utf8");
		const response: TestResponse = {
			status: res.status,
			headers: Object.fromEntries(res.headers),
			text,
			body: this.binary ? raw : parseBody(text, res.headers.get("content-type")),
		};
		for (const check of this.expectations) check(response);
		return response;
	}
}

const listening = new WeakMap<Server, Promise<number>>();

function listeningPort(server: Server): Promise<number> {
	let port = listening.get(server);
	if (!port) {
		port = new Promise<number>((resolve) => {
			const address = server.address() as AddressInfo | null;
			if (address) return resolve(address.port);
			server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
		});
		listening.set(server, port);
	}
	return port;
}

function parseBody(text: string, contentType: string | null): unknown {
	if (contentType?.includes("json") && text.length > 0) {
		return JSON.parse(text);
	}
	return {};
}

export default function request(server: Server) {
	const verb = (method: string) => (path: string) => new TestRequest(server, method, path);
	return {
		get: verb("GET"),
		post: verb("POST"),
		put: verb("PUT"),
		patch: verb("PATCH"),
		delete: verb("DELETE"),
		head: verb("HEAD"),
		options: verb("OPTIONS"),
	};
}
