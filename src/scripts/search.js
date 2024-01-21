import { searchKey } from './utility.js'

const editor = ace.edit('editor') /* global ace */

// Configuration file handling
let configTextJson = ''

fetch('config.json')
	.then((response) => response.json())
	.then((data) => {
		configTextJson = data
	})
	.catch((error) => {
		console.error('Error fetching config.json:', error)
	})

// Get the "man_page_map.json" as variable, it is a map of (man page file name, path of man page file name)
let jsonMap = ''

fetch('man_page_map.json')
	.then((response) => {
		if (!response.ok) {
			throw new Error(`Error occurred. Status:${response.status}`)
		}
		return response.json()
	})
	.then((data) => {
		jsonMap = data
		searchContent() // Init contents in editor
	})
	.catch((error) => console.error(error))

// Function to get src codes fomr Github and insert it to the left editor
function githubApiGet(url) {
	fetch(url)
		.then((response) => {
			if (!response.ok) {
				throw new Error(
					`Error occurred. Status:${response.status}\nYou entered the wrong URL.`
				)
			}
			return response.text()
		})
		.then((responseText) => {
			editor.setValue('') // Clean content
			editor.session.insert(editor.getCursorPosition(), responseText) // Insert content from the URL to the left editor session
			window.origin_content = responseText // Use global window to store content
		})
		.catch((error) => {
			alert(error.message)
		})
}

// Search the man page content of the command which user input
export function searchContent() {
	// Get current value
	const input = document.getElementById('input').value
	const selectOption = document.getElementById('select-menu').value

	let githubUrl = configTextJson.github_url
	let key = `${input}.${selectOption.charAt(selectOption.length - 1)}` // Search key, ex "man.1"
	let path = '' // Path of man page

	if (selectOption === 'option0') {
		for (let i = 1; i < 10; i++) {
			key = `${input}.${i.toString()}`
			path = searchKey(jsonMap, key)

			if (path !== null) {
				githubUrl += path.slice(9) // Remove "/usr/src" string
				githubApiGet(githubUrl)

				window.current_link_1 = `a${path}`
				window.current_link_2 = `b${path}`
				return
			}
		}
	} else if (selectOption === 'optionn') {
		// option n
	} else {
		path = searchKey(jsonMap, key)

		if (path !== null) {
			githubUrl += path.slice(9)
			githubApiGet(githubUrl)

			window.current_link_1 = `a${path}`
			window.current_link_2 = `b${path}`
			return
		}
	}
	window.alert('Search no result')
}
