import { HTMLGenerator } from '../render/jroff.js'

// Global constants
const editor = ace.edit('editor') /* global ace */
editor.setOption('wrap', 'free') // Long lines will automatically wrap to the next line
editor.session.setMode('ace/mode/text')

const outputSession = document.querySelector('#output')

// Initail contents in editor
fetch('other/init.txt')
	.then((response) => response.text())
	.then((data) => {
		editor.setValue(data)
		window.origin_content = data
		window.current_link_1 = 'a/usr/src/bin/ls/ls.1'
		window.current_link_2 = 'b/usr/src/bin/ls/ls.1'
		generateContent()
	})
	.catch((error) => {
		console.error('Error fetching config.json:', error)
	})

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
