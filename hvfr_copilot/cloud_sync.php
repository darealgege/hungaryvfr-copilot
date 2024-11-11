<?php
// cloud_sync.php

session_start();

// Ellenőrizzük, hogy JSON válasz legyen
header('Content-Type: application/json');

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
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    exit;
}

$client_id = $_ENV['DRIVE_CLIENT_ID'];
$client_secret = $_ENV['DRIVE_CLIENT_SECRET'];
$redirect_uri = $_ENV['REDIRECT_URI'];
$api_key = $_ENV['GOOGLE_DRIVE_API_KEY'];

// Lekérdezzük az 'action' paramétert
$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : null);

if (!$action) {
    echo json_encode(['status' => 'error', 'message' => 'No action specified.']);
    exit;
}

try {
    switch ($action) {
        case 'check_auth':
            checkAuthentication();
            break;
        case 'synchronize':
            synchronizeChats();
            break;
        case 'load_chats':
            loadChats();
            break;
        case 'oauth_callback':
            handleOAuthCallback();
            break;
        default:
            echo json_encode(['status' => 'error', 'message' => 'Invalid action.']);
    }
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

function checkAuthentication() {
    if (isset($_SESSION['access_token']) && isset($_SESSION['refresh_token'])) {
        // Ellenőrizzük az access token érvényességét
        $access_token = $_SESSION['access_token'];
        $is_valid = verifyAccessToken($access_token);
        if ($is_valid) {
            echo json_encode(['status' => 'success', 'authenticated' => true]);
            exit;
        } else if (isset($_SESSION['refresh_token'])) {
            // Megpróbáljuk frissíteni az access tokent
            $new_access_token = refreshAccessToken($_SESSION['refresh_token']);
            if ($new_access_token) {
                $_SESSION['access_token'] = $new_access_token;
                echo json_encode(['status' => 'success', 'authenticated' => true]);
                exit;
            }
        }
    }
    echo json_encode(['status' => 'success', 'authenticated' => false]);
    exit;
}

/* function synchronizeChats() {
    if (!isset($_SESSION['access_token'])) {
        error_log('synchronizeChats Error: User not authenticated.');
        echo json_encode(['status' => 'error', 'message' => 'User not authenticated.']);
        exit;
    }

    $access_token = $_SESSION['access_token'];

    // Ellenőrizzük, hogy a "HungaryVFR CoPilot" mappa létezik-e
    if (isset($_SESSION['folder_id'])) {
        $folder_id = $_SESSION['folder_id'];
    } else {
        $folder_id = getFolderId($access_token, 'HungaryVFR CoPilot');

        if (!$folder_id) {
            // Ha nem létezik, létrehozzuk
            $folder_id = createFolder($access_token, 'HungaryVFR CoPilot');
            if (!$folder_id) {
                error_log('synchronizeChats Error: Failed to create folder in Google Drive.');
                echo json_encode(['status' => 'error', 'message' => 'Failed to create folder in Google Drive.']);
                exit;
            }
        }

        $_SESSION['folder_id'] = $folder_id;
    }

    // Fogadjuk el a session adatokat a POST kérelemből
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['session_id']) || !isset($input['chat_data'])) {
        error_log('synchronizeChats Error: Incomplete session data provided.');
        echo json_encode(['status' => 'error', 'message' => 'Incomplete session data provided.']);
        exit;
    }

    $session_id = $input['session_id'];
    $chat_data = $input['chat_data'];

    // Ellenőrizzük, hogy a session_id helyes-e
    if (empty($session_id)) {
        error_log('synchronizeChats Error: Invalid session_id.');
        echo json_encode(['status' => 'error', 'message' => 'Invalid session_id.']);
        exit;
    }

    // Ellenőrizzük, hogy a session adat tartalmazza-e a szükséges mezőket
    if (!isset($chat_data['chatLog']) || !isset($chat_data['conversationHistory'])) {
        error_log('synchronizeChats Error: Invalid chat_data structure.');
        echo json_encode(['status' => 'error', 'message' => 'Invalid chat_data structure.']);
        exit;
    }

    // Létrehozzuk vagy frissítjük a fájlt a Drive-on
    $file_name = $session_id . '.json';
    $file_exists = findFileInFolder($access_token, $folder_id, $file_name);
    if ($file_exists) {
        // Frissítjük a meglévő fájlt
        $update_result = updateFile($access_token, $file_exists['id'], json_encode($chat_data));
        if (!$update_result) {
            error_log("synchronizeChats Error: Failed to update file $file_name.");
            echo json_encode(['status' => 'error', 'message' => 'Failed to update existing file in Google Drive.']);
            exit;
        }
    } else {
        // Létrehozzuk az új fájlt
        $create_result = createFile($access_token, $folder_id, $file_name, json_encode($chat_data));
        if (!$create_result) {
            error_log("synchronizeChats Error: Failed to create file $file_name.");
            echo json_encode(['status' => 'error', 'message' => 'Failed to create new file in Google Drive.']);
            exit;
        }
    }

    // Opció: Tároljuk el a session adatokat a szerver oldalon (pl. PHP session)
    // Ez opcionális, attól függően, hogy szükség van-e rá
    // $_SESSION['local_sessions'][$session_id] = $chat_data;

    error_log("synchronizeChats Success: Chat $file_name synchronized.");
    echo json_encode(['status' => 'success', 'message' => 'Chat synchronized successfully.']);
    exit;
} */

function synchronizeChats() {
    if (!isset($_SESSION['access_token'])) {
        echo json_encode(['status' => 'error', 'message' => 'User not authenticated.']);
        exit;
    }

    $access_token = $_SESSION['access_token'];
    $folder_id = getOrCreateFolder($access_token, 'HungaryVFR CoPilot');

    // Fetch cloud sessions
    $cloud_sessions = fetchAllSessionsFromCloud($access_token, $folder_id);

    // Fetch local sessions from the POST request
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['local_sessions'])) {
        echo json_encode(['status' => 'error', 'message' => 'No local sessions provided.']);
        exit;
    }
    $local_sessions = $input['local_sessions'];

    // Merge sessions
    $merged_sessions = mergeSessions($cloud_sessions, $local_sessions);

    // Upload merged sessions to the cloud
    foreach ($merged_sessions as $session_id => $chat_data) {
        $file_name = $session_id . '.json';
        $file = findFileInFolder($access_token, $folder_id, $file_name);
        if ($file) {
            // Update existing file
            updateFile($access_token, $file['id'], json_encode($chat_data));
        } else {
            // Create new file
            createFile($access_token, $folder_id, $file_name, json_encode($chat_data));
        }
    }

    echo json_encode(['status' => 'success', 'message' => 'Synchronization completed.']);
    exit;
}

function fetchAllSessionsFromCloud($access_token, $folder_id) {
    $files = listFilesInFolder($access_token, $folder_id);
    $sessions = [];
    foreach ($files as $file) {
        $content = downloadFile($access_token, $file['id']);
        if ($content) {
            $session_data = json_decode($content, true);
            $session_id = pathinfo($file['name'], PATHINFO_FILENAME);
            $sessions[$session_id] = $session_data;
        }
    }
    return $sessions;
}

function mergeSessions($cloud_sessions, $local_sessions) {
    $merged = $cloud_sessions;
    foreach ($local_sessions as $session_id => $chat_data) {
        // If the session doesn't exist in the cloud, add it
        if (!isset($merged[$session_id])) {
            $merged[$session_id] = $chat_data;
        } else {
            // Optionally, handle conflicts here (e.g., merge chat histories)
        }
    }
    return $merged;
}

function getOrCreateFolder($access_token, $folder_name) {
    if (isset($_SESSION['folder_id'])) {
        return $_SESSION['folder_id'];
    }
    $folder_id = getFolderId($access_token, $folder_name);
    if (!$folder_id) {
        $folder_id = createFolder($access_token, $folder_name);
        if (!$folder_id) {
            echo json_encode(['status' => 'error', 'message' => 'Failed to create folder in Google Drive.']);
            exit;
        }
    }
    $_SESSION['folder_id'] = $folder_id;
    return $folder_id;
}


function loadChats() {
    if (!isset($_SESSION['access_token'])) {
        error_log('loadChats Error: User not authenticated.');
        echo json_encode(['status' => 'error', 'message' => 'User not authenticated.']);
        exit;
    }

    $access_token = $_SESSION['access_token'];

    // Ellenőrizzük, hogy a "HungaryVFR CoPilot" mappa létezik-e
    if (isset($_SESSION['folder_id'])) {
        $folder_id = $_SESSION['folder_id'];
    } else {
        $folder_id = getFolderId($access_token, 'HungaryVFR CoPilot');

        if (!$folder_id) {
            error_log('loadChats Error: Folder not found in Google Drive.');
            echo json_encode(['status' => 'error', 'message' => 'Folder not found in Google Drive.']);
            exit;
        }

        $_SESSION['folder_id'] = $folder_id;
    }

    // Olvassuk be a requestből a session_id-t
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['session_id'])) {
        error_log('loadChats Error: No session_id provided.');
        echo json_encode(['status' => 'error', 'message' => 'No session_id provided.']);
        exit;
    }
    
    $action = isset($input['action']) ? $input['action'] : '';

    if ($action === 'synchronize') {
        $local_sessions = isset($input['local_sessions']) ? $input['local_sessions'] : [];
    
        // Itt add meg a Google Drive-hoz való mentést, és dolgozd fel az összes session-t
        // Példa:
        // foreach ($local_sessions as $session_id => $chat_data) {
        //     // Mentés Google Drive-ra
        // }
    
        // Ha a mentés sikeres
        echo json_encode(['status' => 'success', 'message' => 'Chats synchronized']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
    }

    $session_id = $input['session_id'];
    $file_name = $session_id . '.json';

    $file = findFileInFolder($access_token, $folder_id, $file_name);
    if (!$file) {
        error_log("loadChats Error: Session file $file_name not found in Google Drive.");
        echo json_encode(['status' => 'error', 'message' => 'Session file not found in Google Drive.']);
        exit;
    }

    $file_content = downloadFile($access_token, $file['id']);
    if (!$file_content) {
        error_log("loadChats Error: Failed to download session file $file_name.");
        echo json_encode(['status' => 'error', 'message' => 'Failed to download session file.']);
        exit;
    }

    $chat_data = json_decode($file_content, true);

    error_log("loadChats Success: Chat $file_name loaded.");
    echo json_encode(['status' => 'success', 'chat_data' => $chat_data]);
    exit;
}


function handleOAuthCallback() {
    global $client_id, $client_secret, $redirect_uri;

    if (!isset($_GET['code'])) {
        echo json_encode(['status' => 'error', 'message' => 'No authorization code found.']);
        error_log("OAuth Callback Error: No authorization code found.");
        exit;
    }

    $code = $_GET['code'];

    // Debugging: Ellenőrizzük a kapott code értékét
    error_log("OAuth Callback Code: " . $code);

    // Kérésezzük az access token-t
    $token_response = requestAccessToken($code, $client_id, $client_secret, $redirect_uri);

    if (!$token_response) {
        echo json_encode(['status' => 'error', 'message' => 'Failed to obtain access token.']);
        error_log("OAuth Callback Error: Failed to obtain access token.");
        exit;
    }

    $_SESSION['access_token'] = $token_response['access_token'];
    $_SESSION['refresh_token'] = $token_response['refresh_token'];

    // Felhasználó értesítése sikeres hitelesítésről
    echo '<!DOCTYPE html>
    <html lang="hu">
    <head>
        <meta charset="UTF-8">
        <title>Sikeres Hitelesítés</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
            .message { font-size: 1.2em; }
            button { padding: 10px 20px; font-size: 1em; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="message">✅ Sikeres hitelesítés! Most bezárhatod ezt az ablakot.</div>
        <button onclick="window.close()">Bezárás</button>
    </body>
    </html>';
    exit;
}

function verifyAccessToken($access_token) {
    // Ellenőrizzük az access token érvényességét
    $url = "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" . urlencode($access_token);
    $response = file_get_contents($url);
    if ($response === FALSE) {
        return false;
    }
    $data = json_decode($response, true);
    if (isset($data['error'])) {
        return false;
    }
    return true;
}

/* function refreshAccessToken($refresh_token) {
    global $client_id, $client_secret, $redirect_uri;

    $url = "https://oauth2.googleapis.com/token";
    $params = [
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'refresh_token' => $refresh_token,
        'grant_type' => 'refresh_token'
    ];

    $options = [
        'http' => [
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($params),
        ],
    ];
    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    if ($result === FALSE) {
        return null;
    }
    $data = json_decode($result, true);
    return isset($data['access_token']) ? $data['access_token'] : null;
} */

function refreshAccessToken($refresh_token) {
    global $client_id, $client_secret;

    $url = "https://oauth2.googleapis.com/token";
    $params = [
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'refresh_token' => $refresh_token,
        'grant_type' => 'refresh_token'
    ];

    $options = [
        'http' => [
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($params),
        ],
    ];
    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    if ($result === FALSE) {
        return null;
    }
    $data = json_decode($result, true);
    return isset($data['access_token']) ? $data['access_token'] : null;
}



function getFolderId($access_token, $folder_name) {
    $query = "name='" . addslashes($folder_name) . "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    $url = "https://www.googleapis.com/drive/v3/files?q=" . urlencode($query) . "&spaces=drive&fields=files(id, name)";

    $headers = [
        "Authorization: Bearer $access_token"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    if (!$response) {
        return null;
    }

    $data = json_decode($response, true);
    if (isset($data['files']) && count($data['files']) > 0) {
        // Visszaadjuk az első találatot
        return $data['files'][0]['id'];
    }

    return null;
}

function createFolder($access_token, $folder_name) {
    $url = "https://www.googleapis.com/drive/v3/files";
    $headers = [
        "Authorization: Bearer $access_token",
        "Content-Type: application/json"
    ];
    $body = json_encode([
        'name' => $folder_name,
        'mimeType' => 'application/vnd.google-apps.folder'
    ]);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    if (!$response) {
        return null;
    }

    $data = json_decode($response, true);
    return isset($data['id']) ? $data['id'] : null;
}

function listFilesInFolder($access_token, $folder_id) {
    $query = "'" . addslashes($folder_id) . "' in parents and trashed=false";
    $url = "https://www.googleapis.com/drive/v3/files?q=" . urlencode($query) . "&spaces=drive&fields=files(id, name)";

    $headers = [
        "Authorization: Bearer $access_token"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    if (!$response) {
        return [];
    }

    $data = json_decode($response, true);
    return isset($data['files']) ? $data['files'] : [];
}

function downloadFile($access_token, $file_id) {
    $url = "https://www.googleapis.com/drive/v3/files/$file_id?alt=media";
    $headers = [
        "Authorization: Bearer $access_token"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $file_content = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    return $file_content;
}

/* function findFileInFolder($access_token, $folder_id, $file_name) {
    $query = "name='" . addslashes($file_name) . "' and '$folder_id' in parents and trashed=false";
    $url = "https://www.googleapis.com/drive/v3/files?q=" . urlencode($query) . "&spaces=drive&fields=files(id, name)";
    
    $headers = [
        "Authorization: Bearer $access_token"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        error_log('findFileInFolder Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    if (!$response) {
        error_log('findFileInFolder Error: No response from Google Drive API.');
        return null;
    }

    $data = json_decode($response, true);
    if (isset($data['files']) && count($data['files']) > 0) {
        error_log("findFileInFolder Success: Found file '$file_name' with ID: " . $data['files'][0]['id']);
        return $data['files'][0];
    }

    error_log("findFileInFolder Info: File '$file_name' not found in folder ID '$folder_id'.");
    return null;
} */

function findFileInFolder($access_token, $folder_id, $file_name) {
    $query = "name='" . addslashes($file_name) . "' and '" . $folder_id . "' in parents and trashed=false";
    $url = "https://www.googleapis.com/drive/v3/files?q=" . urlencode($query) . "&spaces=drive&fields=files(id, name)";

    $headers = [
        "Authorization: Bearer $access_token"
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        error_log('findFileInFolder Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    if (!$response) {
        error_log('findFileInFolder Error: No response from Google Drive API.');
        return null;
    }

    $data = json_decode($response, true);
    if (isset($data['files']) && count($data['files']) > 0) {
        return $data['files'][0];
    }

    return null;
}


function createFile($access_token, $folder_id, $file_name, $content) {
    $url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    $boundary = uniqid();
    $delimiter = '-------------' . $boundary;

    $metadata = json_encode([
        'name' => $file_name,
        'parents' => [$folder_id],
        'mimeType' => 'application/json'
    ]);

    $body = "--" . $delimiter . "\r\n";
    $body .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
    $body .= $metadata . "\r\n";
    $body .= "--" . $delimiter . "\r\n";
    $body .= "Content-Type: application/json\r\n\r\n";
    $body .= $content . "\r\n";
    $body .= "--" . $delimiter . "--";

    $headers = [
        "Authorization: Bearer $access_token",
        "Content-Type: multipart/related; boundary=" . $delimiter,
        "Content-Length: " . strlen($body)
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    return $response ? json_decode($response, true) : null;
}

/* function updateFile($access_token, $file_id, $content) {
    $url = "https://www.googleapis.com/upload/drive/v3/files/$file_id?uploadType=multipart";
    $boundary = uniqid();
    $delimiter = '-------------' . $boundary;

    $metadata = json_encode([
        'mimeType' => 'application/json'
    ]);

    $body = "--" . $delimiter . "\r\n";
    $body .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
    $body .= $metadata . "\r\n";
    $body .= "--" . $delimiter . "\r\n";
    $body .= "Content-Type: application/json\r\n\r\n";
    $body .= $content . "\r\n";
    $body .= "--" . $delimiter . "--";

    $headers = [
        "Authorization: Bearer $access_token",
        "Content-Type: multipart/related; boundary=" . $delimiter,
        "Content-Length: " . strlen($body)
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_PUT, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);

    return $response ? json_decode($response, true) : null;
} */

function updateFile($access_token, $file_id, $content) {
    $url = "https://www.googleapis.com/upload/drive/v3/files/$file_id?uploadType=media";

    $headers = [
        "Authorization: Bearer $access_token",
        "Content-Type: application/json",
        "Content-Length: " . strlen($content)
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    // Use PATCH method for updates
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('Curl error in updateFile: ' . curl_error($ch));
    }
    curl_close($ch);

    return $response ? json_decode($response, true) : null;
}

function requestAccessToken($code, $client_id, $client_secret, $redirect_uri) {
    $url = "https://oauth2.googleapis.com/token";
    $params = [
        'code' => $code,
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'redirect_uri' => $redirect_uri,
        'grant_type' => 'authorization_code'
    ];

    $options = [
        'http' => [
            'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($params),
        ],
    ];
    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    if ($result === FALSE) {
        return null;
    }
    $data = json_decode($result, true);
    return $data;
}

/* function mergeSessions($cloud_sessions, $local_sessions) {
    $merged = [];

    // Feltételezzük, hogy minden session rendelkezik egy egyedi 'session_id'-val
    $existing_ids = [];

    foreach ($cloud_sessions as $session) {
        if (isset($session['session_id'])) {
            $merged[$session['session_id']] = $session;
            $existing_ids[] = $session['session_id'];
        }
    }

    foreach ($local_sessions as $session) {
        if (isset($session['session_id']) && !in_array($session['session_id'], $existing_ids)) {
            $merged[$session['session_id']] = $session;
        }
    }

    return $merged;
} */
?>
