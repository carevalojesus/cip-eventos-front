import { apiFetch } from "@/lib/auth-client";
import { resolveAvatarUrl, textOrFallback } from "@/lib/profile-utils";

type AnyUser = Record<string, unknown> & {
	id?: string;
	email?: string;
	isActive?: boolean;
	role?: { name?: string; code?: string } | null;
	chapter?: { name?: string } | null;
	person?: {
		firstName?: string;
		lastName?: string;
		email?: string;
		avatarUrl?: string;
		avatar?: { url?: string | null } | null;
	} | null;
};

type TableElements = {
	body: HTMLElement | null;
	emptyRow: HTMLElement | null;
	template: HTMLTemplateElement | null;
	errorBox: HTMLElement | null;
};

const selectors = {
	body: "[data-users-table]",
	empty: "[data-users-empty]",
	template: "#user-row-template",
	error: "[data-users-error]",
};

const getElements = (): TableElements => ({
	body: document.querySelector<HTMLElement>(selectors.body),
	emptyRow: document.querySelector<HTMLElement>(selectors.empty),
	template: document.querySelector<HTMLTemplateElement>(selectors.template),
	errorBox: document.querySelector<HTMLElement>(selectors.error),
});

const clearBody = (body: HTMLElement | null) => {
	if (!body) return;
	body.innerHTML = "";
};

const buildDisplayName = (user: AnyUser) => {
	const fromProperties =
		textOrFallback(user.person?.firstName, "") +
		" " +
		textOrFallback(user.person?.lastName, "");
	const trimmed = fromProperties.trim();
	if (trimmed) return trimmed;
	return textOrFallback(user.person?.email ?? user.email, "Usuario sin nombre");
};

const buildTitle = (user: AnyUser) => {
	return textOrFallback(user.role?.name, "Rol sin definir");
};

const buildArea = (user: AnyUser) => {
	return textOrFallback(user.chapter?.name, "Capítulo sin asignar");
};

const buildStatus = (user: AnyUser) => {
	const isActive = user.isActive ?? true;
	return isActive ? "Activo" : "Inactivo";
};

const buildRole = (user: AnyUser) => {
	return textOrFallback(user.role?.code ?? user.role?.name, "Sin rol");
};

const buildEmail = (user: AnyUser) => {
	return textOrFallback(user.person?.email ?? user.email, "Sin correo");
};

const resolveAvatar = (user: AnyUser) => {
	return (
		resolveAvatarUrl(user.person ?? user) ??
		"https://ui-avatars.com/api/?background=D7B560&color=2A2A29&name=" + encodeURIComponent(buildDisplayName(user))
	);
};

const fetchUsers = async () => {
	const response = await apiFetch("/users", { method: "GET" });
	const payload = await response.json();
	if (Array.isArray(payload)) return payload as AnyUser[];
	if (Array.isArray(payload?.data)) return payload.data as AnyUser[];
	return [];
};

const showError = (errorBox: HTMLElement | null, message: string) => {
	if (!errorBox) return;
	errorBox.textContent = message;
	errorBox.removeAttribute("hidden");
};

const hideError = (errorBox: HTMLElement | null) => {
	errorBox?.setAttribute("hidden", "true");
};

const renderUsers = (elements: TableElements, users: AnyUser[]) => {
	const { body, emptyRow, template } = elements;
	if (!body || !template) return;

	clearBody(body);

	if (users.length === 0) {
		emptyRow?.removeAttribute("hidden");
		body.append(emptyRow ?? "");
		return;
	}

	emptyRow?.setAttribute("hidden", "true");

	const fragment = document.createDocumentFragment();

	users.forEach((user) => {
		const clone = template.content.cloneNode(true) as DocumentFragment;
		const nameEl = clone.querySelector<HTMLElement>("[data-user-name]");
		const emailEl = clone.querySelector<HTMLElement>("[data-user-email]");
		const titleEl = clone.querySelector<HTMLElement>("[data-user-title]");
		const areaEl = clone.querySelector<HTMLElement>("[data-user-area]");
		const statusEl = clone.querySelector<HTMLElement>("[data-user-status]");
		const roleEl = clone.querySelector<HTMLElement>("[data-user-role]");
		const avatarEl = clone.querySelector<HTMLImageElement>("[data-user-avatar]");
		const actionEl = clone.querySelector<HTMLElement>("[data-user-action]");

		const name = buildDisplayName(user);
		const email = buildEmail(user);
		const title = buildTitle(user);
		const area = buildArea(user);
		const status = buildStatus(user);
		const role = buildRole(user);
		const avatarUrl = resolveAvatar(user);

		if (nameEl) nameEl.textContent = name;
		if (emailEl) emailEl.textContent = email;
		if (titleEl) titleEl.textContent = title;
		if (areaEl) areaEl.textContent = area;
		if (statusEl) statusEl.textContent = status;
		if (roleEl) roleEl.textContent = role;
		if (avatarEl) {
			avatarEl.src = avatarUrl;
			avatarEl.alt = `Foto de ${name}`;
		}
		if (actionEl) actionEl.setAttribute("aria-label", `Editar ${name}`);

		fragment.append(clone);
	});

	body.append(fragment);
};

const initUsers = async () => {
	const elements = getElements();
	try {
		hideError(elements.errorBox);
		const users = await fetchUsers();
		renderUsers(elements, users);
	} catch (error) {
		showError(
			elements.errorBox,
			error instanceof Error ? error.message : "No se pudieron cargar los usuarios. Intenta nuevamente.",
		);
	}
};

if (typeof window !== "undefined") {
	initUsers();
}
