function download(filename, text) {
   var element = document.createElement("a");
   element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
   element.setAttribute("download", filename);
   element.style.display = "none";
   document.body.appendChild(element);
   element.click();
   document.body.removeChild(element);
}

function patch_download() {
   var editor = ace.edit("editor"); // Set editor to id="editor" tag in html
   let editor_content = editor.getValue();  // Editor content

   var diff = Diff.createTwoFilesPatch(window.current_link_1, window.current_link_2, window.origin_content, editor_content ); // use jsdiff create diff file string
   download("diff.patch", diff);
}

function store_content() {
   var editor = ace.edit("editor"); // Set editor to id="editor" tag in html
   editor_content = editor.getValue();
   download("man.txt", editor_content);
}