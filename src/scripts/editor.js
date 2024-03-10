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
	outputSession.contentDocument.body.innerHTML = result

	// Define an array of CSS file paths
	const cssFiles = ['styles/jroff/mandoc.css', 'styles/jroff/fix.css']

	// Loop through the array and create <link> elements for each CSS file
	cssFiles.forEach(function (cssFile) {
		const link = document.createElement('link')
		link.href = cssFile
		link.rel = 'stylesheet'

		outputSession.contentDocument.head.appendChild(link)
	})
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
