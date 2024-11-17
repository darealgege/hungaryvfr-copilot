<?php

// Betöltjük a .env fájlt
function loadEnv($path) {
    if (!file_exists($path)) {
        throw new Exception('.env fájl nem található');
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

// Új kód a build szám kinyeréséhez a legnagyobb build szám alapján
$js_files = glob(__DIR__ . '/ui_*.js');
$css_files = glob(__DIR__ . '/css/hvfr_webui_*.css');

$js_build_number = '';
$css_build_number = '';
$js_filename = '';
$css_filename = '';
$max_js_build_number = -1;
$max_css_build_number = -1;

// JavaScript build szám keresése
if (count($js_files) > 0) {
    foreach ($js_files as $file) {
        $filename = basename($file);
        if (preg_match('/ui_(\d+)\.js$/', $filename, $matches)) {
            $current_build_number = (int)$matches[1];
            if ($current_build_number > $max_js_build_number) {
                $max_js_build_number = $current_build_number;
                $js_filename = $filename;
                $js_build_number = $current_build_number;
            }
        }
    }
}

// CSS build szám keresése
if (count($css_files) > 0) {
    foreach ($css_files as $file) {
        $filename = basename($file);
        if (preg_match('/hvfr_webui_(\d+)\.css$/', $filename, $matches)) {
            $current_build_number = (int)$matches[1];
            if ($current_build_number > $max_css_build_number) {
                $max_css_build_number = $current_build_number;
                $css_filename = $filename;
                $css_build_number = $current_build_number;
            }
        }
    }
}

loadEnv(__DIR__ . '/.env');

?>

<!DOCTYPE html>
<html lang="hu">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:type" content="website" />
    <meta property="og:title" content="HungaryVFR CoPilot" />
    <meta property="og:description"
        content="HungaryVFR CoPilot is a web-based assistant specializing in aviation and flight simulation. Although it shares its knowledge base with the HungaryVFR CoPilot Discord bot, it functions separately and offers details on Discord commands without executing them. Get expert support and real-time assistance with your aviation questions." />
    <meta property="og:url" content="https://www.hungaryvfr.hu/chat" />
    <meta property="og:site_name" content="HungaryVFR CoPilot" />
    <meta property="og:image" content="https://hungaryvfr.hu/images/thumbnail.jpg" />
    <meta property="og:image:secure_url" content="https://hungaryvfr.hu/images/thumbnail.jpg" />
    <meta name="keywords"
        content="flight, simulator, msfs, fs2020, hungary, vfr, hungaryvfr, hvfr, microsoft, simulator, budapest, magyarország, magyarorszag, flightsimulator, flight simulator, lhdk, lhbs, lhtl, lhud, lhbp, ferihegy, liszt ferenc, international, airport, airfield">
    <title>HungaryVFR CoPilot</title>
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <!-- <link rel="stylesheet" type="text/css" href="css/hvfr_webui_78.css"> -->
    <link rel="stylesheet" type="text/css" href="css/<?php echo htmlspecialchars($css_filename); ?>">

    

    <!-- In your head section -->
    <!-- In your head section -->
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/driver.js@0.9.8/dist/driver.min.css">

    <script src="https://unpkg.com/driver.js@0.9.8/dist/driver.min.js"></script>
    <script type="text/javascript" async
    src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.7/MathJax.js?config=TeX-MML-AM_CHTML"></script>
    
    <script>
        const api_client_id = "<?php echo $_ENV['DRIVE_CLIENT_ID']; ?>";
        const api_redirect_uri = "<?php echo $_ENV['REDIRECT_URI']; ?>";
    </script>

</head>

<body>


    <div id="chat">
        <header>
            <div id="header" class="header-text">
            <div class="header-left">
            <img src="https://hungaryvfr.hu/images/header-logo.png" alt="HungaryVFR thumbnail">
            <b>HungaryVFR CoPilot</b>
            
            <!-- <span class="maininfo-icon" onclick="toggleHelp('mainHelp')">ℹ️</span>  -->
            <span class="maininfo-icon" onclick="toggleHelp('mainHelp')"><b>i</b></span> 
            <span class="tour-icon" onclick="startTour()"><b>?</b></span>            
            <div id="mainHelp" class="mainhelp-text">
                                <!-- <b>ℹ️ About HungaryVFR CoPilot:</b> -->
                                <b>ℹ️ About HungaryVFR CoPilot
                                <?php
                                if ($js_build_number != '' || $css_build_number != '') {
                                    echo " (build";
                                    if ($js_build_number != '') echo " JS $js_build_number";
                                    if ($css_build_number != '') echo " | CSS $css_build_number";
                                    echo ")";
                                }
                                ?>:</b>
                                <br><br>The HungaryVFR CoPilot WebUI Chat Application is a web-based chatbot powered by the OpenAI API, enabling users to converse on various topics. It supports custom knowledge bases to enhance AI responses with specialized information and includes examples to help you get started. Additionally, it can utilize Perplexity AI, Bing and Google APIs, and your location to generate up-to-date responses. 
                                <br><br>Flexible and adaptable, this chatbot suits various use cases-from casual conversations to domain-specific assistance. Whether for general inquiries, educational purposes, or integrating your own data, it provides a robust platform for interactive AI experiences. 
                                <br><br>Designed with modularity, the application allows easy integration into existing websites. You can customize and embed the chatbot into your site, tailoring it to specific needs. For example, on a product-focused website, you can configure it with your own AI profile and knowledge base to offer specialized assistance.
                                <br>
                                <br>Client source is available at <a href="https://github.com/darealgege/hungaryvfr-copilot" target="_blank">GitHub</a>.
                                <br>Cookie and GDPR policy is available at <a href="https://www.hungaryvfr.hu/cookie_policy.php" target="_blank">HungaryVFR website</a>.
                                <br><br>
                                <b>ℹ️ How to use the Client:</b><br>
                                <br>📖 Select Knowledge Base - Choose a predefined knowledge base to tailor the AI's expertise, e.g., <b>💽 hvfr.dat</b> for HungaryVFR content, <b>💽 empty.dat</b> for an empty knowledge base.
                                <br>🤖 Select AI Profile - Choose a predefined profile to set the AI's behavior and responses.
                                <br>👥 Custom Initial Prompt - Enter a custom prompt to override the selected AI model with personalized instructions.
                                <br>🔊 Select AI Voice - Choose from available speech engines to customize the AI's voice. This option appears only if TTS voices are available.
                                <br>
                                <br>📕 Session Management:
                                <br>▶️ New - Start a new chat session with your selected configurations.
                                <br>🔄 Update - Modify an active chat session's settings, like changing the AI profile or knowledge base.
                                <br>📂 button - Load a saved chat session.
                                <br>💾 button - Save a chat session.
                                <br>
                                <br>⭐ Enable Additional Features:
                                <br>🌍 Location - Share your location with the AI to receive localized info, like the current weather.
                                <br>🔎 Perplexity - Enable Perplexity AI queries for generating replies based on its responses.
                                <br>🔎 Bing - Enable Bing Search integration to include search results in responses.
                                <br>🔎 Google - Enable Google Search integration to include search results in responses.
                                <br>
                                <br>📚 Tab Management:
                                <br>Click the ➕ button to open a new tab.
                                <br>Click the ❌ button to close the current tab.
                                <br>↔️ Drag and drop tabs to reorder them as needed.
                                <br>🔒 Lock / 🔓 Unlock, ✍️ Rename Tab: Long press or right-click a tab to rename or lock/unlock it (to prevent closure).
                                <br>
                                <br>📎 Attachments handling:
                                <br>➕ button - Attach files (pdf, epub, docx, xlsx, pptx, odt, ods, odp, etc) for the AI to read and incorporate into the chat.
                                <br>➖ button - Remove all attached files from the current chat session.
                                <br>📷 button - Attach image files or take a photo to share with the AI.
                                <br>
                                <br>🗣️ Speech Interaction (only supported in Chromium-based browsers):
                                <br>🎤 button - Hold down the 🎤 button to speak to the AI using speech recognition. The AI will automatically read out its responses when using speech input.
                                <br>
                                <br>💬 Manage AI Responses:
                                <br>📋 button - Click the 📋 button in AI responses to copy the message to your clipboard.
                                <br>🔊 button - Click the 🔊 button to have the AI read its response aloud.
                                <br>
                                <br>By following these instructions, you can easily navigate and use all features of the HungaryVFR CoPilot AI Client, improving your experience and productivity.
                            </div>  
        </div>
        </h2>

        </header>
        <main>
            <div id="aiConfig">
                <fieldset>
                    <div>
                    <center>
                    <legend onclick="toggleAIConfig()">🔽 AI Configuration 🔽</legend>
                    </center>
                    <div id="aiConfigContent" style="margin-top: 10px; display: none;">
                        <div id="aiSettings">
                        <label for="knowledgeBase">📖 Select Knowledge Base</label>
                        <span class="info-icon" onclick="toggleHelp('knowledgeBaseHelp')"><b>i</b></span>
                        <div id="knowledgeBaseHelp" class="help-text">
                            ℹ️ About knowledge bases:<br>
                            <br>
                            A custom knowledge base lets the AI use specific data to generate tailored, context-aware responses.<br>
                            You can select the knowledge base that the AI will use to provide responses.<br>
                            <!-- The AI client uses the HungaryVFR knowledge base by default (<b>💽 hvfr.dat</b>).<br> -->
                            Select <b>💽 empty.dat</b> if you would like to use an empty knowledge base.<br>
                            <br>
                            If you are unfamiliar with a knowledge base, just ask the AI about the topics in the knowledge base.
                            <br><br><!-- <em>e.g.:</em> -->💬 Click to ask the AI:<br><br>                            
                            <b><em><a href="#" onclick="setInputValue('What is the main topic of the knowledge base?')">What is the main topic of the knowledge base?</a></em></b>
                            <br>
                            <b><em><a href="#" onclick="setInputValue('What topics are included in the knowledge base?')">What topics are included in the knowledge base?</a></b></em>
                            <br>
                            <b><em><a href="#" onclick="setInputValue('What is the purpose of each topic in the knowledge base?')">What is the purpose of each topic in the knowledge base?</a></b></em>                            
                            <br>
                        </div>
                        <select id="knowledgeBase"></select>


                        <label for="initialPrompt">🤖 Select AI Profile</label>
                        <span class="info-icon" onclick="toggleHelp('aiProfileHelp')"><b>i</b></span>
                        <div id="aiProfileHelp" class="help-text">
                                ℹ️ About AI Profiles:<br>
                                <br>
                                An AI profile defines the AI's behavior, personality, and response style, shaping how it interacts with users in specific scenarios.<br>
                                Select an AI profile or enter a custom initial prompt to set the AI's behavior.<br>                                
                                <!-- <b>🤖 HungaryVFR CoPilot</b> is loaded by default. -->
                                <!-- <br> -->
                                If you're not sure about the role of an AI Profile, simply ask it what it can do to help. 
                                <br><br><!-- <em>e.g.:</em> -->💬 Click to ask the AI:<br><br>                              
                                <b><em><a href="#" onclick="setInputValue('Who are you and what can you do to help?')">Who are you and what can you do to help?</a></b></em>                                                                
                            </div> 
                        <select id="initialPrompt"></select>
                        <input type="text" id="customInitialPrompt"
                            placeholder="👥 Custom initial prompt (will override selected AI profile)">
                        </div>   

                            <div id="voiceSelector" style="display: none;">
                                <label for="aiVoice">🔊 Select AI Voice</label>
                                <select id="aiVoice"></select>
                            </div>

                        <div id="buttonContainerSmall">
                            <div class="buttonGroupLeft">
                                <button id="setAndClearBtn" title="New chat session" aria-label="New chat session">▶️ New</button>
                                <button id="setSessionBtn" disabled title="Update current session" aria-label="Update current session">🔄 Update</button>
                            </div>

                            <div class="buttonGroupRight">

                                <button id="loadChatBtn" title="Load a chat log from a file" aria-label="Load a chat log from a file">📂</button>
                                <button id="saveChatBtn" disabled title="Save the current chat log" aria-label="Save the current chat log">💾</button>
                                <!-- <button id="cloudSyncBtn" title="Synchronize chat with Google Drive" aria-label="Synchronize chat with Google Drive">☁️</button> -->
                            </div>
                        </div>

                        <div id="locationToggleContainer">

                            <label for="locationToggle" class="switch-label">
                                <span>🌍 Location</span>
                                <input type="checkbox" id="locationToggle" class="switch">
                                <span class="slider round" title="Enable / Disable location sharing"></span>
                            </label>

                            <label for="perplexityToggle" class="switch-label">
                                <span>🔎 Perplexity</span>
                                <input type="checkbox" id="perplexityToggle" class="switch">
                                <span class="slider round" title="Use Perplexity Search"></span>
                            </label>                            

                            <label for="bingToggle" class="switch-label">
                                <span>🔎 Bing</span>
                                <input type="checkbox" id="bingToggle" class="switch">
                                <span class="slider round" title="Use Bing Search"></span>
                            </label>

                            <label for="googleToggle" class="switch-label">
                                <span>🔎 Google</span>
                                <input type="checkbox" id="googleToggle" class="switch">
                                <span class="slider round" title="Use Google Search"></span>
                            </label>

                        </div>
                        </div>
                    </div>
                </fieldset>
            </div>

            <div id="tabs">
                <ul id="tabList" role="tablist">
                    <li class="active" role="presentation">
                        <a href="#" data-tab="tab-1" role="tab" aria-selected="true" tabindex="0">Tab 1</a>
                        <span class="close-tab" data-tab="tab-1" role="button" aria-label="Close Tab">❌</span>
                    </li>
                </ul>
                <ul id="contextMenu"
                    style="display: none; position: absolute; z-index: 1000; list-style: none; padding: 5px; background-color: white; border: 1px solid #ccc; border-radius: 5px; box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px;">
                    <li id="renameTab">✍️ Rename Tab</li>
                    <li id="lockTab">🔒 Lock Tab</li>
                    <li id="closeTab">❌ Close Tab</li>
                </ul>
                <button id="addTabBtn" title="Open a new tab" aria-label="Open a new tab">➕</button>
            </div>

            <div id="messages" aria-live="polite" aria-atomic="true"></div>

            <!-- <input type="text" id="userInput" placeholder="Type your message"> -->
            <!-- <textarea id="userInput" placeholder="Type your message" rows="1" style="overflow-y: hidden; resize: auto;"></textarea> -->
            <!-- <textarea id="userInput" placeholder="Type your message" rows="1"></textarea> -->

            <div id="chatContainer">
                <!-- Tabok, üzenetek és egyéb tartalom -->
                <textarea id="userInput" placeholder="Type your message" rows="1" style="overflow-y: auto; resize: vertical; padding: 8px; transition: max-height 0.2s ease; margin: 0 0; font-size: 14px; max-height: 200px; min-height: 35px; width: 100%;"></textarea>                
            </div>

            <div id="buttonContainer">
                <div id="buttonGroupSmall">
                    <button id="loadTextFilesBtn" title="Attach files" aria-label="Attach files">➕</button>
                    <button id="removeFilesBtn" title="Remove files" aria-label="Remove files">➖</button>
                    <button id="captureImageBtn" title="Load image files" aria-label="Load image files">📷</button>
                </div>

                <div id="sendBtnContainer">
                    <button id="microphoneBtn" style="cursor: pointer;" title="Talk to AI" aria-label="Talk to AI">🎤</button>
                    <!-- Mikrofon gomb -->
                    <button id="sendBtn" class="enabled" title="Send your message" aria-label="Send your message">💬Send</button>
                </div>
            </div>

        </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.3.4/purify.min.js"></script>
    <script src="https://unpkg.com/heic2any"></script>    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js"></script>
    <script src="https://unpkg.com/epubjs/dist/epub.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
            
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cookieconsent2/3.1.1/cookieconsent.min.css" />
<script src="https://cdn.jsdelivr.net/npm/cookieconsent@3.1.1/build/cookieconsent.min.js"></script>

<!-- <script src="ui_245.js"></script>   -->
<script src="<?php echo htmlspecialchars($js_filename); ?>"></script>

<script>
    const toggleAIConfig = () => {
        const configContent = document.getElementById("aiConfigContent");
        const legend = document.querySelector("#aiConfig legend");
        const messages = document.getElementById("messages");

        if (configContent.style.display === "none" || configContent.style.display === "") {
            configContent.style.display = "block";
            legend.innerHTML = "🔼 AI Configuration 🔼";
            messages.style.height = "calc(100vh - 510px)";
        } else {
            configContent.style.display = "none";
            legend.innerHTML = "🔽 AI Configuration 🔽";
            messages.style.height = "calc(100vh - 280px)";
        }
    };
</script>    

<script>
    function toggleHelp(helpId) {
        var helpText = document.getElementById(helpId);
        if (helpText.style.display === "none" || helpText.style.display === "") {
            helpText.style.display = "block";
        } else {
            helpText.style.display = "none";
        }
    }
    </script>

<script>
    function getLocale() {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        return locale || navigator.language;
    }

    function ttsCheck() {
        const voices = window.speechSynthesis.getVoices();
        const locale = getLocale(); // Böngésző nyelv lekérdezése

        if (voices.length > 0) {
            displayVoiceOptions(voices, locale);
        } else {
            // Ha a hangok még nem állnak rendelkezésre, várunk és újraellenőrizzük
            setTimeout(() => {
                const updatedVoices = window.speechSynthesis.getVoices();
                if (updatedVoices.length > 0) {
                    displayVoiceOptions(updatedVoices, locale);
                } else {
                    document.getElementById('voiceSelector').style.display = 'none'; // Elrejtjük, ha nincsenek hangok
                }
            }, 500); // 500 ms várakozás
        }
    }

    function displayVoiceOptions(voices, locale) {
        const voiceSelect = document.getElementById('aiVoice');
        voiceSelect.innerHTML = ''; // Ürítjük a korábbi opciókat
        let defaultVoiceFound = false;

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;

            // Pontos egyezés a teljes nyelvi régióval (pl. hu-HU)
            if (voice.lang === locale && !defaultVoiceFound) {
                option.selected = true;
                defaultVoiceFound = true;
            }

            // Ha nincs pontos egyezés, de az általános nyelv megegyezik (pl. hu)
            if (voice.lang.startsWith(locale.split('-')[0]) && !defaultVoiceFound) {
                option.selected = true;
                defaultVoiceFound = true;
            }

            voiceSelect.appendChild(option);
        });

        // Ha nincs egyező nyelvű hang, akkor az első elérhető hangot választjuk ki
        if (!defaultVoiceFound && voices.length > 0) {
            voiceSelect.selectedIndex = 0;
        }

        document.getElementById('voiceSelector').style.display = 'block'; // Megjelenítjük a TTS elemeket
    }

    // A hangok betöltésekor futtatjuk a ttsCheck-et
    window.speechSynthesis.onvoiceschanged = ttsCheck;

    // Biztosítjuk, hogy a ttsCheck az oldal betöltése után is fusson, ha már betöltődtek a hangok
    if (window.speechSynthesis.getVoices().length > 0) {
        ttsCheck();
    } else {
        window.speechSynthesis.onvoiceschanged = ttsCheck; // Várunk a hangok betöltésére
    }
</script>

<script>
    function setInputValue(text) {
        document.getElementById("userInput").value = text;
                const userInput = document.getElementById("userInput");
                const sendBtn = document.getElementById("sendBtn");

                const toggleSendButton = () => {
                    if (userInput.value.trim() === "") {
                        sendBtn.disabled = true;
                        sendBtn.classList.remove("enabled");
                    } else {
                        sendBtn.disabled = false;
                        sendBtn.classList.add("enabled");
                    }
                };

                toggleSendButton();
    }
</script>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize the driver without steps
    const driver = new Driver({
      showProgress: true, // Optional: shows progress bar      
      zIndex: 10000,
      showButtons: ['next', 'previous'], // Gombok kisbetűkkel
      popover: {
      showCloseButton: false, // Eltávolítja a bezárás gombot az összes lépésnél
      },
      // Egyéb opciók...
    });

    // Define the steps using defineSteps()
    const steps = [
      {
        element: 'header',
        popover: {
          title: 'Welcome to HungaryVFR CoPilot',
          description: 'This tour will guide you through the features and functionalities of the AI client.',
          position: 'bottom',
          showCloseButton: false,
        },
      },

      {
        element: '#aiSettings',
        popover: {
          title: 'AI Configuration',
          description: `📖 Select Knowledge Base - Choose a predefined knowledge base to tailor the AI's expertise, e.g., <b>💽 hvfr.dat</b> for HungaryVFR content, <b>💽 empty.dat</b> for an empty knowledge base.<br><br>🤖 Select AI Profile - Choose a predefined profile to set the AI's behavior and responses.<br><br>👥 Custom Initial Prompt - Enter a custom prompt to override the selected AI model with personalized instructions.`,
          position: 'bottom',
        },
      },

      {
        element: '#buttonContainerSmall',
        popover: {
          title: 'Session Management',
          description: `▶️ New - Start a new chat session with your selected configurations.<br>🔄 Update - Modify an active chat session's settings, like changing the AI profile or knowledge base.<br>📂 button - Load a saved chat session.<br>💾 button - Save a chat session.`,
          position: 'bottom',
        },
      },
      {
        element: '#locationToggleContainer',
        popover: {
          title: 'Additional Features',
          description: `🌍 Location - Share your location with the AI to receive localized info, like the current weather.<br>🔎 Perplexity - Enable Perplexity AI queries for generating replies based on its responses.<br>🔎 Bing - Enable Bing Search integration to include search results in responses.<br>🔎 Google - Enable Google Search integration to include search results in responses.`,
          position: 'bottom',
        },
      },      
      {
        element: '#tabs',
        popover: {
          title: 'Tab Management',
          description: `Manage your chat sessions using tabs.<br>Click the ➕ button to open a new tab.<br>Click the ❌ button to close the current tab.<br>↔️ Drag and drop tabs to reorder them as needed.<br>🔒 Lock / 🔓 Unlock, ✍️ Rename Tab: Long press or right-click a tab to rename or lock/unlock it (to prevent closure).`,
          position: 'bottom',
        },
      },
      {
        element: '#messages',
        popover: {
          title: 'Chat Messages',
          description: `This area displays system messages and your conversation with the AI. You can copy messages and use TTS to have responses read aloud.<br><br>Click the 📋 button at the bottom of a message bubble to copy it to your clipboard.<br>Click the 🔊 button to have the AI read its response aloud, it will automatically read out its responses when using speech input.`,
          position: 'top',
        },
      },
      {
        element: '#buttonContainer',
        popover: {
          title: 'Attachments and Input Controls',
          description: `➕ button - Attach files (pdf, epub, docx, xlsx, pptx, odt, ods, odp, rtf, xml, json, source files, plain text, etc.) for the AI to read and incorporate into the chat.<br>➖ button - Remove all attached files from the current chat session.<br>📷 button - Attach image files or take a photo to share with the AI.<br><br>🎤 button - Hold down the 🎤 button to speak to the AI using speech recognition. The AI will automatically read out its responses when using speech input.<br>💬 Send - Send your message.`,
          position: 'top',
        },
      },     
      // Add the rest of your steps here, ensuring selectors are correct
    ];

    const voiceSelector = document.getElementById('voiceSelector');
    const isVoiceSelectorVisible =
        voiceSelector && voiceSelector.style.display !== 'none';

    if (isVoiceSelectorVisible) {
        // Insert the #voiceSelector step into the steps array at the desired position
        steps.splice(2, 0, {
        element: '#voiceSelector',
        popover: {
            title: 'Voice Configuration',
            description: `🔊 Select AI Voice - Choose from available speech engines to customize the AI's voice. This option appears only if TTS voices are available.`,
            position: 'bottom',
        },
        });
    }

    // Define the steps
    driver.defineSteps(steps);

    // Function to start the tour
    function startTour() {
      // Ensure AI Configuration is visible
      const configContent = document.getElementById("aiConfigContent");
      if (configContent.style.display === "none" || configContent.style.display === "") {
        toggleAIConfig(); // Function to toggle visibility
      }

      driver.start();
    }

    // Expose startTour to global scope
    window.startTour = startTour;
  });

  
</script>



</body>

</html>