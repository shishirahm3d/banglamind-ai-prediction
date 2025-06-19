// Global variables - Re-introducing chat history related variables
let selectedChatFilename = null; // For context menu on history items
let currentLoadedLogMessages = []; // Stores the messages of the currently loaded log
// Removed SYSTEM_PROMPT as it's for AI Lawyer chat
let appSettings = {
  model: "hf.co/shishirahm3d/banglamind-8b-instruct-bnb-4bit-q4km-GGUF:latest",
  apiUrl: "http://203.190.9.169:11435/api/chat",
  temperature: 0.8,
}

// API Configuration - Re-introducing chat history endpoints
const API_CONFIG = {
  settingsEndpoint: "./api/settings.php",
  mainAIEndpoint: "./api/chat.php", // Unified AI interaction for prediction
  saveEndpoint: "./api/save_chat.php",      // For saving prediction logs
  loadEndpoint: "./api/load_chat.php",      // For loading prediction logs
  historyEndpoint: "./api/chat_history.php",// For getting list of prediction logs
  deleteEndpoint: "./api/delete_chat.php",  // For deleting prediction logs
  renameEndpoint: "./api/rename_chat.php",  // For renaming prediction logs
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeApp()
  setupEventListeners()
  loadSettings()
  initDarkMode()
  loadChatHistory(); // Load history on startup
  showFeature('influencer'); // Start with Influencer Analysis visible
})

function initializeApp() {
  // Event listeners for file inputs (new for prediction features)
  document.getElementById('influencerFileInput').addEventListener('change', function(event) {
      handleFileUpload(event, 'influencerTextInput');
  });
  document.getElementById('sentimentFileInput').addEventListener('change', function(event) {
      handleFileUpload(event, 'sentimentTextInput');
  });
}

function initDarkMode() {
  const darkModeEnabled = localStorage.getItem("darkMode") === "true"
  if (darkModeEnabled) {
    document.body.classList.add("dark-mode")
    document.getElementById("themeIcon").classList.remove("fa-moon")
    document.getElementById("themeIcon").classList.add("fa-sun")
  }
}

function toggleDarkMode() {
  const isDarkMode = document.body.classList.toggle("dark-mode")
  const themeIcon = document.getElementById("themeIcon")

  if (isDarkMode) {
    themeIcon.classList.remove("fa-moon")
    themeIcon.classList.add("fa-sun")
  } else {
    themeIcon.classList.remove("fa-sun")
    themeIcon.classList.add("fa-moon")
  }

  localStorage.setItem("darkMode", isDarkMode)
}

function setupEventListeners() {
  // Temperature slider
  const temperatureSlider = document.getElementById("temperatureInput")
  const temperatureValue = document.getElementById("temperatureValue")

  if (temperatureSlider) {
    temperatureSlider.addEventListener("input", function () {
      temperatureValue.textContent = this.value
    })
  }
  
  // Re-add close context menu
  document.addEventListener("click", (e) => {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu && contextMenu.style.display === "block" && !contextMenu.contains(e.target)) {
      contextMenu.style.display = "none";
    }
  });
}

function updateStatus(text, type) {
  const statusText = document.getElementById("statusText")
  const statusDot = document.querySelector(".status-dot")

  statusText.textContent = text

  statusDot.className = "status-dot"
  if (type === "thinking") {
    statusDot.style.background = "#ff9500"
  } else if (type === "ready") {
    statusDot.style.background = "#10a37f"
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar")
  sidebar.classList.toggle("open")
}

// Show loading modal
function showLoading() {
  document.getElementById("loadingModal").style.display = "flex"
}

// Hide loading modal
function hideLoading() {
  document.getElementById("loadingModal").style.display = "none"
}

function openSettings() {
  document.getElementById("modelInput").value = appSettings.model
  document.getElementById("apiUrlInput").value = appSettings.apiUrl
  document.getElementById("temperatureInput").value = appSettings.temperature
  document.getElementById("temperatureValue").textContent = appSettings.temperature

  document.getElementById("settingsModal").style.display = "flex"
}

function closeSettings() {
  document.getElementById("settingsModal").style.display = "none"
}

async function saveSettings() {
  const model = document.getElementById("modelInput").value.trim()
  const apiUrl = document.getElementById("apiUrlInput").value.trim()
  const temperature = Number.parseFloat(document.getElementById("temperatureInput").value)

  if (!model || !apiUrl) {
    alert("Please fill in all fields.")
    return;
  }

  appSettings = {
    model,
    apiUrl,
    temperature,
  }

  try {
    const response = await fetch(API_CONFIG.settingsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(appSettings),
    })

    const data = await response.json()

    if (data.success) {
      alert("Settings saved successfully!")
      closeSettings()
    } else {
      alert("Error saving settings: " + data.error)
    }
  } catch (error) {
    console.error("Error saving settings:", error)
    alert("Error saving settings. Please try again.")
  }
}

async function loadSettings() {
  try {
    const response = await fetch(API_CONFIG.settingsEndpoint)
    const data = await response.json()

    if (data.success && data.settings) {
      appSettings = {
        model: data.settings.model || appSettings.model,
        apiUrl: data.settings.apiUrl || appSettings.apiUrl,
        temperature: data.settings.temperature || appSettings.temperature,
      }
    }
  } catch (error) {
    console.error("Error loading settings:", error)
  }
}

// --- Re-introduced Chat History Management Functions (adapted for "logs") ---

async function saveCurrentChat() { // Now "save current log"
  let logTitle = "Untitled Log";
  let logContent = []; // This will store the data to be saved

  const influencerSection = document.getElementById('influencerSection');
  const sentimentSection = document.getElementById('sentimentSection');
  const predictiveSection = document.getElementById('predictiveSection');

  // Determine which section is active and capture its data
  if (influencerSection.style.display === 'flex') {
      const input = document.getElementById('influencerTextInput').value.trim();
      const output = document.getElementById('influencerResults').innerHTML.trim();
      if (!input && !output) { alert("No data in Influencer Analysis to save."); return; }
      logTitle = "Influencer Log: " + (input.substring(0, 30) || "No input") + "...";
      logContent.push({role: "influencer_input", content: input});
      logContent.push({role: "influencer_output", content: output});
  } else if (sentimentSection.style.display === 'flex') {
      const input = document.getElementById('sentimentTextInput').value.trim();
      const output = document.getElementById('sentimentResults').innerHTML.trim();
      if (!input && !output) { alert("No data in Sentiment Analysis to save."); return; }
      logTitle = "Sentiment Log: " + (input.substring(0, 30) || "No input") + "...";
      logContent.push({role: "sentiment_input", content: input});
      logContent.push({role: "sentiment_output", content: output});
  } else if (predictiveSection.style.display === 'flex') {
      const newsData = document.getElementById('newsInput').value.trim();
      const youtubeData = document.getElementById('youtubeInput').value.trim();
      const socialMediaData = document.getElementById('socialMediaInput').value.trim();
      const scheduledDate = document.getElementById('scheduledDate').value.trim();
      const output = document.getElementById('predictiveResults').innerHTML.trim();
      
      if (!newsData && !youtubeData && !socialMediaData && !scheduledDate && !output) {
          alert("No data in Predictive Analysis to save.");
          return;
      }
      logTitle = "Prediction Log: " + (newsData || youtubeData || socialMediaData || "No input") .substring(0, 30) + "...";
      logContent.push({role: "predictive_news", content: newsData});
      logContent.push({role: "predictive_youtube", content: youtubeData});
      logContent.push({role: "predictive_social", content: socialMediaData});
      logContent.push({role: "predictive_date", content: scheduledDate});
      logContent.push({role: "predictive_output", content: output});
  } else {
      alert("No active prediction data to save.");
      return;
  }

  try {
    const response = await fetch(API_CONFIG.saveEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: logContent, // Re-use 'messages' key
        customTitle: logTitle // Pass a custom title for the filename
      }),
    });

    const data = await response.json();

    if (data.success) {
      alert("Log saved successfully!");
      loadChatHistory(); // Reload history after saving
    } else {
      alert("Error saving log: " + data.error);
    }
  } catch (error) {
    console.error("Error saving log:", error);
    alert("Error saving log. Please try again.");
  }
}

function downloadChatLog() { // Now "download current log"
  if (currentLoadedLogMessages.length === 0) {
    alert("No log messages loaded to download. Load a log from history first.");
    return;
  }

  const logContent = currentLoadedLogMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");
  const blob = new Blob([logContent], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "prediction_log.txt"; // Generic name for downloaded log
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showContextMenu(event, filename) {
  event.preventDefault();
  selectedChatFilename = filename;

  const contextMenu = document.getElementById("contextMenu");
  contextMenu.style.display = "block";
  contextMenu.style.left = event.pageX + "px";
  contextMenu.style.top = event.pageY + "px";
}

async function deleteSelectedChat() { // Now "delete selected log"
  if (!selectedChatFilename) return;

  if (confirm("Are you sure you want to delete this log?")) {
    try {
      const response = await fetch(API_CONFIG.deleteEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: selectedChatFilename,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Log deleted successfully!");
        loadChatHistory(); // Reload history after deletion
        clearCurrentPredictionView(); // Clear inputs if deleted log was active
      } else {
        alert("Error deleting log: " + data.error);
      }
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Error deleting log. Please try again.");
    }
  }

  document.getElementById("contextMenu").style.display = "none";
}

function openRenameModal() {
  if (!selectedChatFilename) return;

  document.getElementById("chatToRename").value = selectedChatFilename;
  // Pre-fill the new name input with a cleaned version of the current name
  let currentTitle = selectedChatFilename.replace(/_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.txt$/, '');
  document.getElementById("newChatNameInput").value = currentTitle;
  document.getElementById("renameChatModal").style.display = "flex";
  document.getElementById("contextMenu").style.display = "none";
}

function closeRenameModal() {
  document.getElementById("renameChatModal").style.display = "none";
  document.getElementById("newChatNameInput").value = ''; // Clear input
}

async function renameChat() { // Now "rename selected log"
  const filename = document.getElementById("chatToRename").value;
  const newName = document.getElementById("newChatNameInput").value.trim();

  if (!filename || !newName) {
    alert("Please enter a new name.");
    return;
  }

  try {
    const response = await fetch(API_CONFIG.renameEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: filename,
        newName: newName,
      }),
    });

    const data = await response.json();

    if (data.success) {
      alert("Log renamed successfully!");
      closeRenameModal();
      loadChatHistory(); // Reload history after renaming
    } else {
      alert("Error renaming log: " + data.error);
    }
  } catch (error) {
    console.error("Error renaming log:", error);
    alert("Error renaming log. Please try again.");
  }
}

async function loadChatHistory() { // Now "load log history"
  try {
    const response = await fetch(API_CONFIG.historyEndpoint);
    const data = await response.json();

    if (data.success) {
      const historyList = document.getElementById("chatHistoryList");
      historyList.innerHTML = "";

      data.chats.forEach((chat) => {
        const chatItem = document.createElement("div");
        chatItem.className = "chat-history-item";
        chatItem.textContent = chat.title;
        chatItem.onclick = () => loadChat(chat.filename); // Will load the log
        chatItem.oncontextmenu = (e) => showContextMenu(e, chat.filename);
        historyList.appendChild(chatItem);
      });
    }
  } catch (error) {
    console.error("Error loading log history:", error);
  }
}

async function loadChat(filename) { // Now "load specific log"
  try {
    const response = await fetch(API_CONFIG.loadEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: filename }),
    });

    const data = await response.json();

    if (data.success) {
      currentLoadedLogMessages = data.messages; // Store loaded messages
      displayLoadedLog(currentLoadedLogMessages); // Display them in the appropriate sections
      selectedChatFilename = filename; // Mark this as the currently loaded log
    } else {
      alert("Error loading log: " + data.error);
    }
  } catch (error) {
    console.error("Error loading log:", error);
    alert("Error loading log. Please try again.");
  }
}

function displayLoadedLog(messages) {
    clearCurrentPredictionView(); // Clear current inputs/outputs

    // Parse messages and populate appropriate fields
    let activeSection = null;
    let influencerText = "";
    let sentimentText = "";
    let newsText = "";
    let youtubeText = "";
    let socialMediaText = "";
    let scheduledDate = "";
    let influencerOutput = "";
    let sentimentOutput = "";
    let predictiveOutput = "";

    messages.forEach(msg => {
        if (msg.role === "influencer_input") {
            influencerText = msg.content;
            activeSection = 'influencer';
        } else if (msg.role === "influencer_output") {
            influencerOutput = msg.content;
        } else if (msg.role === "sentiment_input") {
            sentimentText = msg.content;
            activeSection = 'sentiment';
        } else if (msg.role === "sentiment_output") {
            sentimentOutput = msg.content;
        } else if (msg.role === "predictive_news") {
            newsText = msg.content;
            activeSection = 'predictive';
        } else if (msg.role === "predictive_youtube") {
            youtubeText = msg.content;
            activeSection = 'predictive';
        } else if (msg.role === "predictive_social") {
            socialMediaText = msg.content;
            activeSection = 'predictive';
        } else if (msg.role === "predictive_date") {
            scheduledDate = msg.content;
            activeSection = 'predictive';
        } else if (msg.role === "predictive_output") {
            predictiveOutput = msg.content;
        }
    });

    // Show the relevant section and populate its fields
    if (activeSection === 'influencer') {
        showFeature('influencer');
        document.getElementById('influencerTextInput').value = influencerText;
        document.getElementById('influencerResults').innerHTML = influencerOutput;
    } else if (activeSection === 'sentiment') {
        showFeature('sentiment');
        document.getElementById('sentimentTextInput').value = sentimentText;
        document.getElementById('sentimentResults').innerHTML = sentimentOutput;
    } else if (activeSection === 'predictive') {
        showFeature('predictive');
        document.getElementById('newsInput').value = newsText;
        document.getElementById('youtubeInput').value = youtubeText;
        document.getElementById('socialMediaInput').value = socialMediaText;
        document.getElementById('scheduledDate').value = scheduledDate;
        document.getElementById('predictiveResults').innerHTML = predictiveOutput;
    } else {
        alert("Could not determine the log type or log is empty. Clearing current view.");
        clearCurrentPredictionView();
    }
}

function clearCurrentPredictionView() {
    // Clear all input fields
    document.getElementById('influencerTextInput').value = '';
    // Clear file inputs require resetting the value, which can be tricky for security.
    // Setting to empty string is fine for text inputs. For file inputs, best to leave as is or inform user.
    // document.getElementById('influencerFileInput').value = ''; // This will prevent re-uploading same file easily
    document.getElementById('influencerResults').innerHTML = '<h3>Results:</h3><p>Influencers will appear here.</p>';

    document.getElementById('sentimentTextInput').value = '';
    // document.getElementById('sentimentFileInput').value = '';
    document.getElementById('sentimentResults').innerHTML = '<h3>Results:</h3><p>Sentiment will appear here.</p>';

    document.getElementById('newsInput').value = '';
    document.getElementById('youtubeInput').value = '';
    document.getElementById('socialMediaInput').value = '';
    document.getElementById('scheduledDate').value = '';
    document.getElementById('predictiveResults').innerHTML = '<h3>Prediction:</h3><p>Prediction and recommendations will appear here.</p>';
}


function toggleChatHistory() { // Now "toggle log history"
  const historyList = document.getElementById("chatHistoryList");
  historyList.style.display = historyList.style.display === "none" ? "block" : "none";
}


// --- Prediction Features Functions (unchanged from previous step, but included for completeness) ---

// Function to handle file uploads for text areas
function handleFileUpload(event, targetTextareaId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(targetTextareaId).value = e.target.result;
        };
        reader.readAsText(file);
    }
}

// Function to switch between feature sections (updated to reflect no chat section)
function showFeature(featureName) {
    const sections = ['influencerSection', 'sentimentSection', 'predictiveSection'];
    const buttons = ['btnInfluencer', 'btnSentiment', 'btnPredictive'];

    sections.forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    buttons.forEach(id => {
        document.getElementById(id).classList.remove('active');
    });

    document.getElementById(`${featureName}Section`).style.display = 'flex';
    document.getElementById(`btn${featureName.charAt(0).toUpperCase() + featureName.slice(1)}`).classList.add('active');

    updateStatus("Ready", "ready");
}


// Unified function to call the AI backend for prediction tasks
async function callAIPredictionAPI(task, inputData, resultsElementId, loadingMessage) {
    const resultsElement = document.getElementById(resultsElementId);

    showLoading();
    document.getElementById('loadingText').textContent = loadingMessage;
    resultsElement.innerHTML = '<h3>Results:</h3><p>Processing...</p>'; // Clear results area

    try {
        const response = await fetch(API_CONFIG.mainAIEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task: task, // Indicate which task the AI should perform
                data: inputData, // The specific data for the task
                model: appSettings.model,
                apiUrl: appSettings.apiUrl,
                parameters: { // Use parameters from settings
                    temperature: appSettings.temperature,
                    top_k: 40,
                    repeat_penalty: 1.1,
                    min_p_sampling: 0.05,
                    top_p: 0.95,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            return data.response; // Return the raw AI response string
        } else {
            resultsElement.innerHTML = `<p style="color: red;">Error: ${data.error || 'Unknown error occurred.'}</p>`;
            return null;
        }
    } catch (error) {
        console.error(`Error during ${task} analysis:`, error);
        resultsElement.innerHTML = `<p style="color: red;">Failed to perform analysis: ${error.message}</p>`;
        return null;
    } finally {
        hideLoading();
    }
}


async function analyzeInfluencers() {
    const influencerTextInput = document.getElementById('influencerTextInput').value.trim();
    const influencerResults = document.getElementById('influencerResults');

    if (!influencerTextInput) {
        influencerResults.innerHTML = '<p style="color: red;">Please enter or upload data for influencer analysis.</p>';
        return;
    }

    const aiResponse = await callAIPredictionAPI(
        'influencer_identification',
        influencerTextInput,
        'influencerResults',
        'Analyzing influencer data...'
    );

    if (aiResponse) {
        let resultHtml = '<h3>Identified Influencers:</h3>';
        try {
            // Attempt to parse the AI's response as JSON
            const influencers = JSON.parse(aiResponse);
            if (Array.isArray(influencers) && influencers.length > 0) {
                resultHtml += '<ul>';
                influencers.forEach(influencer => {
                    resultHtml += `<li><strong>${influencer.name || 'Unknown User'}</strong>: Followers: ${influencer.followers || 'N/A'}, Engagement Rate: ${influencer.engagementRate || 'N/A'}%, Activity: ${influencer.activity || 'N/A'}</li>`;
                });
                resultHtml += '</ul>';
            } else {
                resultHtml += '<p>No significant influencers identified or AI response was not in expected format.</p>';
                resultHtml += `<p>AI Raw Response: ${aiResponse}</p>`; // Show raw response for debugging
            }
        } catch (e) {
            // If AI response is not valid JSON, display it as plain text
            resultHtml += '<p>AI response could not be parsed as structured data. Here is the raw response:</p>';
            resultHtml += `<pre>${aiResponse}</pre>`;
        }
        influencerResults.innerHTML = resultHtml;
    }
}

async function performSentimentAnalysis() {
    const sentimentTextInput = document.getElementById('sentimentTextInput').value.trim();
    const sentimentResults = document.getElementById('sentimentResults');

    if (!sentimentTextInput) {
        sentimentResults.innerHTML = '<p style="color: red;">Please enter or upload text for sentiment analysis.</p>';
        return;
    }

    const aiResponse = await callAIPredictionAPI(
        'sentiment_analysis',
        sentimentTextInput,
        'sentimentResults',
        'Analyzing sentiment...'
    );

    if (aiResponse) {
        let resultHtml = '<h3>Overall Sentiment:</h3>';
        try {
            // Attempt to parse the AI's response as JSON (e.g., { "sentiment": "Positive", "explanation": "..." })
            const sentimentData = JSON.parse(aiResponse);
            if (sentimentData && sentimentData.sentiment) {
                resultHtml += `<p class="prediction-outcome-${sentimentData.sentiment.toLowerCase()}"><strong>${sentimentData.sentiment}</strong></p>`;
                resultHtml += `<p>${sentimentData.explanation || ''}</p>`;
            } else {
                resultHtml += '<p>AI response was not in expected sentiment format.</p>';
                resultHtml += `<p>AI Raw Response: ${aiResponse}</p>`;
            }
        } catch (e) {
            resultHtml += '<p>AI response could not be parsed as structured data. Here is the raw response:</p>';
            resultHtml += `<pre>${aiResponse}</pre>`;
        }
        sentimentResults.innerHTML = resultHtml;
    }
}

async function predictSituation() {
    const newsData = document.getElementById('newsInput').value.trim();
    const youtubeData = document.getElementById('youtubeInput').value.trim();
    const socialMediaData = document.getElementById('socialMediaInput').value.trim();
    const scheduledDate = document.getElementById('scheduledDate').value.trim();
    const predictiveResults = document.getElementById('predictiveResults');

    if (!newsData && !youtubeData && !socialMediaData && !scheduledDate) {
        predictiveResults.innerHTML = '<p style="color: red;">Please provide at least some data (news, YouTube, social media, or a scheduled date) for prediction.</p>';
        return;
    }

    const inputData = {
        news: newsData,
        youtube: youtubeData,
        socialMedia: socialMediaData,
        date: scheduledDate
    };

    const aiResponse = await callAIPredictionAPI(
        'predictive_situation',
        inputData,
        'predictiveResults',
        'Generating situation prediction...'
    );

    if (aiResponse) {
        let resultHtml = `<h3>Prediction for ${scheduledDate || 'N/A'}:</h3>`;
        try {
            const predictionData = JSON.parse(aiResponse);
            if (predictionData && predictionData.outcome) {
                resultHtml += `<p><strong>Outcome:</strong> <span class="prediction-outcome-${predictionData.outcome.toLowerCase()}">${predictionData.outcome}</span></p>`;
                resultHtml += `<p><strong>Potential Situations/Opportunities:</strong> ${predictionData.situations || 'N/A'}</p>`;
                resultHtml += `<p><strong>Likely Events/Conditions:</strong> ${predictionData.events || 'N/A'}</p>`;
                resultHtml += `<h4>Recommended Actions:</h4><ul>`;
                if (predictionData.recommendations && predictionData.recommendations.length > 0) {
                    predictionData.recommendations.forEach(rec => {
                        resultHtml += `<li>${rec}</li>`;
                    });
                } else {
                    resultHtml += `<li>No specific recommendations at this time.</li>`;
                }
                resultHtml += `</ul>`;
            } else {
                resultHtml += '<p>AI response was not in expected prediction format.</p>';
                resultHtml += `<p>AI Raw Response: ${aiResponse}</p>`;
            }
        } catch (e) {
            resultHtml += '<p>AI response could not be parsed as structured data. Here is the raw response:</p>';
            resultHtml += `<pre>${aiResponse}</pre>`;
        }
        predictiveResults.innerHTML = resultHtml;
    }
}