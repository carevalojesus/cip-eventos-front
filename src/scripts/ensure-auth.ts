import { ensureAuthenticated } from "@/lib/auth-client";

(() => {
	if (typeof window === "undefined") return;
	const scriptEl = document.querySelector<HTMLScriptElement>('script[data-ensure-auth]');
	const redirectPath = scriptEl?.dataset.redirectPath ?? "/login";
	ensureAuthenticated({ redirectTo: redirectPath });
})();
