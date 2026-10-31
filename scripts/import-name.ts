const internalParticles = new Set([
	"de",
	"del",
	"della",
	"di",
	"da",
	"dos",
	"das",
	"du",
	"la",
	"le",
	"van",
	"von",
	"der",
	"den",
	"ten",
	"ter",
]);
const suffixes = new Map([
	["jr", "Jr"],
	["sr", "Sr"],
	["ii", "II"],
	["iii", "III"],
	["iv", "IV"],
]);

/** Normalize imported names without rewriting existing mixed-case spellings. */
export function normalizeImportName(name: string): string {
	const words = name.trim().split(/\s+/u);

	return words
		.map((word, index) => {
			const lowercase = word.toLowerCase();
			const suffix = suffixes.get(lowercase.replace(/\.$/u, ""));

			if (index === words.length - 1 && suffix) {
				return suffix + (word.endsWith(".") ? "." : "");
			}

			const isUniformCase = word === lowercase || word === word.toUpperCase();

			if (!isUniformCase) return word;
			if (index > 0 && index < words.length - 1 && internalParticles.has(lowercase)) {
				return lowercase;
			}

			return lowercase
				.replace(
					/(^|[-'’])(\p{L})/gu,
					(_, boundary: string, letter: string) => boundary + letter.toUpperCase(),
				)
				.replace(
					/(^|[-'’])Mc(\p{L})/gu,
					(_, boundary: string, letter: string) => `${boundary}Mc${letter.toUpperCase()}`,
				);
		})
		.join(" ");
}
