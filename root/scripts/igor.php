<?php
// Get the message from the POST data
$message = $_POST['message'];

// Generate a unique filename
$filename = './' . uniqid() . '.1';

// Save the message to the file
$file = fopen($filename, 'w');
fwrite($file, $message);
fclose($file);

// // Set file permissions to 777
// chmod($filename, 0777);

// Execute the man command with the filename as the argument
// Use textproc/igor to proofread the manual page:
$command = '/usr/local/bin/igor ' . escapeshellarg($filename);
$output = shell_exec($command);

$exitCode = shell_exec("echo $?");

if ($exitCode == 0) {
    echo "Command executed successfully.";
    echo "Output: " . $output;
} else {
    echo "Command encountered an error.";
}

// Remove the temporary file
// unlink($filename);

// Return the output of the man command
echo $output;
?>
