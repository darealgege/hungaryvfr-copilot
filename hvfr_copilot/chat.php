<?php
header("Content-Type: application/json");

// Hibák megjelenítése (fejlesztés alatt)
//ini_set('display_errors', 1);
//ini_set('display_startup_errors', 1);
//error_reporting(E_ALL);
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
$apiKey = $_ENV['OPENAI_API_KEY'];

$response = ['error' => null];

try {
    // Kérés payload olvasása
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    // JSON ellenőrzése
    if (json_last_error() !== JSON_ERROR_NONE) {
        $response['error'] = "Invalid JSON input: " . json_last_error_msg();
        throw new Exception($response['error']);
    }

    $messages = $data['messages'];
    $model = $data['model'] ?? 'gpt-4o-mini'; // Alapértelmezett modell
    $temperature = $data['temperature'] ?? 0.7;

    // API hívás payload
    $apiPayload = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => $temperature
    ];

    $apiPayloadJson = json_encode($apiPayload);
    // API hívás
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n" .
                        "Authorization: Bearer $apiKey\r\n",
            'content' => $apiPayloadJson
        ]
    ]);

    $apiResponse = file_get_contents("https://api.openai.com/v1/chat/completions", false, $context);

    if ($apiResponse === FALSE) {
        throw new Exception("API request failed.");
    }

    echo $apiResponse;
} catch (Exception $e) {
    $response['error'] = $e->getMessage();
    echo json_encode($response);
}
?>
