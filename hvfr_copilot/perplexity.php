<?php
// perplexity.php

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
try {
    loadEnv(__DIR__ . '/.env');
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

$api_key = isset($_ENV['PERPLEXITY_API_KEY']) ? $_ENV['PERPLEXITY_API_KEY'] : '';

if (empty($api_key)) {
    echo json_encode(['error' => 'API key not set in .env file.']);
    exit;
}

header('Content-Type: application/json');

// CORS kezelése (ha szükséges)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Csak POST kérések engedélyezése
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Invalid request method. Only POST is allowed.']);
    exit;
}

// Az input adat olvasása a POST törzséből
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!isset($data['q'])) {
    echo json_encode(['error' => 'No query parameter provided.']);
    exit;
}

$query = $data['q'];

// Állítsd be az API kérést
$url = 'https://api.perplexity.ai/chat/completions';

// Kérés fejlécei
$headers = [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $api_key
];

// Kérés törzse
$requestData = [
    'model' => 'llama-3.1-sonar-small-128k-online',
    //'model' => 'llama-3.1-sonar-small-128k-chat',
    'messages' => [
        [
            'role' => 'user',
            'content' => $query
        ]
    ],
    // Opcionális paraméterek, módosítsd igény szerint
    'max_tokens' => 2048,
    'temperature' => 0.2,
    'top_p' => 0.9,
    'return_citations' => true,
    'search_domain_filter' => [],
    'return_images' => false,
    'return_related_questions' => false,
    //'search_recency_filter' => 'month',
    'top_k' => 0,
    'stream' => false,
    'presence_penalty' => 0,
    'frequency_penalty' => 1
];

// cURL inicializálása
$ch = curl_init($url);

// cURL beállítások
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

// Kérés végrehajtása
$response = curl_exec($ch);

// Hibakezelés
if ($response === false) {
    $error = curl_error($ch);
    curl_close($ch);
    echo json_encode(['error' => 'Curl error: ' . $error]);
    exit;
}

$http_status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Ellenőrzés, hogy az API válasz megfelelő-e
if ($http_status !== 200) {
    echo json_encode(['error' => 'Perplexity API responded with status ' . $http_status]);
    exit;
}

// Válasz visszaküldése a kliensnek
echo $response;
?>
