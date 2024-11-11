<?php
header("Content-Type: text/plain");

// Hibák megjelenítése (fejlesztés alatt)
//ini_set('display_errors', 1);
//ini_set('display_startup_errors', 1);
//error_reporting(E_ALL);

try {
    $directory = __DIR__ . '/knowledgebase/';
    $file = isset($_GET['file']) ? $_GET['file'] : '';

    if (!is_dir($directory)) {
        throw new Exception("Directory not found.");
    }

    if ($file) {
        if (!preg_match('/^[a-zA-Z0-9_\-\.]+$/', $file)) {
            throw new Exception("Invalid file name.");
        }

        $filePath = $directory . $file;

        if (file_exists($filePath)) {
            echo file_get_contents($filePath);
        } else {
            throw new Exception("File not found.");
        }
    } else {
        $files = array_diff(scandir($directory), ['.', '..']);
        // Filter only .dat files
        $datFiles = array_filter($files, function($filename) use ($directory) {
            return is_file($directory . $filename) && pathinfo($filename, PATHINFO_EXTENSION) === 'dat';
        });

        // Convert to array and sort
        $datFiles = array_values($datFiles);

        // Set default file
        $defaultFile = 'hvfr.dat';

        // Check if default file exists and remove from the list if present
        if (($key = array_search($defaultFile, $datFiles)) !== false) {
            unset($datFiles[$key]);
        }

        // Place the default file first in the list
        array_unshift($datFiles, $defaultFile);

        // Output the list of .dat files
        echo implode("\n", $datFiles);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
