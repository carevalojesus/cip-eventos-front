export type AvatarSource = Record<string, unknown> & {
	avatarUrl?: string | null;
	avatar?: { url?: string | null } | null;
	photoUrl?: string | null;
	photo?: string | null;
	imageUrl?: string | null;
};

export const textOrFallback = (value: unknown, fallback: string) => {
	return typeof value === "string" && value.trim().length > 0 ? value : fallback;
};

export const buildInitials = (displayName: string) => {
	return (
		displayName
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((chunk) => chunk.charAt(0).toUpperCase())
			.join("") || "US"
	);
};

export const resolveAvatarUrl = (profile: AvatarSource) => {
	const potential =
		profile.avatarUrl ??
		profile.imageUrl ??
		profile.photoUrl ??
		profile.photo ??
		(profile as Record<string, unknown>).avatarURL;

	if (typeof potential === "string" && potential.trim().length > 0) {
		return potential;
	}

	const avatar = profile.avatar;
	if (avatar && typeof avatar === "object" && "url" in avatar) {
		const value = (avatar as { url?: string | null }).url;
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	return null;
};
