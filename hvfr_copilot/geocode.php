<?php
if (isset($_GET['lat']) && isset($_GET['lon'])) {
    $lat = $_GET['lat'];
    $lon = $_GET['lon'];

    $url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lon";    

    // cURL használata file_get_contents helyett
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'HungaryVFR'); // Nominatim felhasználói ügynök szükséges

    $response = curl_exec($ch);

    if ($response === FALSE) {
        echo json_encode(['status' => 'error', 'message' => 'Failed to connect to geocoding API']);
        exit;
    }

    $data = json_decode($response, true);

    curl_close($ch);

    if (isset($data['address'])) {
        $address = $data['display_name'] ?? 'Unknown';
        $country = $data['address']['country'] ?? 'Unknown';
        $countryCode = $data['address']['country_code'] ?? 'Unknown';
        $state = $data['address']['state'] ?? 'Unknown';
        $region = $data['address']['region'] ?? 'Unknown';
        $city = $data['address']['city'] ?? $data['address']['town'] ?? $data['address']['village'] ?? 'Unknown';
        $suburb = $data['address']['suburb'] ?? 'Unknown';
        $road = $data['address']['road'] ?? 'Unknown';
        $postcode = $data['address']['postcode'] ?? 'Unknown';
        $houseNumber = $data['address']['house_number'] ?? 'Unknown';
        $cityDistrict = $data['address']['city_district'] ?? 'Unknown';
        $neighbourhood = $data['address']['neighbourhood'] ?? 'Unknown';
        $county = $data['address']['county'] ?? 'Unknown';
        $municipality = $data['address']['municipality'] ?? 'Unknown';
        $borough = $data['address']['borough'] ?? 'Unknown';

        echo json_encode([
            'status' => 'success',
            'address' => $address,
            'country' => $country,
            'country_code' => $countryCode,
            'state' => $state,
            'region' => $region,
            'city' => $city,
            'suburb' => $suburb,
            'city_district' => $cityDistrict,
            'borough' => $borough,
            'road' => $road,
            'house_number' => $houseNumber,
            'neighbourhood' => $neighbourhood,
            'county' => $county,
            'municipality' => $municipality,
            'postcode' => $postcode
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'No address found for the given coordinates']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid coordinates']);
}
?>
