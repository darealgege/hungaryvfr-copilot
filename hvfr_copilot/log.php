<?php
session_start();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $logData = json_decode(file_get_contents('php://input'), true);
    if ($logData && isset($logData['message'])) {
        // Generating or retrieving the session log ID
        if (!isset($_SESSION['log_id'])) {
            $_SESSION['log_id'] = uniqid();
        }
        $logId = $_SESSION['log_id'];
        $logFile = 'chatlogs/' . date('Y-m-d') . '_' . $logId . '.log';
        
        // Adding date and time to each log entry
        $dateTime = date('y-m-d_H:i:s');
        $logMessage = $dateTime . ' - ' . $logData['message'] . PHP_EOL;

        file_put_contents($logFile, $logMessage, FILE_APPEND);
        echo json_encode(['status' => 'success', 'log_id' => $logId]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid data']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}
