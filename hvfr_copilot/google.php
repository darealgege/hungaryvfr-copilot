
<?php
// google.php
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
$apiKey = $_ENV['GOOGLE_API_KEY'];
$searchEngineId = $_ENV['GOOGLE_SEARCH_ENGINE_ID'];
// Query, nyelvi és ország paraméterek beolvasása
$query = isset($_GET['q']) ? rawurlencode($_GET['q']) : '';

if ($query) {
    // Speciális keresési paraméterek a dinamikus nyelvvel és országgal
    $url = "https://www.googleapis.com/customsearch/v1?q=$query&key=$apiKey&cx=$searchEngineId&num=10";

    // Inicializálunk egy cURL session-t
    $ch = curl_init();

    // Kérés beállítása
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json; charset=UTF-8',
    ));

    // API válasz leolvasása
    $response = curl_exec($ch);

    // Hibaellenőrzés
    if ($response === false) {
        echo json_encode(["error" => "Failed to contact Google API"]);
    } else {
        echo $response;        
    }

    // cURL session lezárása
    curl_close($ch);
} else {
    echo json_encode(["error" => "No query provided"]);
}