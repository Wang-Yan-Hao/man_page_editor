import { HTMLGenerator } from '../render/jroff.js'

// Global constants
const editor = ace.edit('editor') /* global ace */
editor.setOption('wrap', 'free') // Long lines will automatically wrap to the next line
editor.session.setMode('ace/mode/text')

const outputSession = document.querySelector('#output')

// Generated content by using Jroff
export function generateContent() {
	const editorContent = editor.getValue() // Editor content
	const generator = new HTMLGenerator()
	const result = generator.generate(editorContent, 'doc')
	outputSession.contentDocument.body.innerHTML =
		'<link rel="stylesheet" href="styles/jroff/mandoc.css">' +
		'<link rel="stylesheet" href="styles/jroff/fix.css">' +
		result
}

let typingTimer // Timer identifier
const typingInterval = 500 // Time in milliseconds (1 second)

editor.getSession().on('change', function () {
	clearTimeout(typingTimer)
	typingTimer = setTimeout(() => {
		// Trigger your function here
		generateContent()
	}, typingInterval)
})
