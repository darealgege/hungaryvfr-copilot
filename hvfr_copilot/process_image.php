<?php

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
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['image_urls']) || empty($input['image_urls'])) {
    echo json_encode(['status' => 'error', 'message' => 'Nincsenek kép URL-ek megadva.']);
    exit;
}

if (!isset($input['user_input']) || empty($input['user_input'])) {
    $userInput = "What’s in these images?";
} else {
    $userInput = $input['user_input'];
}

$imageUrls = $input['image_urls']; // Több kép URL-jének beolvasása

$apiUrl = 'https://api.openai.com/v1/chat/completions';

// Az OpenAI API kérés elkészítése
$images = [];
foreach ($imageUrls as $url) {
    $images[] = [
        "type" => "image_url",
        "image_url" => ["url" => $url]
    ];
}

$data = [
    "model" => "gpt-4o-mini",
    "messages" => [
        [
            "role" => "user",
            "content" => array_merge(
                [
                    [
                        "type" => "text",
                        "text" => $userInput
                    ]
                ],
                $images // Több kép hozzáadása
            )
        ]
    ],
    "max_tokens" => 4096
];

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo json_encode(['status' => 'error', 'message' => curl_error($ch)]);
    curl_close($ch);
    exit;
}

curl_close($ch);

$responseData = json_decode($response, true);

if (isset($responseData['choices'][0]['message']['content'])) {
    echo json_encode(['status' => 'success', 'result' => $responseData['choices'][0]['message']['content']]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Hiba az OpenAI API válaszának feldolgozásakor.']);
}
?>
