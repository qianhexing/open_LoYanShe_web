const fs = require('fs')
const s = fs.readFileSync('node_modules/@dgreenheck/ez-tree/build/ez-tree.es.js', 'utf8')
const i = s.indexOf('Oak Small')
console.log('preset snippet:', s.slice(i, i + 700))
const m = s.match(/Z = \{[\s\S]*?bark: \{([\s\S]*?)\n  leaves:/)
if (m) {
	console.log(
		'barkkeys',
		[...m[1].matchAll(/\n    ([a-zA-Z0-9_]+): \{/g)].map((x) => x[1])
	)
}
const leafM = s.match(/\n  leaves: \{([\s\S]*?)\n\}/)
if (leafM) {
	console.log(
		'leafkeys',
		[...leafM[1].matchAll(/\n    ([a-zA-Z0-9_]+):/g)].map((x) => x[1])
	)
}
