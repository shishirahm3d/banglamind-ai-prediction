<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

error_log("Chat API called with method: " . $_SERVER['REQUEST_METHOD']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
error_log("Input received: " . print_r($input, true));

if (!$input || !isset($input['task']) || !isset($input['data'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input - task or data not provided']);
    exit;
}

$task = $input['task'];
$data = $input['data']; // This can be string or array based on task

// Get model and API URL from request or use defaults
$model = $input['model'] ?? "hf.co/shishirahm3d/banglamind-8b-instruct-bnb-4bit-q4km-GGUF:latest";
$ollama_url = $input['apiUrl'] ?? "http://203.190.9.169:11435/api/chat"; 
$parameters = $input['parameters'] ?? [
    'temperature' => 0.8,
    'top_k' => 40,
    'repeat_penalty' => 1.1,
    'min_p_sampling' => 0.05,
    'top_p' => 0.95
];

$system_prompt = "";
$user_prompt = "";

switch ($task) {
    case 'influencer_identification':
        // Refined prompt to explicitly request JSON ONLY for EVERY user, not just influencers.
        $system_prompt = "You are an expert social media analyst. Your task is to identify potential social media influencers from provided comment and reaction data. Analyze the text to identify users and infer metrics like follower count, engagement, and activity. Output the result strictly as a JSON array of objects, where each object has 'name', 'followers' (e.g., '1M', '500K'), 'engagementRate' (e.g., '5.2'), and 'activity' (e.g., 'High', 'Frequent'). If no influencers are found, return an empty array. Do not include any other text or formatting outside the JSON. Also do it for every user in the data, not just influencers.";
        $user_prompt = "Analyze the following social media interactions:\n\n" . $data;
        break;

    case 'sentiment_analysis':
        // Refined prompt to explicitly request JSON ONLY.
        $system_prompt = "You are an expert sentiment analysis model. Your task is to analyze the emotional tone of the given text and classify it as 'Positive', 'Negative', or 'Neutral'. Provide a brief, concise explanation for your classification. Output the result **strictly as a JSON object** with keys: 'sentiment' (string: 'Positive', 'Negative', 'Neutral') and 'explanation' (string). **DO NOT include any introductory or concluding text, explanations, or any other formatting outside the JSON object.**";
        $user_prompt = "Analyze the sentiment of the following text:\n\n" . $data;
        break;

    case 'predictive_situation':
        // Refined prompt to explicitly request JSON ONLY.
        $system_prompt = "You are an advanced AI for predictive situation analysis. Analyze the provided multi-source data (news, YouTube, social media) in relation to the scheduled date. Predict whether the upcoming date is likely to experience a 'Positive' (favorable), 'Negative' (unfavorable), or 'Neutral' situation/event. Also, assess potential situations/opportunities, forecast likely events/conditions, and recommend actionable measures for preparedness. Output the result **strictly as a JSON object** with keys: 'outcome' (string: 'Positive', 'Negative', 'Neutral'), 'situations' (string), 'events' (string), and 'recommendations' (array of strings). **DO NOT include any introductory or concluding text, explanations, or any other formatting outside the JSON object.**";
        $user_prompt = "Analyze the following data for a prediction on the scheduled date {$data['date']}:\n\n";
        if (!empty($data['news'])) $user_prompt .= "News/Reports:\n" . $data['news'] . "\n\n";
        if (!empty($data['youtube'])) $user_prompt .= "YouTube Summaries/Links:\n" . $data['youtube'] . "\n\n";
        if (!empty($data['socialMedia'])) $user_prompt .= "Social Media Trends:\n" . $data['socialMedia'] . "\n\n";
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unknown task specified.']);
        exit;
}

$messages = [
    ['role' => 'system', 'content' => $system_prompt],
    ['role' => 'user', 'content' => $user_prompt]
];

error_log("Using model: " . $model);
error_log("Using API URL: " . $ollama_url);
error_log("Messages being sent: " . print_r($messages, true));

// Prepare the request data for Ollama
$requestData = [
    'model' => $model,
    'messages' => $messages,
    'temperature' => $parameters['temperature'],
    'top_k' => $parameters['top_k'],
    'repeat_penalty' => $parameters['repeat_penalty'],
    'min_p_sampling' => $parameters['min_p_sampling'],
    'top_p' => $parameters['top_p'],
    'stream' => true // We still process stream, but concatenate for a single response
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $ollama_url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'ngrok-skip-browser-warning: true' // Keep this if using ngrok
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 120); // Increase timeout for potentially longer AI responses
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For self-signed certs or local testing
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

error_log("cURL response code: " . $httpCode);
error_log("cURL error: " . $error);
error_log("Raw Ollama Response: " . $response);


if ($error) {
    echo json_encode(['success' => false, 'error' => 'cURL error: ' . $error]);
    exit;
}

if ($httpCode !== 200) {
    echo json_encode(['success' => false, 'error' => 'Ollama API HTTP error: ' . $httpCode . ' - Response: ' . $response]);
    exit;
}

// Process the streaming response from Ollama
$lines = explode("\n", $response);
$fullResponse = '';

foreach ($lines as $line) {
    $line = trim($line);
    if (empty($line)) continue;
    
    $data = json_decode($line, true);
    if ($data && isset($data['message']['content'])) {
        $fullResponse .= $data['message']['content'];
    }
    
    if ($data && isset($data['done']) && $data['done']) {
        break;
    }
}

if (empty($fullResponse)) {
    echo json_encode(['success' => false, 'error' => 'No content received from AI model.']);
    exit;
}

// The client-side JavaScript expects 'response' key for the raw AI output.
echo json_encode([
    'success' => true,
    'response' => $fullResponse // Send the raw, concatenated AI response back
]);
?>