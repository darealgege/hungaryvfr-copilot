<?php
// bing.php

// Egyszerű .env fájl beolvasása és feldolgozása
function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception('.env file not found');
    }

    $env = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($env as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue; // Kommentek figyelmen kívül hagyása
        }
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
}

// Betöltjük a .env fájlt
loadEnv(__DIR__ . '/.env');
$apiKey = $_ENV['BING_API_KEY'];

// Olvasd be a query paramétert és a típusát (pl. 'news')
$query = isset($_GET['q']) ? urlencode($_GET['q']) : '';
$type = isset($_GET['type']) ? $_GET['type'] : 'search'; // Alapértelmezett: 'search'

if ($query) {
    if ($type === 'news') {
        $url = "https://api.bing.microsoft.com/v7.0/news/search?q=$query&freshness=Month";
    } else {
        $url = "https://api.bing.microsoft.com/v7.0/search?q=$query";
    }

    // Inicializálj egy cURL session-t
    $ch = curl_init();

    // Állítsd be az API kérést
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Ocp-Apim-Subscription-Key: $apiKey"
    ]);

    // Végrehajtás és válasz visszaadása
    $response = curl_exec($ch);

    // Hibaellenőrzés
    if ($response === false) {
        echo json_encode(["error" => "Failed to contact Bing API"]);
    } else {
        echo $response;
    }

    // Zárd le a cURL session-t
    curl_close($ch);
} else {
    echo json_encode(["error" => "No query provided"]);
}
?>
