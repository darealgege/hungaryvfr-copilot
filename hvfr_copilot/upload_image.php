<?php
header('Content-Type: application/json');
// Automatikusan meghatározza a protokollt (http vagy https)
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' 
            || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";

// Meghatározza az alap URL-t
$host = $_SERVER['HTTP_HOST'];
define('BASE_URL', $protocol . $host);

// Meghatározza a dokumentum gyökér könyvtárát
define('BASE_DIR', $_SERVER['DOCUMENT_ROOT']);

// Upload könyvtár elérési útja és URL-je
define('UPLOADS_DIR', BASE_DIR . '/hvfr_copilot/uploads/');
define('UPLOADS_URL', BASE_URL . '/hvfr_copilot/uploads/');

// Ellenőrizzük, hogy a kép fájl valóban fel lett-e töltve
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['status' => 'error', 'message' => 'Kép feltöltése sikertelen.']);
    exit;
}

$image = $_FILES['image'];

// Ellenőrizzük a fájl típusát
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
if (!in_array($image['type'], $allowedTypes)) {
    echo json_encode(['status' => 'error', 'message' => 'Csak JPEG, PNG és GIF formátumok engedélyezettek.']);
    exit;
}

// Generáljunk egy egyedi fájlnevet
$uniqueName = uniqid('', true) . '_' . basename($image['name']);

// Definiáljuk az upload mappa elérési útját és URL-jét
$uploadPath = UPLOADS_DIR . $uniqueName;

// Ellenőrizzük, hogy létezik-e az upload mappa, ha nem, létrehozzuk
if (!is_dir(UPLOADS_DIR)) {
    if (!mkdir(UPLOADS_DIR, 0755, true)) {
        echo json_encode(['status' => 'error', 'message' => 'Az uploads mappa létrehozása sikertelen.']);
        exit;
    }
}

// Mozgatjuk a feltöltött fájlt a célhelyre
if (move_uploaded_file($image['tmp_name'], $uploadPath)) {
    // Generáljuk a kép URL-jét
    $imageUrl = UPLOADS_URL . $uniqueName;

    echo json_encode(['status' => 'success', 'image_url' => $imageUrl]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Kép feltöltése sikertelen.']);
}
?>
