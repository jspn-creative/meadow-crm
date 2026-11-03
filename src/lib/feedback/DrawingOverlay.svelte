<script lang="ts">
	import { Undo2 } from "@lucide/svelte";

	type Point = { x: number; y: number };
	let { onfinish, oncancel }: { onfinish: (drawing: string) => void; oncancel: () => void } = $props();

	const maxImageWidth = 1600;
	let strokes = $state.raw<Point[][]>([]);
	let capturing = $state(false);
	let context: CanvasRenderingContext2D | null = null;
	let activeStroke: Point[] | null = null;

	function paint(target: CanvasRenderingContext2D, scale: number) {
		target.strokeStyle = "#e11d48";
		target.lineWidth = 3 * scale;
		target.lineCap = "round";
		target.lineJoin = "round";
		for (const stroke of strokes) {
			target.beginPath();
			stroke.forEach(({ x, y }, index) => (index ? target.lineTo(x * scale, y * scale) : target.moveTo(x * scale, y * scale)));
			// A tap has no length of its own, so a repeated point draws it as a dot.
			if (stroke.length === 1) target.lineTo(stroke[0].x * scale, stroke[0].y * scale);
			target.stroke();
		}
	}
	function redraw() {
		if (!context) return;
		context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		paint(context, window.devicePixelRatio);
	}
	function undo() {
		strokes = strokes.slice(0, -1);
		redraw();
	}
	/** The theme's Google Fonts stylesheet is cross-origin, so the capture cannot read it and would lay text out in fallback fonts. This inlines its Latin faces instead. */
	async function themeFontFaces() {
		const link = document.getElementById("theme-fonts");
		if (!(link instanceof HTMLLinkElement)) return "";
		try {
			const css = await (await fetch(link.href)).text();
			const faces = css.split(/(?=\/\* )/).filter((block) => block.startsWith("/* latin */"));
			const inlined = await Promise.all(
				faces.map(async (face) => {
					const url = face.match(/url\((https:[^)]+)\)/)?.[1];
					if (!url) return face;
					const font = await (await fetch(url)).blob();
					const data = await new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => resolve(reader.result as string);
						reader.onerror = () => reject(reader.error);
						reader.readAsDataURL(font);
					});
					return face.replace(url, data);
				}),
			);
			return inlined.join("");
		} catch {
			return "";
		}
	}
	async function finish() {
		capturing = true;
		const { innerWidth: width, innerHeight: height } = window;
		const scale = Math.min(window.devicePixelRatio, maxImageWidth / width);
		let image: HTMLCanvasElement;
		try {
			const [{ domToCanvas }, fontFaces] = await Promise.all([import("modern-screenshot"), themeFontFaces()]);
			image = await domToCanvas(document.documentElement, {
				width,
				height,
				scale,
				timeout: 8000,
				font: false,
				onCreateForeignObjectSvg: (svg) => {
					const style = document.createElementNS(svg.namespaceURI, "style");
					// A clone's entry animations would otherwise restart and catch the page half faded in.
					style.textContent = `${fontFaces} * { scrollbar-width: none !important; animation: none !important; transition: none !important; }`;
					svg.prepend(style);
				},
				// Text in the clone measures a hair wider than on the page, and the widths it copies would wrap single lines.
				onCloneEachNode: (clone) => {
					if (!(clone instanceof HTMLElement) || !clone.style.width.endsWith("px")) return;
					if ([...clone.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) clone.style.width = `calc(${clone.style.width} + 2px)`;
				},
				// A clone has no top layer, so an open dialog moves to the end of the page to stay above everything else.
				onCloneNode: (clone) => {
					if (!(clone instanceof Element)) return;
					const body = clone.querySelector("body");
					if (body) body.append(...clone.querySelectorAll("dialog[open]"));
				},
				// The feedback tool never appears in its own screenshots.
				filter: (node) => !(node instanceof Element && node.hasAttribute("data-feedback-tool")),
			});
		} catch {
			// The marks and their position still say something when the page cannot be captured.
			image = document.createElement("canvas");
			image.width = width * scale;
			image.height = height * scale;
			const blank = image.getContext("2d")!;
			blank.fillStyle = "#ffffff";
			blank.fillRect(0, 0, image.width, image.height);
		}
		paint(image.getContext("2d")!, image.width / width);
		const webp = image.toDataURL("image/webp", 0.8);
		onfinish(webp.startsWith("data:image/webp") ? webp : image.toDataURL("image/jpeg", 0.8));
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key !== "Escape" || capturing) return;
		// An open dialog would otherwise close along with the drawing.
		event.preventDefault();
		oncancel();
	}} />

<div popover="manual" {@attach (layer) => layer.showPopover()} class="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0">
	<canvas
		{@attach (canvas) => {
			canvas.width = window.innerWidth * window.devicePixelRatio;
			canvas.height = window.innerHeight * window.devicePixelRatio;
			context = canvas.getContext("2d");
		}}
		aria-label="Drawing area over the page"
		class="absolute inset-0 size-full cursor-crosshair touch-none"
		onpointerdown={(event) => {
			if (capturing || event.button) return;
			event.currentTarget.setPointerCapture(event.pointerId);
			activeStroke = [{ x: event.clientX, y: event.clientY }];
			strokes = [...strokes, activeStroke];
			redraw();
		}}
		onpointermove={(event) => {
			if (!activeStroke) return;
			activeStroke.push(...event.getCoalescedEvents().map(({ clientX: x, clientY: y }) => ({ x, y })));
			redraw();
		}}
		onpointerup={() => (activeStroke = null)}
		onpointercancel={() => (activeStroke = null)}></canvas>
	<div class="surface surface-floating absolute bottom-4 left-1/2 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 p-2">
		<p class="text-muted px-2 text-sm" role="status">{capturing ? "Capturing the page…" : "Draw on the page, then press Done."}</p>
		<button type="button" class="control" data-size="sm" data-variant="ghost" disabled={capturing || !strokes.length} onclick={undo}><Undo2 size={15} aria-hidden="true" />Undo</button>
		<button type="button" class="control" data-size="sm" data-variant="ghost" disabled={capturing} onclick={oncancel}>Cancel</button>
		<button type="button" class="control" data-size="sm" data-variant="primary" disabled={capturing} aria-busy={capturing} onclick={finish}>Done</button>
	</div>
</div>
