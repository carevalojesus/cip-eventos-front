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

type CreateUserElements = {
	modal: HTMLElement | null;
	form: HTMLFormElement | null;
	openButton: HTMLButtonElement | null;
	closeButton: HTMLButtonElement | null;
	cancelButton: HTMLButtonElement | null;
	submitButton: HTMLButtonElement | null;
	errorBox: HTMLElement | null;
	successBox: HTMLElement | null;
	roleSelect: HTMLSelectElement | null;
	chapterSelect: HTMLSelectElement | null;
	passwordInput: HTMLInputElement | null;
	generatePasswordButton: HTMLButtonElement | null;
};

type CreateUserPayload = {
	email: string;
	password: string;
	roleId: string;
	chapterId?: string;
};

type SelectOption = {
	value: string;
	label: string;
};

type Role = {
	id?: string;
	name?: string;
	code?: string;
	description?: string;
};

type Chapter = {
	id?: string;
	name?: string;
};

const selectors = {
	body: "[data-users-table]",
	empty: "[data-users-empty]",
	template: "#user-row-template",
	error: "[data-users-error]",
};

const createSelectors = {
	modal: "[data-create-user-modal]",
	form: "#create-user-form",
	openButton: "[data-create-user-open]",
	closeButton: "[data-create-user-close]",
	cancelButton: "[data-create-user-cancel]",
	submitButton: "[data-create-user-submit]",
	errorBox: "[data-create-user-error]",
	successBox: "[data-create-user-success]",
	roleSelect: "[data-role-select]",
	chapterSelect: "[data-chapter-select]",
	passwordInput: "#create-password",
	generatePasswordButton: "[data-generate-password]",
};

const scriptTag = document.querySelector<HTMLScriptElement>('script[data-users-script]');
const scriptDataset = scriptTag?.dataset ?? {};

const parseLimit = (value: string | undefined, fallback: number) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const catalogEndpoints = {
	roles: scriptDataset.rolesEndpoint?.trim() || "/users/roles",
	chapters: scriptDataset.chaptersEndpoint?.trim() || "/chapters/active",
};

const catalogLimits = {
	chapters: parseLimit(scriptDataset.chaptersLimit, 100),
};

const getElements = (): TableElements => ({
	body: document.querySelector<HTMLElement>(selectors.body),
	emptyRow: document.querySelector<HTMLElement>(selectors.empty),
	template: document.querySelector<HTMLTemplateElement>(selectors.template),
	errorBox: document.querySelector<HTMLElement>(selectors.error),
});

const getCreateElements = (): CreateUserElements => ({
	modal: document.querySelector<HTMLElement>(createSelectors.modal),
	form: document.querySelector<HTMLFormElement>(createSelectors.form),
	openButton: document.querySelector<HTMLButtonElement>(createSelectors.openButton),
	closeButton: document.querySelector<HTMLButtonElement>(createSelectors.closeButton),
	cancelButton: document.querySelector<HTMLButtonElement>(createSelectors.cancelButton),
	submitButton: document.querySelector<HTMLButtonElement>(createSelectors.submitButton),
	errorBox: document.querySelector<HTMLElement>(createSelectors.errorBox),
	successBox: document.querySelector<HTMLElement>(createSelectors.successBox),
	roleSelect: document.querySelector<HTMLSelectElement>(createSelectors.roleSelect),
	chapterSelect: document.querySelector<HTMLSelectElement>(createSelectors.chapterSelect),
	passwordInput: document.querySelector<HTMLInputElement>(createSelectors.passwordInput),
	generatePasswordButton: document.querySelector<HTMLButtonElement>(createSelectors.generatePasswordButton),
});

const buildPathWithQuery = (path: string, query: Record<string, string | number | undefined> = {}) => {
	const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "");
	if (entries.length === 0) return path;
	const queryString = new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString();
	return `${path}${path.includes("?") ? "&" : "?"}${queryString}`;
};

const extractDataArray = <T>(payload: unknown): T[] => {
	if (Array.isArray(payload)) return payload as T[];
	if (typeof payload === "object" && payload !== null && Array.isArray((payload as { data?: unknown }).data)) {
		return ((payload as { data?: unknown }).data ?? []) as T[];
	}
	return [];
};

const lockBodyScroll = (shouldLock: boolean) => {
	if (shouldLock) {
		document.body.classList.add("overflow-hidden");
	} else {
		document.body.classList.remove("overflow-hidden");
	}
};

const setVisibility = (element: HTMLElement | null, shouldShow: boolean) => {
	if (!element) return;
	element.classList.toggle("hidden", !shouldShow);
	if (shouldShow) {
		element.classList.add("flex");
	} else {
		element.classList.remove("flex");
	}
};

const showModal = (elements: CreateUserElements) => {
	setVisibility(elements.modal, true);
	lockBodyScroll(true);
	elements.form?.reset();
	hideFeedback(elements);
};

const hideModal = (elements: CreateUserElements) => {
	setVisibility(elements.modal, false);
	lockBodyScroll(false);
	elements.form?.reset();
	hideFeedback(elements);
};

const showErrorMessage = (elements: CreateUserElements, message: string) => {
	if (!elements.errorBox) return;
	elements.errorBox.textContent = message;
	elements.errorBox.removeAttribute("hidden");
	elements.successBox?.setAttribute("hidden", "true");
};

const showSuccessMessage = (elements: CreateUserElements, message: string) => {
	if (!elements.successBox) return;
	elements.successBox.textContent = message;
	elements.successBox.removeAttribute("hidden");
	elements.errorBox?.setAttribute("hidden", "true");
};

const hideFeedback = (elements: CreateUserElements) => {
	elements.errorBox?.setAttribute("hidden", "true");
	elements.successBox?.setAttribute("hidden", "true");
};

const getSelectPlaceholder = (select: HTMLSelectElement | null) => {
	return select?.dataset.placeholder ?? (select?.required ? "Selecciona una opción" : "Opcional");
};

const setSelectMessage = (select: HTMLSelectElement | null, message: string, disable = true) => {
	if (!select) return;
	select.innerHTML = "";
	const option = document.createElement("option");
	option.value = "";
	option.textContent = message;
	option.selected = true;
	if (select.required) {
		option.disabled = true;
	}
	select.append(option);
	select.disabled = disable;
};

const populateSelect = (select: HTMLSelectElement | null, options: SelectOption[], placeholder?: string) => {
	if (!select) return;
	const label = placeholder ?? getSelectPlaceholder(select);
	select.innerHTML = "";

	const placeholderOption = document.createElement("option");
	placeholderOption.value = "";
	placeholderOption.textContent = label;
	placeholderOption.selected = true;
	if (select.required) {
		placeholderOption.disabled = true;
	}
	select.append(placeholderOption);

	options.forEach((option) => {
		if (!option.value) return;
		const optionEl = document.createElement("option");
		optionEl.value = option.value;
		optionEl.textContent = option.label;
		select.append(optionEl);
	});

	select.disabled = false;
};

const mapRolesToOptions = (roles: Role[]): SelectOption[] => {
	return roles
		.filter((role) => typeof role?.id === "string")
		.map((role) => ({
			value: role.id as string,
			label: textOrFallback(role.name ?? role.code, "Rol sin nombre"),
		}));
};

const mapChaptersToOptions = (chapters: Chapter[]): SelectOption[] => {
	return chapters
		.filter((chapter) => typeof chapter?.id === "string")
		.map((chapter) => ({
			value: chapter.id as string,
			label: textOrFallback(chapter.name, "Capítulo sin nombre"),
		}));
};

const fetchRolesCatalog = async () => {
	const response = await apiFetch(catalogEndpoints.roles, { method: "GET" });
	const payload = await response.json();
	return extractDataArray<Role>(payload);
};

const fetchChaptersCatalog = async () => {
	const response = await apiFetch(buildPathWithQuery(catalogEndpoints.chapters, { limit: catalogLimits.chapters }), {
		method: "GET",
	});
	const payload = await response.json();
	return extractDataArray<Chapter>(payload);
};

let catalogsLoaded = false;
let catalogsPromise: Promise<void> | null = null;

const loadCreateOptions = async (elements: CreateUserElements) => {
	const { roleSelect, chapterSelect } = elements;
	const rolePlaceholder = getSelectPlaceholder(roleSelect);
	const chapterPlaceholder = getSelectPlaceholder(chapterSelect);

	setSelectMessage(roleSelect, "Cargando roles...");
	setSelectMessage(chapterSelect, "Cargando capítulos...");

	try {
		const [roles, chapters] = await Promise.all([fetchRolesCatalog(), fetchChaptersCatalog()]);
		populateSelect(roleSelect, mapRolesToOptions(roles), rolePlaceholder);
		populateSelect(chapterSelect, mapChaptersToOptions(chapters), chapterPlaceholder);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "No se pudieron cargar las listas. Intenta nuevamente.";
		setSelectMessage(roleSelect, message);
		setSelectMessage(chapterSelect, message);
		throw error;
	}
};

const ensureCreateOptionsLoaded = (elements: CreateUserElements) => {
	if (catalogsLoaded) return Promise.resolve();
	if (!catalogsPromise) {
		catalogsPromise = loadCreateOptions(elements)
			.then(() => {
				catalogsLoaded = true;
			})
			.catch((error) => {
				catalogsPromise = null;
				throw error;
			});
	}
	return catalogsPromise;
};

const sanitizeFormValue = (value: FormDataEntryValue | string | null) => {
	if (typeof value !== "string") return "";
	return value.trim();
};

const buildCreatePayload = (form: HTMLFormElement): CreateUserPayload => {
	const formData = new FormData(form);
	const email = sanitizeFormValue(formData.get("email"));
	const password = sanitizeFormValue(formData.get("password"));
	const roleId = sanitizeFormValue(formData.get("roleId"));
	const chapterId = sanitizeFormValue(formData.get("chapterId"));

	const payload: CreateUserPayload = {
		email,
		password,
		roleId,
	};

	if (chapterId) payload.chapterId = chapterId;

	return payload;
};

const validateCreatePayload = (payload: CreateUserPayload) => {
	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailPattern.test(payload.email)) {
		return "Ingresa un correo electrónico válido.";
	}

	if (payload.password.length < 8) {
		return "La contraseña debe tener al menos 8 caracteres.";
	}

	if (!payload.roleId) {
		return "Debes indicar el ID del rol que tendrá el usuario.";
	}

	return "";
};

const setSubmitLoading = (button: HTMLButtonElement | null, isLoading: boolean) => {
	if (!button) return;
	button.disabled = isLoading;
	button.classList.toggle("opacity-70", isLoading);
	button.textContent = isLoading ? "Creando..." : "Crear usuario";
	button.setAttribute("aria-busy", String(isLoading));
	button.setAttribute("aria-disabled", String(isLoading));
};

const createUser = async (payload: CreateUserPayload) => {
	const response = await apiFetch("/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	return response.json();
};

const passwordAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%&*";

const generateSecurePassword = (length = 12) => {
	const chars = passwordAlphabet;
	let result = "";
	const cryptoObj = window.crypto || (window as unknown as { msCrypto?: Crypto }).msCrypto;
	if (cryptoObj?.getRandomValues) {
		const randomValues = new Uint32Array(length);
		cryptoObj.getRandomValues(randomValues);
		for (let i = 0; i < length; i++) {
			result += chars[randomValues[i] % chars.length];
		}
		return result;
	}
	for (let i = 0; i < length; i++) {
		const index = Math.floor(Math.random() * chars.length);
		result += chars[index];
	}
	return result;
};

const initCreateUserForm = (refresh: () => Promise<void>) => {
	const elements = getCreateElements();
	if (!elements.form || !elements.modal || !elements.submitButton || !elements.roleSelect || !elements.chapterSelect)
		return;

	const closeModal = () => hideModal(elements);

	const openModal = () => {
		showModal(elements);
		ensureCreateOptionsLoaded(elements).catch((error) => {
			showErrorMessage(
				elements,
				error instanceof Error ? error.message : "No se pudieron cargar las listas. Intenta nuevamente.",
			);
		});
	};

	elements.openButton?.addEventListener("click", openModal);
	elements.closeButton?.addEventListener("click", closeModal);
	elements.cancelButton?.addEventListener("click", closeModal);
	if (elements.generatePasswordButton && elements.passwordInput) {
		elements.generatePasswordButton.addEventListener("click", () => {
			const password = generateSecurePassword();
			elements.passwordInput!.value = password;
			elements.passwordInput!.focus();
			elements.passwordInput!.select();
		});
	}

	elements.modal.addEventListener("click", (event) => {
		if (event.target === elements.modal) {
			closeModal();
		}
	});

	elements.form.addEventListener("submit", async (event) => {
		event.preventDefault();

		hideFeedback(elements);

		const payload = buildCreatePayload(elements.form!);
		const validationMessage = validateCreatePayload(payload);
		if (validationMessage) {
			showErrorMessage(elements, validationMessage);
			return;
		}

		setSubmitLoading(elements.submitButton, true);

		try {
			await createUser(payload);
			showSuccessMessage(elements, "Usuario creado correctamente.");
			elements.form?.reset();
			await refresh();
		} catch (error) {
			showErrorMessage(
				elements,
				error instanceof Error ? error.message : "No se pudo crear el usuario. Intenta nuevamente.",
			);
		} finally {
			setSubmitLoading(elements.submitButton, false);
		}
	});

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !elements.modal?.classList.contains("hidden")) {
			closeModal();
		}
	});
};

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
	initCreateUserForm(initUsers);
}
