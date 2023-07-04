// Ace editor setting
var editor = ace.edit("editor"); // Set editor to id="editor" tag in html
editor.setOption("wrap", "free"); // Long lines will automatically wrap to the next line when they reach the edge of the editor, without inserting line breaks or truncating the content.
editor.session.setMode("ace/mode/text"); // Set editor syntax to asciidoc

var output_session = document.querySelector("#output"); // output session set to id="output" tag in html

let configFile = "";
async function fetchConfig() {
  try {
    const response = await fetch('config.json');
    const data = await response.json();
    configFile = data;
    // Continue with further processing or use of the configFile variable
  } catch (error) {
    console.error(error);
  }
}
fetchConfig();

// Get the man_page_map.json as variable first
let json_map = ""
fetch('other/man_page_map.json')
  .then(response => response.json())
  .then(data => {
    json_map = data
  })
  .catch(error => console.error(error));

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

function github_get(url){
  // Github api url to get .adoc file
  github_url = url;
  var request = new XMLHttpRequest();
  request.open("GET", github_url, false);
  request.send(null);
  if (request.status === 200) {
    // Success - handle the response
    response_text = request.responseText
    editor.setValue("") // Clean content
    editor.session.insert(editor.getCursorPosition(), request.responseText); // Insert .adoc content that github api get to left editor session
    window.origin_content = response_text; // Use global window to store content     
  } 
  else {
     // Error - handle the error condition
     alert("Error occurred. Status: " + request.status + "\nYou enter wrong url.");
  }
}

function search_content() {
  var input1 = document.getElementById("input1").value;
  var selectOption = document.getElementById("selectMenu").value;
  var search_key = input1 + '.' +  selectOption.charAt(selectOption.length - 1);
  var github_raw_url = configFile["src_github_raw"]
  
  if (selectOption == "option0") {
    for (i = 1; i < 10; i++) {
      search_key = input1 + '.' +  i.toString();
      const result = searchKey(json_map, search_key);
      if (result !== null) {
        github_raw_url = github_raw_url + result.substr(9, result.length);
        console.log(github_raw_url)
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
      console.log(github_raw_url)
      github_get(github_raw_url)   
      return;
    }
  }
  window.alert("Search no result")
  // Output warning message
}

function generate_content() {
  console.log("nice")
  let editor_content = editor.getValue();  // Editor content
  window.editor_content = editor_content; // Use global window object to store current content
  
  // Send http get with the content to back-end
  var url = "scripts/convert.php";
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "message=" + encodeURIComponent(editor_content)
  })
    .then(function(response) {
      if (response.ok) {
        return response.text();
      }
      throw new Error("Network response was not ok.");
    })
    .then(function(responseText) {
      console.log("nice")
      output_session.contentDocument.body.innerHTML = responseText; // HTML render to output window
    })
    .catch(function(error) {
      console.log("Error:", error.message);
    });
}