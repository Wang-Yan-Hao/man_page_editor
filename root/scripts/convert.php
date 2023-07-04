<?php
// Get the message from the POST data
$message = $_POST['message'];

// Generate a unique filename
$filename = uniqid() . '.txt';

// Save the message to the file
$file = fopen($filename, 'w');
fwrite($file, $message);
fclose($file);

// Execute the man command with the filename as the argument
$command = "/usr/bin/man " . escapeshellarg($filename);
$output = shell_exec($command);

// Remove the temporary file
unlink($filename);

// Return the output of the man command
echo $output;
?>
