import { ensureAuthenticated, type UserProfile } from "@/lib/auth-client";

type PanelElements = {
	name?: NodeListOf<HTMLElement>;
	email?: NodeListOf<HTMLElement>;
	initials?: NodeListOf<HTMLElement>;
	avatar?: NodeListOf<HTMLImageElement>;
};

const selectors = {
	name: "[data-panel-user-name]",
	email: "[data-panel-user-email]",
	initials: "[data-panel-user-initials]",
	avatar: "[data-panel-user-avatar]",
};

const getElements = (): PanelElements => ({
	name: document.querySelectorAll<HTMLElement>(selectors.name),
	email: document.querySelectorAll<HTMLElement>(selectors.email),
	initials: document.querySelectorAll<HTMLElement>(selectors.initials),
	avatar: document.querySelectorAll<HTMLImageElement>(selectors.avatar),
});

const textOrFallback = (value: unknown, fallback: string) => {
	return typeof value === "string" && value.trim().length > 0 ? value : fallback;
};

const resolveAvatarUrl = (profile: UserProfile) => {
	const directValue =
		profile.avatarUrl ??
		// allow alternative property names that might come from la API
		(profile as Record<string, unknown>).avatarURL ??
		(profile as Record<string, unknown>).photoUrl ??
		(profile as Record<string, unknown>).photo;

	if (typeof directValue === "string" && directValue.trim().length > 0) {
		return directValue;
	}

	const avatar = (profile as Record<string, unknown>).avatar;
	if (avatar && typeof avatar === "object" && "url" in avatar) {
		const value = (avatar as { url?: string }).url;
		if (value && value.trim().length > 0) {
			return value;
		}
	}

	return null;
};

const buildInitials = (displayName: string) => {
	return displayName
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((chunk) => chunk.charAt(0).toUpperCase())
		.join("")
		|| "US";
};

const updateElements = (nodes: NodeListOf<HTMLElement> | undefined, value: string) => {
	nodes?.forEach((node) => {
		node.textContent = value;
	});
};

const updateAvatarElements = (avatars: NodeListOf<HTMLImageElement> | undefined, url: string | null) => {
	let hasAvatar = false;
	avatars?.forEach((img) => {
		if (url) {
			hasAvatar = true;
			img.src = url;
			img.alt = "Foto de perfil";
			img.removeAttribute("hidden");
			img.classList.remove("hidden");
		} else {
			img.src = "";
			img.classList.add("hidden");
		}
	});
	return hasAvatar;
};

const toggleInitialsVisibility = (nodes: NodeListOf<HTMLElement> | undefined, shouldShow: boolean) => {
	nodes?.forEach((node) => {
		node.classList.toggle("hidden", !shouldShow);
	});
};

const initPanel = async () => {
	const profile = await ensureAuthenticated({ redirectTo: "/login" });
	if (!profile) return;

	const displayName = textOrFallback(profile.fullName ?? profile.name, profile.email ?? "Usuario CIP");
	const email = textOrFallback(profile.email, "Sin correo disponible");
	const avatarUrl = resolveAvatarUrl(profile);
	const initials = buildInitials(displayName);

	const elements = getElements();
	updateElements(elements.name, displayName);
	updateElements(elements.email, email);
	updateElements(elements.initials, initials);
	const hasAvatar = updateAvatarElements(elements.avatar, avatarUrl);
	toggleInitialsVisibility(elements.initials, !hasAvatar);
};

if (typeof window !== "undefined") {
	initPanel();
}
