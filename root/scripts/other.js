// Display confirmation message when closing the page
window.addEventListener('beforeunload', function(e) {
    // Custom message to inform the user
    var confirmationMessage = 'Your content may not be stored. Are you sure you want to leave this page?';
    // Some browsers require the confirmation message to be set
    e.returnValue = confirmationMessage;  
    return confirmationMessage;
});

// Middle line dragging
let isDragging = false;
let containerRect, dragLine, leftDiv, rightDiv;

function startDrag(event) {
    isDragging = true;
    containerRect = document.querySelector('.editor-container').getBoundingClientRect();
    dragLine = document.getElementById('dragLine');
    leftDiv = document.getElementById('left');
    rightDiv = document.getElementById('right');
    // Disable pointer events on #output to allow dragging over it

    var outputElement = document.getElementById('output');
    outputElement.style.pointerEvents = 'none';      
}

document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

function drag(event) {
    if (isDragging) {
    const dragX = event.clientX - containerRect.left;

    if (dragX >= 0 && dragX <= containerRect.width) {
        leftDiv.style.width = (dragX / containerRect.width) * 100 + '%';
        rightDiv.style.width = 100 - (dragX / containerRect.width) * 100 + '%';
        dragLine.style.left = (dragX - dragLine.clientWidth / 2) + 'px';
    }
    }
}

function stopDrag() {
    isDragging = false;
    var editor = ace.edit("editor")
    editor.resize();
    // Re-enable pointer events on #output after dragging
    var outputElement = document.getElementById('output');
    outputElement.style.pointerEvents = '';     
}

// While edit content after 0.5 second right sesstion will rerender
let debounceTimeoutId = null; // To prevent too many function calls
// Create a new observer instance
const observer = new MutationObserver(function(mutationsList, observer) {
   // Use debounce technique to ensure the function will be called at most once in one second
   if (debounceTimeoutId) {
      clearTimeout(debounceTimeoutId);
   }
   debounceTimeoutId = setTimeout(() => {
      // Trigger your function here
      generate_content();
   }, 500);
});
// Start observing the target node for configured mutations
observer.observe(document.getElementById('editor'), { childList: true, subtree: true });
