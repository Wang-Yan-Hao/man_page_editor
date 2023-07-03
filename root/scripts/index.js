// Ace editor setting
var editor = ace.edit("editor"); // Set editor to id="editor" tag in html
editor.setOption("wrap", "free"); // Long lines will automatically wrap to the next line when they reach the edge of the editor, without inserting line breaks or truncating the content.
editor.session.setMode("ace/mode/text"); // Set editor syntax to asciidoc

var output_session = document.querySelector("#output"); // output session set to id="output" tag in html

// Use http.get to get config.json
var configFile=new XMLHttpRequest();
configFile.open("GET", "./config.json", false);
var configText_json ="";
var configText="";

var before_url="test_default"
// Change file button function
var button = document.querySelector('.change_file');
function popup3(e) {
   var guest = window.prompt('Change the left adoc file with freebsd document url', before_url);
   if (guest == null || "") {
      console.log('yes')
   } 
   else {
      console.log('no')
   }
}
button.addEventListener('click', popup3);

command = "man"
chapter = "1"

