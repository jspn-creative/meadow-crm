/** Closes a modal from its backdrop where the browser lacks `closedby="any"`, firing `cancel` first so the dialog's existing guards still apply. */
export function lightDismiss(dialog: HTMLDialogElement) {
	if ("closedBy" in HTMLDialogElement.prototype) return;
	let armed = false;
	const onBackdrop = (event: MouseEvent) => {
		const box = dialog.getBoundingClientRect();
		return (
			event.target === dialog &&
			(event.clientX < box.left ||
				event.clientX > box.right ||
				event.clientY < box.top ||
				event.clientY > box.bottom)
		);
	};
	const onpointerdown = (event: PointerEvent) => {
		// An open popover takes this press to dismiss itself; a drag that began inside the dialog is never armed.
		armed = onBackdrop(event) && !dialog.querySelector(":popover-open");
	};
	const onclick = (event: MouseEvent) => {
		if (armed && onBackdrop(event) && dialog.dispatchEvent(new Event("cancel", { cancelable: true })))
			dialog.close();
		armed = false;
	};
	dialog.addEventListener("pointerdown", onpointerdown);
	dialog.addEventListener("click", onclick);
	return () => {
		dialog.removeEventListener("pointerdown", onpointerdown);
		dialog.removeEventListener("click", onclick);
	};
}
