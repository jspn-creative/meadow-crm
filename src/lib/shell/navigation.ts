import { LayoutDashboard, Columns3, ContactRound } from "@lucide/svelte";

export const destinations = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/pipeline", label: "Pipeline", icon: Columns3 },
	{ href: "/registry", label: "Registry", icon: ContactRound },
] as const;

export function workspaceDestination(value: string | null) {
	return ["/tasks", "/inbox", "/settings"].includes(value ?? "") ||
		destinations.some((destination) => destination.href === value)
		? value!
		: "/";
}
