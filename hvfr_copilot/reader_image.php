<?php
if (isset($_FILES['file']) && isset($_POST['fileName'])) {
    $fileName = basename($_POST['fileName']);
    $uploadDir = dirname(__DIR__) . '/hvfr_copilot/reader/';

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fullPath = $uploadDir . $fileName;
    $tmpName = $_FILES['file']['tmp_name'];

    // Kép betöltése
    $image = imagecreatefromstring(file_get_contents($tmpName));

    // Ellenőrzés, hogy a kép sikeresen betöltődött
    if ($image !== false) {
        // Tömörítési minőség beállítása (80% - közepes minőség)
        $quality = 80; // állítható 0-100 között

        // Kép mentése .jpg formátumban
        $newFileName = $uploadDir . $fileName;
        imagejpeg($image, $newFileName, $quality);

        // Tömörítés utáni fájl URL-je
        echo json_encode([
            "status" => "success",
            "url" => "https://hungaryvfr.hu/hvfr_copilot/reader/" . $fileName
        ]);

        // Töröljük a memória erőforrást
        imagedestroy($image);
    } else {
        echo json_encode(["status" => "error", "message" => "A kép nem tölthető be"]);
    }
} else {
    echo json_encode(["status" => "error"]);
}
?>
