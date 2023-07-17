// Ace editor setting
var editor = ace.edit("editor"); // Set editor to id="editor" tag in html
editor.setOption("wrap", "free"); // Long lines will automatically wrap to the next line when they reach the edge of the editor, without inserting line breaks or truncating the content.
editor.session.setMode("ace/mode/text"); // Set editor syntax to asciidoc

var rawFile = new XMLHttpRequest();
rawFile.onreadystatechange = function() {
  if (rawFile.readyState === 4) {
    var allText = rawFile.responseText;
    editor.setValue(allText)
  }
}
rawFile.open("GET", "scripts/temp.txt", true);
rawFile.send();

var output_session = document.querySelector("#output"); // output session set to id="output" tag in html
let configFile = "";
// Get the config data
async function fetchConfig() {
  try {
    const response = await fetch('config.json');
    const data = await response.json();
    configFile = data;
  } catch (error) {
    console.error(error);
  }
}
fetchConfig();

// Get the man_page_map.json as variable
// man_page_map.json is a map of (man page file name, path of man page file name)
let json_map = ""
fetch('other/man_page_map.json')
  .then(response => response.json())
  .then(data => {
    json_map = data
  })
  .catch(error => console.error(error));

// Function to search man_page_map.json
function searchKey(jsonObj, key) {
  let result = null;
  for (const prop in jsonObj) {
    if (prop === key) {
      return jsonObj[prop];
    } else if (typeof jsonObj[prop] === 'object') {
      result = searchKey(jsonObj[prop], key);
      if (result !== null) {
        return result;
      }
    }
  }
  return result;
}

// Give github url to get content
function github_get(url){
  var request = new XMLHttpRequest();
  request.open("GET", url, false);
  request.send(null)
  if (request.status === 200) {
    // Success - handle the response
    response_text = request.responseText
    editor.setValue("") // Clean content
    editor.session.insert(editor.getCursorPosition(), request.responseText); // Insert content that get from url to left editor session
    window.origin_content = response_text; // Use global window to store content     
  } 
  else {
     // Error - handle the error condition
     alert("Error occurred. Status: " + request.status + "\nYou enter wrong url.");
  }
}

// Search buttion function
function search_content() {
  var input1 = document.getElementById("input1").value;
  var selectOption = document.getElementById("selectMenu").value;
  var github_raw_url = configFile["github_url"]
  var search_key = input1 + '.' +  selectOption.charAt(selectOption.length - 1); // Search key, ex man.1

  if (selectOption == "option0") {
    for (i = 1; i < 10; i++) {
      var search_key = input1 + '.' +  i.toString();
      const result = searchKey(json_map, search_key);
      if (result !== null) {
        github_raw_url = github_raw_url + result.substr(9, result.length); // remove "/usr/src" string
        github_get(github_raw_url)   
        return;
      }
    }
  }
  else if (selectOption == "optionn") { // option n

  }
  else {
    const result = searchKey(json_map, search_key);
    if (result !== null) {
      github_raw_url = github_raw_url + result.substr(9, result.length);
      github_get(github_raw_url)   
      return;
    }
  }
  // If map has not find the search_key, output warning message
  window.alert("Search no result")
}



// Generated content
function generate_content() {
  let editor_content = editor.getValue();  // Editor content
  console.log('hello')
  var generator = new Jroff.HTMLGenerator();
  var result = generator.generate(editor_content, 'doc');
  output_session.contentDocument.body.innerHTML = '<link rel="stylesheet" href="styles/jroff.css">' + 
  result
}

