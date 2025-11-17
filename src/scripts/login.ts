import { login } from "@/lib/auth-client";

type Options = {
	redirectPath?: string;
};

const initLogin = ({ redirectPath = "/panel" }: Options = {}) => {
	const form = document.getElementById("login-form") as HTMLFormElement | null;
	const submitButton = document.getElementById("login-submit") as HTMLButtonElement | null;
	const errorBox = document.getElementById("login-error");
	const errorText = errorBox?.querySelector<HTMLElement>("[data-error-text]");
	const emailInput = document.getElementById("email") as HTMLInputElement | null;
	const passwordInput = document.getElementById("password") as HTMLInputElement | null;

	if (!form || !submitButton || !emailInput || !passwordInput || !errorBox || !errorText) return;

	const toggleLoading = (isLoading: boolean) => {
		submitButton.disabled = isLoading;
		submitButton.classList.toggle("opacity-70", isLoading);
		submitButton.textContent = isLoading ? "Ingresando..." : "Iniciar sesión";
		submitButton.setAttribute("aria-busy", String(isLoading));
		submitButton.setAttribute("aria-disabled", String(isLoading));
	};

	const showError = (message: string) => {
		errorText.textContent = message || "Sin mensajes nuevos.";
		errorBox.toggleAttribute("hidden", !message);
	};

	const setFieldValidity = (input: HTMLInputElement, hasError: boolean) => {
		input.setAttribute("aria-invalid", String(hasError));
		input.classList.toggle("outline-red-400", hasError);
	};

	const validateForm = () => {
		let message = "";
		const emailValue = emailInput.value.trim();
		const passwordValue = passwordInput.value.trim();

		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const isEmailValid = emailPattern.test(emailValue);
		setFieldValidity(emailInput, !isEmailValid);

		if (!isEmailValid) {
			message = "Ingresa un correo electrónico válido.";
			return message;
		}

		const isPasswordValid = passwordValue.length >= 8;
		setFieldValidity(passwordInput, !isPasswordValid);

		if (!isPasswordValid) {
			message = "La contraseña debe tener al menos 8 caracteres.";
			return message;
		}

		return message;
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		const formData = new FormData(form);
		const email = formData.get("email");
		const password = formData.get("password");

		showError("");

		const validationMessage = validateForm();
		if (validationMessage) {
			showError(validationMessage);
			return;
		}

		toggleLoading(true);

		try {
			await login({ email, password });
			window.location.href = redirectPath;
		} catch (error) {
			showError(error instanceof Error ? error.message : "Ocurrió un error inesperado. Intenta nuevamente.");
		} finally {
			toggleLoading(false);
		}
	});
};

(() => {
	if (typeof window === "undefined") return;
	const scriptEl = document.querySelector<HTMLScriptElement>('script[data-login-script]');
	const redirectPath = scriptEl?.dataset.redirectPath?.trim();
	initLogin({ redirectPath: redirectPath || undefined });
})();
