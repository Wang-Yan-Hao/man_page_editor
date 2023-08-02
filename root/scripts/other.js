// Display confirmation message when closing the page
window.addEventListener('beforeunload', function(e) {
    // Custom message to inform the user
    var confirmationMessage = 'Your content may not be stored. Are you sure you want to leave this page?';
    // Some browsers require the confirmation message to be set
    e.returnValue = confirmationMessage;  
    return confirmationMessage;
});

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
