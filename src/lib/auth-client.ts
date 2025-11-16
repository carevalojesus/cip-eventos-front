const API_BASE_URL = (import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TOKEN_KEYS = {
	access: "cipAccessToken",
	refresh: "cipRefreshToken",
} as const;

const isBrowser = typeof window !== "undefined";

type LoginCredentials = {
	email: FormDataEntryValue | string | null;
	password: FormDataEntryValue | string | null;
};

type LoginResponse = {
	accessToken: string;
	refreshToken?: string;
};

const buildUrl = (path: string) => {
	if (path.startsWith("http")) return path;
	return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

const readToken = (key: string) => {
	if (!isBrowser) return null;
	return localStorage.getItem(key);
};

const writeToken = (key: string, value?: string) => {
	if (!isBrowser || !value) return;
	localStorage.setItem(key, value);
};

export const getAccessToken = () => readToken(TOKEN_KEYS.access);
export const getRefreshToken = () => readToken(TOKEN_KEYS.refresh);

export const saveTokens = (tokens: LoginResponse) => {
	writeToken(TOKEN_KEYS.access, tokens.accessToken);
	if (tokens.refreshToken) {
		writeToken(TOKEN_KEYS.refresh, tokens.refreshToken);
	}
};

export const clearTokens = () => {
	if (!isBrowser) return;
	localStorage.removeItem(TOKEN_KEYS.access);
	localStorage.removeItem(TOKEN_KEYS.refresh);
};

const extractErrorMessage = async (response: Response) => {
	try {
		const payload = await response.json();
		const message = payload?.message ?? "Ocurrió un error inesperado.";
		return Array.isArray(message) ? message.join(", ") : message;
	} catch {
		return "Ocurrió un error inesperado.";
	}
};

export const apiFetch = async (
	path: string,
	options: RequestInit = {},
	{ requiresAuth = true }: { requiresAuth?: boolean } = {},
) => {
	const headers = new Headers(options.headers ?? {});
	if (requiresAuth) {
		const accessToken = getAccessToken();
		if (accessToken) {
			headers.set("Authorization", `Bearer ${accessToken}`);
		}
	}

	const response = await fetch(buildUrl(path), {
		...options,
		headers,
	});

	if (!response.ok) {
		throw new Error(await extractErrorMessage(response));
	}

	return response;
};

export const login = async ({ email, password }: LoginCredentials) => {
	const response = await fetch(buildUrl("/auth/login"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!response.ok) {
		throw new Error(await extractErrorMessage(response));
	}

	const payload: LoginResponse = await response.json();
	saveTokens(payload);
	return payload;
};

export const getProfile = async () => {
	const response = await apiFetch("/auth/profile", {
		method: "GET",
	});
	return response.json();
};

export const ensureAuthenticated = async ({ redirectTo = "/login" } = {}) => {
	if (!isBrowser) return;
	const redirect = () => {
		clearTokens();
		window.location.href = redirectTo;
	};

	const token = getAccessToken();
	if (!token) {
		redirect();
		return;
	}

	try {
		await getProfile();
	} catch {
		redirect();
	}
};
