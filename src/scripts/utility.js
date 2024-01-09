// Helper function to decode base64-encoded Unicode strings
// Source: https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
export function b64DecodeUnicode(str) {
	return decodeURIComponent(
		atob(str)
			.split('')
			.map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
			.join('')
	)
}

// Search value by key in jsonObj
export function searchKey(jsonObj, key) {
	let result = null
	for (const prop in jsonObj) {
		if (prop === key) {
			return jsonObj[prop]
		} else if (typeof jsonObj[prop] === 'object') {
			result = searchKey(jsonObj[prop], key)
			if (result !== null) {
				return result
			}
		}
	}
	return result
}
