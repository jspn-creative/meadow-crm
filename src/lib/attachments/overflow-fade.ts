export type OverflowState = {
	overflowLeft: boolean;
	overflowRight: boolean;
	overflowTop: boolean;
	overflowBottom: boolean;
};

export type FadeAxis = "x" | "y" | "both";
export type FadeSides = "both" | "start" | "end";

export type OverflowCheckOptions = {
	axis: FadeAxis;
	sides?: FadeSides;
	onOverflow?: (state: OverflowState) => void;
};

export type OverflowFadeOptions = {
	axis: FadeAxis;
	sides?: FadeSides;
	/** Fade size as percent of the scrollable dimension (default 10). */
	fadePercent?: number;
	/**
	 * External scroller that drives the mask on an element which never scrolls itself
	 * (e.g. content faded by an ancestor scroll container). The gradient is rebuilt in
	 * pixels from where the source viewport sits over the target, so the fade always
	 * hugs the visible edges; the fade tracks scroll 1:1 with no transitioning custom
	 * properties. Omit for the default self-scrolled behavior.
	 */
	scrollSource?: HTMLElement | ((element: HTMLElement) => HTMLElement | null);
	/**
	 * Driven mode only: pixels at the top of the source viewport that stay fully visible before the top fade begins, such as a sticky header inside the masked content. Read on every update.
	 */
	startInset?: (source: HTMLElement) => number;
};

type Edge = "top" | "bottom" | "left" | "right";
type EdgeFlags = Record<Edge, boolean>;

const STYLE_ATTR = "data-overflow-fade-styles";
const THROTTLE_MS = 100;
const FADE_TRANSITION_MS = 400;
const DEFAULT_FADE_PERCENT = 10;

function activeEdges(axis: FadeAxis, sides: FadeSides = "both"): EdgeFlags {
	const wantY = axis === "y" || axis === "both";
	const wantX = axis === "x" || axis === "both";
	const checkStart = sides !== "end";
	const checkEnd = sides !== "start";
	return {
		top: wantY && checkStart,
		bottom: wantY && checkEnd,
		left: wantX && checkStart,
		right: wantX && checkEnd,
	};
}

function checkOverflow(
	element: HTMLElement,
	axis: FadeAxis,
	sides: FadeSides = "both",
): OverflowState {
	const state: OverflowState = {
		overflowLeft: false,
		overflowRight: false,
		overflowTop: false,
		overflowBottom: false,
	};
	const edges = activeEdges(axis, sides);
	if (edges.top) state.overflowTop = Math.floor(element.scrollTop) > 0;
	if (edges.bottom)
		state.overflowBottom =
			Math.round(element.clientHeight + element.scrollTop) < element.scrollHeight;
	if (edges.left) state.overflowLeft = Math.floor(element.scrollLeft) > 0;
	if (edges.right)
		state.overflowRight = Math.round(element.clientWidth + element.scrollLeft) < element.scrollWidth;
	return state;
}

function rafThrottle<T extends unknown[]>(func: (...args: T) => void) {
	let rafId: number | null = null;

	function run(...args: T) {
		if (rafId !== null) return;
		rafId = requestAnimationFrame(() => {
			func(...args);
			rafId = null;
		});
	}

	function cancel() {
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
	}

	return Object.assign(run, { cancel });
}

function throttle<T extends unknown[]>(delay: number, func: (...args: T) => void) {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastExecTime = 0;

	function run(...args: T) {
		const currentTime = Date.now();
		if (currentTime - lastExecTime > delay) {
			func(...args);
			lastExecTime = currentTime;
			return;
		}
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(
			() => {
				func(...args);
				lastExecTime = Date.now();
				timeoutId = null;
			},
			delay - (currentTime - lastExecTime),
		);
	}

	function cancel() {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = null;
	}

	return Object.assign(run, { cancel });
}

function createOverflowChecker(element: HTMLElement, options: OverflowCheckOptions) {
	const { axis, sides = "both", onOverflow } = options;

	const handleOverflowCheck = () => {
		const state = checkOverflow(element, axis, sides);
		onOverflow?.(state);
		element.dispatchEvent(new CustomEvent<OverflowState>("overflow", { detail: state }));
	};

	const throttledCheck = throttle(THROTTLE_MS, handleOverflowCheck);
	const scrollCheck = rafThrottle(handleOverflowCheck);

	const mutationObserver = new MutationObserver(throttledCheck);
	mutationObserver.observe(element, { childList: true, subtree: true });

	const resizeObserver = new ResizeObserver(throttledCheck);
	resizeObserver.observe(element);

	element.addEventListener("scroll", scrollCheck, { passive: true });
	queueMicrotask(handleOverflowCheck);

	return {
		destroy() {
			throttledCheck.cancel();
			scrollCheck.cancel();
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			element.removeEventListener("scroll", scrollCheck);
		},
	};
}

function ensureMaskStyles() {
	if (typeof document === "undefined") return;
	if (document.querySelector(`style[${STYLE_ATTR}]`)) return;

	const styleElement = document.createElement("style");
	styleElement.setAttribute(STYLE_ATTR, "");
	styleElement.textContent = `
		@property --fade-top {
			syntax: '<number>';
			initial-value: 0;
			inherits: false;
		}
		@property --fade-bottom {
			syntax: '<number>';
			initial-value: 100;
			inherits: false;
		}
		@property --fade-left {
			syntax: '<number>';
			initial-value: 0;
			inherits: false;
		}
		@property --fade-right {
			syntax: '<number>';
			initial-value: 100;
			inherits: false;
		}
	`;
	document.head.appendChild(styleElement);
}

function setupMaskCSS(element: HTMLElement, axis: FadeAxis, animate = true) {
	ensureMaskStyles();

	element.style.setProperty("--fade-top", "0");
	element.style.setProperty("--fade-bottom", "100");
	element.style.setProperty("--fade-left", "0");
	element.style.setProperty("--fade-right", "100");
	// Driven masks update on every scroll frame via rAF, so transitioning the
	// custom properties would lag a full animation behind the scroll position and
	// repaint the whole masked layer each frame. Track scroll 1:1 instead.
	element.style.transition = animate
		? `--fade-top ${FADE_TRANSITION_MS}ms ease-out, --fade-bottom ${FADE_TRANSITION_MS}ms ease-out, --fade-left ${FADE_TRANSITION_MS}ms ease-out, --fade-right ${FADE_TRANSITION_MS}ms ease-out`
		: "none";

	const vertical = `linear-gradient(to bottom,
		transparent 0%,
		black calc(var(--fade-top) * 1%),
		black calc(var(--fade-bottom) * 1%),
		transparent 100%)`;
	const horizontal = `linear-gradient(to right,
		transparent 0%,
		black calc(var(--fade-left) * 1%),
		black calc(var(--fade-right) * 1%),
		transparent 100%)`;

	if (axis === "both") {
		const gradient = `${vertical}, ${horizontal}`;
		element.style.maskImage = gradient;
		element.style.webkitMaskImage = gradient;
		element.style.setProperty("mask-composite", "intersect");
		element.style.setProperty("-webkit-mask-composite", "source-in");
		return;
	}

	const gradient = axis === "y" ? vertical : horizontal;
	element.style.maskImage = gradient;
	element.style.webkitMaskImage = gradient;
	element.style.removeProperty("mask-composite");
	element.style.removeProperty("-webkit-mask-composite");
}

function proportionalFade(offset: number, range: number, max: number): number {
	if (offset <= 0 || range <= 0) return 0;
	return Math.min(max, (offset / range) * max);
}

function updateMaskFades(
	target: HTMLElement,
	source: HTMLElement,
	axis: FadeAxis,
	sides: FadeSides,
	fadePercent: number,
	cache?: Map<string, string>,
) {
	const edges = activeEdges(axis, sides);
	// Scroll metrics come from the source, but the gradient stops are percentages
	// of the masked target's box, so scale the fade to target-relative percent.
	const scaleY = target.clientHeight > 0 ? source.clientHeight / target.clientHeight : 0;
	const scaleX = target.clientWidth > 0 ? source.clientWidth / target.clientWidth : 0;
	const fadeRangeY = source.clientHeight * (fadePercent / 100);
	const fadeRangeX = source.clientWidth * (fadePercent / 100);
	const scrollBottom = source.scrollHeight - source.clientHeight - source.scrollTop;
	const scrollRight = source.scrollWidth - source.clientWidth - source.scrollLeft;

	const set = (property: string, value: number) => {
		const text = value.toFixed(2);
		if (cache?.get(property) === text) return;
		cache?.set(property, text);
		target.style.setProperty(property, text);
	};

	if (edges.top)
		set("--fade-top", proportionalFade(source.scrollTop, fadeRangeY, fadePercent * scaleY));
	if (edges.bottom)
		set("--fade-bottom", 100 - proportionalFade(scrollBottom, fadeRangeY, fadePercent * scaleY));
	if (edges.left)
		set("--fade-left", proportionalFade(source.scrollLeft, fadeRangeX, fadePercent * scaleX));
	if (edges.right)
		set("--fade-right", 100 - proportionalFade(scrollRight, fadeRangeX, fadePercent * scaleX));
}

function px(value: number): string {
	return `${Math.max(0, value).toFixed(1)}px`;
}

/**
 * Driven-mode gradient for one axis. Stops are pixels in the masked target's own
 * box, derived from where the source viewport currently sits over it, so the fade
 * always hugs the visible edges no matter how much taller the target is than the
 * viewport. Percentage stops cannot do this: they pin the fade to fractions of the
 * target box, which scroll out of view on tall content and leave no visible fade.
 */
function drivenAxisGradient(
	direction: "to bottom" | "to right",
	viewportStart: number,
	viewportSize: number,
	targetSize: number,
	band: number,
	fadeStart: boolean,
	fadeEnd: boolean,
	startInset = 0,
): string {
	const viewportEnd = viewportStart + viewportSize;
	const startFade = fadeStart ? Math.min(band, Math.max(0, viewportStart)) : 0;
	const endFade = fadeEnd ? Math.min(band, Math.max(0, targetSize - viewportEnd)) : 0;
	// An inset keeps the band above the fade opaque, so a sticky header stays solid and content fades in beneath it.
	const fadeFrom = viewportStart + startInset;
	const stops = !fadeStart
		? ["black 0px"]
		: startInset > 0
			? [`black ${px(fadeFrom)}`, `transparent ${px(fadeFrom)}`, `black ${px(fadeFrom + startFade)}`]
			: [`transparent ${px(viewportStart)}`, `black ${px(viewportStart + startFade)}`];
	if (fadeEnd) stops.push(`black ${px(viewportEnd - endFade)}`, `transparent ${px(viewportEnd)}`);
	return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

function updateDrivenMask(
	target: HTMLElement,
	source: HTMLElement,
	axis: FadeAxis,
	sides: FadeSides,
	fadePercent: number,
	cache?: Map<string, string>,
	startInset = 0,
) {
	const edges = activeEdges(axis, sides);
	const targetRect = target.getBoundingClientRect();
	const sourceRect = source.getBoundingClientRect();
	const bandY = (source.clientHeight * fadePercent) / 100;
	const bandX = (source.clientWidth * fadePercent) / 100;

	const gradients: string[] = [];
	if (axis !== "x")
		gradients.push(
			drivenAxisGradient(
				"to bottom",
				sourceRect.top - targetRect.top,
				source.clientHeight,
				targetRect.height,
				bandY,
				edges.top,
				edges.bottom,
				startInset,
			),
		);
	if (axis !== "y")
		gradients.push(
			drivenAxisGradient(
				"to right",
				sourceRect.left - targetRect.left,
				source.clientWidth,
				targetRect.width,
				bandX,
				edges.left,
				edges.right,
			),
		);

	const mask = gradients.join(", ");
	if (cache?.get("mask") === mask) return;
	cache?.set("mask", mask);
	target.style.maskImage = mask;
	target.style.webkitMaskImage = mask;
}

/** Attachment that observes scroll overflow and dispatches an `overflow` CustomEvent. */
export function isOverflowing(options: OverflowCheckOptions) {
	return (element: HTMLElement) => {
		const { destroy } = createOverflowChecker(element, options);
		return destroy;
	};
}

/** Attachment that fades overflowing edges with a CSS mask. */
export function overflowFade(options: OverflowFadeOptions) {
	return (element: HTMLElement) => {
		const axis = options.axis;
		const sides = options.sides ?? "both";
		const fadePercent = options.fadePercent ?? DEFAULT_FADE_PERCENT;
		const originalStyle = element.style.cssText;
		const driven = options.scrollSource !== undefined;
		const resolveSource = (): HTMLElement => {
			if (typeof options.scrollSource === "function") return options.scrollSource(element) ?? element;
			return options.scrollSource ?? element;
		};

		setupMaskCSS(element, axis, !driven);

		if (!driven) {
			const { destroy } = createOverflowChecker(element, {
				axis,
				sides,
				onOverflow: () => updateMaskFades(element, element, axis, sides, fadePercent),
			});

			return () => {
				destroy();
				element.style.cssText = originalStyle;
			};
		}

		// Driven mode: the scroll listener lives on the source, while resizes and
		// mutations of either box re-derive the fade. The write cache keeps
		// observer churn during enter animations and font loads from invalidating
		// styles when the values have not changed.
		const cache = new Map<string, string>();
		const update = () => {
			const source = resolveSource();
			updateDrivenMask(
				element,
				source,
				axis,
				sides,
				fadePercent,
				cache,
				options.startInset?.(source) ?? 0,
			);
		};

		const throttledUpdate = throttle(THROTTLE_MS, update);
		const scrollUpdate = rafThrottle(update);
		const scrollTarget = resolveSource();

		scrollTarget.addEventListener("scroll", scrollUpdate, { passive: true });

		const mutationObserver = new MutationObserver(throttledUpdate);
		mutationObserver.observe(element, { childList: true, subtree: true });

		const resizeObserver = new ResizeObserver(throttledUpdate);
		resizeObserver.observe(element);
		if (scrollTarget !== element) resizeObserver.observe(scrollTarget);

		queueMicrotask(update);

		return () => {
			throttledUpdate.cancel();
			scrollUpdate.cancel();
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			scrollTarget.removeEventListener("scroll", scrollUpdate);
			element.style.cssText = originalStyle;
		};
	};
}
