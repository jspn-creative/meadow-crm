import type { HandleClientError } from "@sveltejs/kit/hooks";

export const handleError: HandleClientError = ({ kind, error }) => {
	if (kind === "unknown") return { message: "Something went wrong. Please try again." };
	return error;
};
