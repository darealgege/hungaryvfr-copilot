(function () {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    const getDayName = (date) => {
        const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        return daysOfWeek[date.getDay()];
    };

    const ENDPOINT_URL = "chat.php";
    const LOG_ENDPOINT_URL = "log.php";
    const MAX_TOKENS = 8192;
    const TEMPERATURE = 0.7;
    const aiName = "HungaryVFR CoPilot";
    const TOKEN_LIMIT = 127900;
    let knowledgeBaseOnLoad = "hvfr.dat";
    let initialPromptOnLoad = "initial_prompt.ini";
    let metarDataRaw = "Location sharing disabled - Location based weather data is notavailable";
    let initialPromptContent = '';
    let conversationHistory = [];
    let additionalFile = [];
    let validFile = null;
    let fileContents = '';
    let combinedResponses = 'No files attached';
    let formattedLoadedFiles = "";
    let loadedFiles = [];
    let aiProfileName = "HungaryVFR CoPilot";
    let knowledgeBaseContent = '';
    let logId = '';
    let systemMessage;
    let previousKnowledgeBase;
    let previousAiProfileName;
    let previousCustomPrompt;
    let usedKnowledgeBase = '';
    let currentDateTime;
    let now;
    let userTimezone;
    let options;
    let knowledgeBase;
    let selectedInitialPrompt;
    let locationEnabled = false;
    let bingSearchEnabled = false;
    let googleSearchEnabled = false;
    let perplexitySearchEnabled = false;
    const initialTabId = `tab-${Date.now()}`;
    let sessions = {
        [initialTabId]: {
            tabName: "Tab 1",
            conversationHistory: [],
            initialPromptContent: '',
            additionalFile: '',
            knowledgeBaseContent: '',
            chatLog: '',
            aiProfileName: '',
            knowledgeBase: knowledgeBaseOnLoad,
            selectedInitialPrompt: initialPromptOnLoad
        }
    };
    let currentTabId = initialTabId;
    let fileCharacterChunk = 200000;
    let latitude = "";
    let longitude = "";
    let userLocation = "Location sharing disabled - User coordinates are not available";
    let bingSearchResults = "";
    let googleSearchResults = "";
    let perplexitySearchResults = "";
    let loadingBingMessageId;
    let loadingGoogleMessageId;
    let loadingBingKeywordId;
    let loadingVision;
    const locationToggle = document.getElementById('locationToggle');
    const savedLocationEnabled = localStorage.getItem('locationEnabled');
    const locationStatus = savedLocationEnabled ? JSON.parse(savedLocationEnabled) : false;    
    let userLocationTextMsg = "Location sharing disabled";
    let userLocationText = "Location sharing disabled - Location based address is not available";
    let locationRefreshInterval;
    let locationCache = {
        timestamp: null,
        latitude: null,
        longitude: null,
        userLocationText: null,
        weatherData: null
    };
    let locationData;
    let userLocationCountry;
    let userLocationCity;
    let locationNews = "\nNo local news found";
    let formattedNewsResults;
    let userLocationPostcode;
    let userLocationRegion;
    let userLocationCountryCode;
    let userLocationRoad;
    let userLocationHouseNumber;
    let userLocationCityDistrict;
    let userLocationSuburb;
    let userLocationBorough;
    let userLocationNeighbourhood;
    let userLocationCounty;
    let userLocationMunicipality;
    let locationDisplay;
    let locationLatLon;
    let previousLocationLatLon = "";
    let previousWeatherData = "";
    let previousWeatherDataString = "";
    let refreshIntervalMinutes = 1;
    const closedTabsCooldown = new Set();
    let positionThreshold = 0.001;
    let lockedTabs = JSON.parse(localStorage.getItem("lockedTabs")) || {};
    let perplexityText = "Perplexity Search result: "

    const getTokenCount = (messages) => messages.reduce((acc, message) => acc + message.content.split(' ').length, 0);
    const sanitizeInput = (input) => {
        return DOMPurify.sanitize(input);
    };

    const setSession = async () => {
        previousAiProfileName = aiProfileName;
        previousKnowledgeBase = usedKnowledgeBase;
        previousCustomPrompt = initialPromptContent;

        initialPromptContent = "";

        const customPrompt = sanitizeInput(document.getElementById('customInitialPrompt').value.trim());
        selectedInitialPrompt = document.getElementById('initialPrompt').value;

        if (customPrompt) {
            initialPromptContent = customPrompt;
            aiProfileName = "🤖 Custom Profile";
        } else if (selectedInitialPrompt) {
            aiProfileName = await loadInitialPromptContent(selectedInitialPrompt);
            initialPromptContent = session.initialPromptContent;
        } else {
            aiProfileName = await loadConfig();
            initialPromptContent = "";
        }

        const knowledgeBase = document.getElementById('knowledgeBase').value;
        if (knowledgeBase) {
            await loadKnowledgeBaseContent(knowledgeBase);
        }

        usedKnowledgeBase = knowledgeBase;
        systemMessage = `${initialPromptContent}`;
        conversationHistory.push({ role: "system", content: systemMessage });

        sessions[currentTabId].knowledgeBase = knowledgeBase;
        let changesMade = false;

        if (usedKnowledgeBase !== previousKnowledgeBase) {
            displayMessage(`📖 Knowledge Base loaded: 💽 ${knowledgeBase}`, "system");
            await logToFile(`📖 Knowledge Base loaded: 💽 ${knowledgeBase}`);
            changesMade = true;
        }

        if (customPrompt && customPrompt !== previousCustomPrompt) {
            displayMessage(`📝 Custom Initial Prompt: ${customPrompt}`, "system");
            await logToFile(`📝 Session updated with custom initial prompt: ${customPrompt}`);
            changesMade = true;
        } else if (!customPrompt && aiProfileName !== previousAiProfileName) {
            displayMessage(`🤖 AI Profile loaded: ${aiProfileName}`, "system");
            await logToFile(`🤖 AI Profile loaded: ${aiProfileName}`);
            changesMade = true;
        }

        if (!changesMade) {
            displayMessage(`✳️ No changes were made`, "system");
        }

        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
    };

    const toggleSaveButton = () => {
        const messages = document.getElementById("messages");
        const saveChatBtn = document.getElementById("saveChatBtn");

        if (messages.innerHTML.includes('<div class="avatar">🧑 You')) {
            saveChatBtn.disabled = false;
            saveChatBtn.classList.add("enabled");
            saveChatBtn.classList.remove("disabled-cursor");
        } else {
            saveChatBtn.disabled = true;
            saveChatBtn.classList.remove("enabled");
            saveChatBtn.classList.add("disabled-cursor");
        }
    };

    const toggleUpdateButton = () => {
        const messages = document.getElementById("messages");
        const setSessionBtn = document.getElementById("setSessionBtn");

        if (messages.innerHTML.includes('<div class="avatar">🧑 You')) {
            setSessionBtn.disabled = false;
            setSessionBtn.classList.add("enabled");
            setSessionBtn.classList.remove("disabled-cursor");
        } else {
            setSessionBtn.disabled = true;
            setSessionBtn.classList.remove("enabled");
            setSessionBtn.classList.add("disabled-cursor");
        }
    };

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

    function togglePerplexityAnswer(perplexityId) {
        const contentDiv = document.getElementById(`${perplexityId}-content`);
        const legendSpan = document.getElementById(`${perplexityId}-legend`);
        if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
            contentDiv.style.display = 'block';
            legendSpan.innerHTML = '🔼 Perplexity AI Response 🔼';
        } else {
            contentDiv.style.display = 'none';
            legendSpan.innerHTML = '🔽 Perplexity AI Response 🔽';
        }
    }


    const loadConfig = async () => {
        const response = await fetch('get_config.php');
        const configText = await response.text();
        return configText;
    };

    const loadInitialPromptContent = async (file) => {
        try {
            const response = await fetch(`get_initial_prompt.php?file=${encodeURIComponent(file)}`);
            const text = await response.text();
            const lines = text.split('\n');
            const aiProfileName = lines.shift().trim();
            initialPromptContent = lines.join('\n');

            if (sessions[currentTabId]) {
                sessions[currentTabId].initialPromptContent = initialPromptContent;
                sessions[currentTabId].aiProfileName = aiProfileName;
            }

            return aiProfileName;
        } catch (error) {
            console.error('Error loading initial prompt file:', error);
            return null;
        }
    };

    const loadInitialPromptFiles = async () => {
        try {
            const response = await fetch('get_initial_prompt.php');
            const text = await response.text();
            const files = text.split('\n').filter(file => file.trim() !== '');
            const select = document.getElementById('initialPrompt');

            for (const file of files) {
                const aiProfileName = await loadInitialPromptContent(file);
                const option = document.createElement('option');
                option.value = file;
                option.textContent = aiProfileName || file;
                select.appendChild(option);
            }
        } catch (error) {
            console.error('Error loading initial prompt files:', error);
        }
    };

    async function loadPdfFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let pdfText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                pdfText += `\nPage ${i}:\n${pageText}`;
            }
            return pdfText;
        } catch (error) {
            console.error("Error reading PDF file:", error);
            displayMessage("❌ Error loading PDF file.", "system");
            return '';
        }
    }

    const loadTextFiles = async () => {
        const allowedExtensions = [
            'txt', 'pdf', 'epub', 'docx', 'ini', 'json', 'csv', 'js', 'html', 'htm', 'css', 'md', 'xml',
            'yaml', 'yml', 'log', 'config', 'cfg', 'properties', 'sql', 'sh',
            'bat', 'cmd', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'r',
            'php', 'pl', 'rb', 'ts', 'tsx', 'jsx', 'go', 'rs', 'swift', 'kt',
            'dart', 'scala', 'vb', 'vbs', 'bas', 'cls', 'frm', 'lua', 'scss',
            'sass', 'less', 'tex', 'asm', 'pas', 'ml', 'mli', 'clj', 'cljs',
            'cljc', 'edn', 'rkt', 'lisp', 'el', 'erl', 'hrl', 'ex', 'exs',
            'hs', 'lhs', 'erl', 'r', 'm', 'ino', 'pde', 'groovy', 'v', 'vh',
            'sv', 'svh', 's', 'rc', 'resx', 'xaml', 'y', 'yy', 'lex', 'l',
            'scm', 'scheme', 'ps1', 'psm1', 'psd1', 'pl', 'pm', 't', 'nasm',
            'asmx', 'ahk', 'awk', 'tcl', 'vhdl', 'vhd', 'm', 'mm', 'mak',
            'am', 'in', 'ac', 'm4', 'g', 'gd', 'nim', 'cr', 'rpy', 'd',
            'ada', 'adb', 'ads', 'pro', 'gpr', 'kts', 'build', 'gradle', 'docx', 'rtf'
        ];


        const acceptedFileTypes = allowedExtensions.map(ext => `.${ext}`).join(',');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = acceptedFileTypes;
        input.multiple = true;
      
        input.onchange = async (event) => {
          const files = Array.from(event.target.files);
          let validFiles = [];
          let invalidFiles = [];
      
          let session = sessions[currentTabId];
          session.fileContents = session.fileContents || {}; // Initialize as an object
          session.loadedFiles = session.loadedFiles || [];
      
          for (const file of files) {
            const extension = file.name.split('.').pop().toLowerCase();
      
            if (allowedExtensions.includes(extension)) {
              let content = '';
              if (extension === 'pdf') {
                content = await extractTextFromPdf(file);
              } else if (extension === 'doc' || extension === 'docx') {
                content = await extractTextFromDoc(file);
              } else if (extension === 'epub') {
                content = await extractTextFromEpub(file);
              } else {
                content = await file.text();
              }
      
              session.fileContents[file.name] = content; // Store content in the object
              validFiles.push(file.name);
              session.loadedFiles.push(file.name);
            } else {
              invalidFiles.push(file.name);
            }
          }
      
          if (Object.keys(session.fileContents).length > 0) {
            const filesWithEmoji = validFiles.map(file => `<div class="content" style="margin-bottom:5px">📄 ${file}</div>`).join('');
            const fileCount = validFiles.length;
            const fileWord = fileCount === 1 ? 'Text file' : 'Text files';
            displayMessage(`<div class="content" style="margin-bottom:5px">📄 ${fileWord} loaded successfully:</div><div class="content" style="margin-bottom:5px">${filesWithEmoji}</div>`, 'system');
            await logToFile(`📄 ${fileWord} loaded: ${validFiles.join(', ')}`);
            document.getElementById("removeFilesBtn").disabled = false;
          } else {
            displayMessage('⛔ No valid text files were loaded.', 'system');
          }
      
          if (invalidFiles.length > 0) {
            const formattedInvalidFiles = invalidFiles.map(file => `⛔ ${file}`).join('<br>');
            displayMessage(`⛔ Invalid file types:<br>${formattedInvalidFiles}`, 'system');
          }
      
          saveChatToLocalStorage();
        };
      
        input.click();
      };

    const extractTextFromEpub = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            let epubText = '';

            // Iterate over each file in the zip
            for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                // Check if the file is an XHTML or HTML file
                if (relativePath.endsWith('.xhtml') || relativePath.endsWith('.html')) {
                    const content = await zipEntry.async('string');

                    // Parse the HTML content to extract text
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(content, 'application/xhtml+xml');
                    const textContent = doc.body ? doc.body.textContent : '';
                    epubText += `\n${textContent}`;
                }
            }
            return epubText;
        } catch (error) {
            console.error("Error reading EPUB file with JSZip:", error);
            displayMessage("❌ Error loading EPUB file.", "system");
            return '';
        }
    };

    const extractTextFromPdf = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';

        for (let i = 0; i < pdf.numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            text += strings.join(' ') + '\n';
        }
        return text;
    };

    const extractTextFromDoc = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return doc.value;
    };

    const removeFiles = async () => {
        let session = sessions[currentTabId];

        if (session.loadedFiles && session.loadedFiles.length > 0) {
            //const removedFilesMessage = `🗑️ Removed files:<br>${session.loadedFiles.map(file => `🗑️ ${file}`).join('<br>')}`;
            const removedFilesMessage = `<div class="content" style="margin-bottom:5px">🗑️ Removed files:</div>${session.loadedFiles.map(file => `<div class="content" style="margin-bottom:5px">🗑️ ${file}</div>`).join('')}`;
            displayMessage(removedFilesMessage, 'system');
            await logToFile(`🗑️ Files removed: ${session.loadedFiles.join(', ')}`);

            session.fileContents = '';
            session.loadedFiles = [];

            toggleRemoveFilesButton();
        } else {
            displayMessage('⛔ Attached files list is empty.', 'system');
        }

        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
    };

    const toggleRemoveFilesButton = () => {
        let session = sessions[currentTabId];
        const removeFilesBtn = document.getElementById("removeFilesBtn");

        if (session.loadedFiles && session.loadedFiles.length > 0) {
            removeFilesBtn.disabled = false;
        } else {
            removeFilesBtn.disabled = true;
        }
    };

    const loadKnowledgeBaseFiles = async () => {
        try {
            const response = await fetch('get_knowledgebase_files.php');
            const text = await response.text();
            const files = text.split('\n').filter(file => file.trim() !== '');
            const select = document.getElementById('knowledgeBase');
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = "💽 " + file;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading knowledge base files:', error);
        }
    };

    const loadKnowledgeBaseContent = async (file) => {
        try {
            const response = await fetch(`get_knowledgebase_files.php?file=${encodeURIComponent(file)}`);
            const content = await response.text();
            knowledgeBaseContent = content;

            if (sessions[currentTabId]) {
                sessions[currentTabId].knowledgeBaseContent = content;
            }

            await logToFile(`📖 Knowledge base loaded: ${file}`);
        } catch (error) {
            console.error('Error loading knowledge base file:', error);
        }
    };

    const logToFile = async (message) => {
        try {
            const response = await fetch(LOG_ENDPOINT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });
            const logResponse = await response.json();
            if (logResponse.status === 'success' && !logId) {
                logId = logResponse.log_id;
            } else if (logResponse.status !== 'success') {
                console.error('Error logging to file:', logResponse.message);
            }
        } catch (error) {
            console.error('Error logging to file:', error);
        }
    };

    const setAndClear = async () => {
        if (!sessions[currentTabId]) {
            sessions[currentTabId] = {
                conversationHistory: [],
                initialPromptContent: '',
                customInitialPrompt: '',
                additionalFile: '',
                knowledgeBaseContent: '',
                chatLog: '',
                aiProfileName: '',
                knowledgeBase: knowledgeBaseOnLoad,
                initialPrompt: initialPromptOnLoad
            };
        }

        session = sessions[currentTabId];

        sessions[currentTabId].conversationHistory = [];
        sessions[currentTabId].initialPromptContent = '';
        sessions[currentTabId].initialPrompt = '';
        sessions[currentTabId].additionalFile = '';
        sessions[currentTabId].knowledgeBaseContent = '';
        sessions[currentTabId].chatLog = '';

        document.getElementById("messages").innerHTML = '';
        document.getElementById("removeFilesBtn").disabled = true;
        document.getElementById("saveChatBtn").disabled = true;
        document.getElementById("setSessionBtn").disabled = true;

        const customPrompt = sanitizeInput(document.getElementById('customInitialPrompt').value.trim());
        const selectedInitialPrompt = document.getElementById('initialPrompt').value;

        let initialPromptContent = '';
        let aiProfileName = '';

        if (customPrompt) {
            initialPromptContent = customPrompt;
            aiProfileName = "Custom Profile";
        } else if (selectedInitialPrompt) {
            aiProfileName = await loadInitialPromptContent(selectedInitialPrompt);
        } else {
            aiProfileName = await loadConfig();
        }

        let knowledgeBase = document.getElementById('knowledgeBase').value;
        if (knowledgeBase) {
            await loadKnowledgeBaseContent(knowledgeBase);
            usedKnowledgeBase = knowledgeBase;
            sessions[currentTabId].knowledgeBase = usedKnowledgeBase;
        } else {
            sessions[currentTabId].knowledgeBase = knowledgeBaseOnLoad;
        }

        const systemMessage = `${session.initialPromptContent}`;
        conversationHistory = [{ role: "system", content: systemMessage }];
        sessions[currentTabId].conversationHistory = conversationHistory;
        sessions[currentTabId].initialPromptContent = initialPromptContent;

        displayMessage(`▶️ Session started with ${aiName}`, "system");
        removeFiles();
        displayMessage(`📖 Knowledge Base loaded: 💽 ${usedKnowledgeBase || 'None'}`, "system");

        if (customPrompt) {
            displayMessage(`📝 Custom Initial Prompt: ${customPrompt}`, "system");
            await logToFile(`📝 Session started with custom initial prompt: ${customPrompt}`);
        } else {
            displayMessage(`🤖 AI Profile loaded: ${aiProfileName}`, "system");
            await logToFile(`🤖 AI Profile loaded: ${aiProfileName}`);
        }

        await logToFile(`📖 Knowledge Base loaded: 💽 ${usedKnowledgeBase || 'None'}`);
        
        const savedBingSearchEnabled = localStorage.getItem('bingSearchEnabled');
        const savedGoogleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        const savedLocationEnabled = localStorage.getItem('locationEnabled');
        const savedPerplexitySearchEnabled = localStorage.getItem('perplexitySearchEnabled');

        if (savedLocationEnabled !== null) {
            const locationEnabled = JSON.parse(savedLocationEnabled);
            document.getElementById('locationToggle').checked = locationEnabled;
            if (locationEnabled) {
                displayMessage("🌍 Location sharing enabled", "system");
                logToFile(`🌍 Location sharing enabled`);
            }    
        }

        if (savedPerplexitySearchEnabled !== null) {
            perplexitySearchEnabled = JSON.parse(savedPerplexitySearchEnabled);
            document.getElementById('perplexityToggle').checked = perplexitySearchEnabled;
            if (perplexitySearchEnabled) {
                displayMessage("🔎 Perplexity Search enabled", "system");
                logToFile(`🔎 Perplexity Search enabled`);
            }
        }          

        if (savedBingSearchEnabled !== null) {
            bingSearchEnabled = JSON.parse(savedBingSearchEnabled);
            document.getElementById('bingToggle').checked = bingSearchEnabled;
            if (bingSearchEnabled) {
                displayMessage("🔎 Bing Search enabled", "system");
                logToFile(`🔎 Bing Search enabled`);
            }
        }

        if (savedGoogleSearchEnabled !== null) {
            googleSearchEnabled = JSON.parse(savedGoogleSearchEnabled);
            document.getElementById('googleToggle').checked = googleSearchEnabled;
            if (googleSearchEnabled) {
                displayMessage("🔎 Google Search enabled", "system");
                logToFile(`🔎 Google Search enabled`);
            }
        }        
        
        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
    };


    const resetSession = async () => {
        let aiProfile;
        if (initialPromptContent) {
            aiProfile = initialPromptContent;
        } else {
            aiProfile = await loadConfig();
        }

        knowledgeBase = document.getElementById('knowledgeBase').value;
        if (knowledgeBase) {
            await loadKnowledgeBaseContent(knowledgeBase);
            knowledgeBaseContent = knowledgeBase;
        }

        const systemMessage = `${aiProfile}`;
        conversationHistory = [{ role: "system", content: systemMessage }];

        displayMessage(`🔄 Session restarted due to token limit`, "system");
        await logToFile(`🔄 Session restarted due to token limit`);
        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
    };

    const saveChatToLocalStorage = () => {        
        const messagesDiv = document.getElementById("messages");
        const chatContent = messagesDiv.innerHTML;
        if (!sessions[currentTabId]) {
            sessions[currentTabId] = {
                conversationHistory: [],
                initialPromptContent: '',
                additionalFile: '',
                knowledgeBaseContent: '',
                chatLog: ''
            };
        }

        sessions[currentTabId].chatLog = chatContent;
        sessions[currentTabId].conversationHistory = [...conversationHistory];
        sessions[currentTabId].selectedInitialPrompt = selectedInitialPrompt;
        sessions[currentTabId].knowledgeBase = document.getElementById('knowledgeBase').value;
        sessions[currentTabId].userLocation = userLocation || "\nLocation sharing disabled";

        sessions[currentTabId].previousLocationLatLon = session.previousLocationLatLon || "";
        sessions[currentTabId].previousWeatherDataString = session.previousWeatherDataString || "";
        
        localStorage.setItem("chatSessions", JSON.stringify(sessions));
        localStorage.setItem("currentTabId", currentTabId);
        // Elindítjuk a szinkronizációt a felhővel
/*         try {
            synchronizeChats();
        } catch (error) {
            console.error("Error during cloud sync in saveChatToLocalStorage:", error);
            displayMessage("❌ Error during cloud sync while saving.", "system");
        }    */
        //saveChatToGoogleDrive();        
    };

    const saveChatToGoogleDrive = async () => {
        try {
            // Küldjük el a session adatokat a szervernek
            const response = await fetch('cloud_sync.php?action=synchronize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: currentTabId,
                    chat_data: sessions[currentTabId]
                })
            });
    
            const data = await response.json();
            if (data.status === 'success') {
                displayMessage("☁️ Chat mentve a Google Drive-ra.", "system");
            } else {
                displayMessage(`❌ Chat mentése sikertelen: ${data.message}`, "system");
            }
        } catch (error) {
            console.error("Error saving chat to Google Drive:", error);
            displayMessage("❌ Error saving chat to Google Drive.", "system");
        }
    };
    
    
    

    function reattachEventListeners() {
        const messagesDiv = document.getElementById("messages");
        const messageElements = messagesDiv.querySelectorAll(".message");

        messageElements.forEach(messageElement => {
            let role;
            if (messageElement.classList.contains("user")) {
                role = "user";
            } else if (messageElement.classList.contains("assistant")) {
                role = "assistant";
            } else if (messageElement.classList.contains("perplexity")) {
                role = "perplexity";
            } else {
                role = "system";
            }
            const messageContent = messageElement.querySelector('.content').innerText;

            //console.log(`Processing message with role: ${role}`);

            if (role === "assistant") {
                const speakerIcon = messageElement.querySelector('.speaker-icon');
                //console.log('Speaker Icon:', speakerIcon);
                const copyIcon = messageElement.querySelector('.copy-icon');
                const playPauseStopContainer = messageElement.querySelector('.play-pause-stop-container');
                if (playPauseStopContainer) {
                    playPauseStopContainer.remove();
                }

                if (copyIcon) {
                    copyIcon.style.display = 'inline-block';
                }                

                if (speakerIcon) {
                    speakerIcon.style.display = 'inline-block';
                    speakerIcon.addEventListener('click', () => {
                        speakMessage(messageContent, speakerIcon);
                    });
                }
            }            
        });


        // Perplexity Answer eseménykezelők
        // Reattach event listeners for Perplexity Answer legends
        const legendSpans = document.querySelectorAll('span[id^="perplexity-"][id$="-legend"]');

        legendSpans.forEach(legendSpan => {
            const messageElement = legendSpan.closest('.message');
            if (messageElement) {
                // Find the assistant message that follows the legend
                let assistantMessageElement = messageElement.nextElementSibling;
                while (assistantMessageElement && !assistantMessageElement.classList.contains('perplexity')) {
                    assistantMessageElement = assistantMessageElement.nextElementSibling;
                }

                if (assistantMessageElement) {
                    legendSpan.addEventListener('click', () => {
                        if (assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '') {
                            assistantMessageElement.style.display = 'block';
                            legendSpan.innerHTML = '🔼 Perplexity AI Response 🔼';
                        } else {
                            assistantMessageElement.style.display = 'none';
                            legendSpan.innerHTML = '🔽 Perplexity AI Response 🔽';
                        }
                    });
                }
            }
        });

        // Bing Data eseménykezelők
        const bingLegends = document.querySelectorAll('span[id^="bing-"][id$="-legend"]');
        bingLegends.forEach(legendSpan => {
            const bingId = legendSpan.id.replace('-legend', '');
            legendSpan.addEventListener('click', () => {
                const contentDiv = document.getElementById(`${bingId}-content`);
                if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
                    contentDiv.style.display = 'block';
                    legendSpan.innerHTML = '🔼 Bing Results 🔼';
                } else {
                    contentDiv.style.display = 'none';
                    legendSpan.innerHTML = '🔽 Bing Results 🔽';
                }
            });
        });

        // Google Data eseménykezelők
        const googleLegends = document.querySelectorAll('span[id^="google-"][id$="-legend"]');
        googleLegends.forEach(legendSpan => {
            const googleId = legendSpan.id.replace('-legend', '');
            legendSpan.addEventListener('click', () => {
                const contentDiv = document.getElementById(`${googleId}-content`);
                if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
                    contentDiv.style.display = 'block';
                    legendSpan.innerHTML = '🔼 Google Results 🔼';
                } else {
                    contentDiv.style.display = 'none';
                    legendSpan.innerHTML = '🔽 Google Results 🔽';
                }
            });
        });

    }

    const loadChatFromLocalStorage = () => {
        const savedSessions = localStorage.getItem("chatSessions");
        const savedCurrentTabId = localStorage.getItem("currentTabId");
        const savedBingSearchEnabled = localStorage.getItem('bingSearchEnabled');
        const savedGoogleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        const savedLocationEnabled = localStorage.getItem('locationEnabled');
        const savedPerplexitySearchEnabled = localStorage.getItem('perplexitySearchEnabled');

        if (savedSessions) {
            sessions = JSON.parse(savedSessions);
            currentTabId = savedCurrentTabId || Object.keys(sessions)[0];

            Object.keys(sessions).forEach(tabId => {
                if (!sessions[tabId].tabName) {
                    const tabNumber = tabId.split('-')[1] || '1';
                    sessions[tabId].tabName = `Tab ${tabNumber}`;
                }
            });
        } else {
            const initialTabId = `tab-${Date.now()}`;
            sessions = {
                [initialTabId]: {
                    tabName: "Tab 1",
                    conversationHistory: [],
                    initialPromptContent: '',
                    additionalFile: '',
                    knowledgeBaseContent: '',
                    chatLog: '',
                    aiProfileName: '',
                    knowledgeBase: knowledgeBaseOnLoad,
                    selectedInitialPrompt: initialPromptOnLoad
                }
            };
            currentTabId = initialTabId;
        }

        session = sessions[currentTabId];

        if (session) {
            conversationHistory = [...session.conversationHistory];
            document.getElementById("messages").innerHTML = session.chatLog || '';
            document.getElementById('knowledgeBase').value = session.knowledgeBase || knowledgeBaseOnLoad;
            document.getElementById('initialPrompt').value = session.selectedInitialPrompt || initialPromptOnLoad;
            reattachEventListeners();
            session.userLocation = userLocation || "\nLocation sharing disabled";
            session.previousLocationLatLon = session.previousLocationLatLon || "";
            session.previousWeatherDataString = session.previousWeatherDataString || "";    
        } else {
            console.warn(`Session with ${currentTabId} ID cannot be found`);
            const firstTabId = Object.keys(sessions)[0];
            if (firstTabId) {
                switchTab(firstTabId);
            }
        }

        function stripHtml(html) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            return tempDiv.textContent || tempDiv.innerText || "";
        }
        
        // Get all system message elements from the DOM
        const messagesDiv = document.getElementById('messages');
        const systemMessageElements = messagesDiv.querySelectorAll('.message.system');
        
        // Convert NodeList to an array and get the last five messages
        const lastMessages = Array.from(systemMessageElements).slice(-6);   

        if (savedLocationEnabled !== null) {
            const locationEnabled = JSON.parse(savedLocationEnabled);
            document.getElementById('locationToggle').checked = locationEnabled;
            if (locationEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🌍 Location sharing enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🌍 Location sharing enabled", "system");
                    logToFile(`🌍 Location sharing enabled`);
                }
            }    
        }
        

        if (savedPerplexitySearchEnabled !== null) {
            perplexitySearchEnabled = JSON.parse(savedPerplexitySearchEnabled);
            document.getElementById('perplexityToggle').checked = perplexitySearchEnabled;
            if (perplexitySearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Perplexity Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Perplexity Search enabled", "system");
                    logToFile(`🔎 Perplexity Search enabled`);
                }
            }
        }
        
             

        if (savedBingSearchEnabled !== null) {
            bingSearchEnabled = JSON.parse(savedBingSearchEnabled);
            document.getElementById('bingToggle').checked = bingSearchEnabled;
            if (bingSearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Bing Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Bing Search enabled", "system");
                    logToFile(`🔎 Bing Search enabled`);
                }
            }
        }
        
        

        if (savedGoogleSearchEnabled !== null) {
            googleSearchEnabled = JSON.parse(savedGoogleSearchEnabled);
            document.getElementById('googleToggle').checked = googleSearchEnabled;
            if (googleSearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Google Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Google Search enabled", "system");
                    logToFile(`🔎 Google Search enabled`);
                }
            }
        }
        
        
      
        toggleUpdateButton();
        updateTabsFromSessions();
        switchTab(currentTabId);
        //loadChatFromGoogleDrive();
    };

    const loadChatFromGoogleDrive = async () => {
        try {
            const response = await fetch('cloud_sync.php?action=load_chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: currentTabId
                })
            });
    
            const data = await response.json();
            if (data.status === 'success') {
                // Frissítsd a helyi session-t a felhőből kapott adatokkal
                sessions[currentTabId] = data.chat_data;
                localStorage.setItem("chatSessions", JSON.stringify(sessions));
                document.getElementById("messages").innerHTML = sessions[currentTabId].chatLog || '';
                conversationHistory = [...sessions[currentTabId].conversationHistory];
                displayMessage("☁️ Chat visszatöltve a Google Drive-ról.", "system");
            } else {
                displayMessage(`❌ Chat visszatöltése sikertelen: ${data.message}`, "system");
            }
        } catch (error) {
            console.error("Error loading chat from Google Drive:", error);
            displayMessage("❌ Error loading chat from Google Drive.", "system");
        }
    };
    


    function updateTabLockStatus() {
        document.querySelectorAll("#tabList li").forEach(tab => {
            const tabId = tab.querySelector("a").getAttribute("data-tab");
            const closeBtn = tab.querySelector(".close-tab");
            if (lockedTabs[tabId]) {
                closeBtn.textContent = "🔒";
                closeBtn.style.pointerEvents = "none";
            } else {
                closeBtn.textContent = "❌";
                closeBtn.style.pointerEvents = "auto";
            }
        });
        checkToggleStatus();
    }
    

    const updateTabsFromSessions = () => {
        const tabList = document.getElementById("tabList");
        tabList.innerHTML = '';

        // Betöltjük a mentett tab sorrendet
        const savedTabOrder = JSON.parse(localStorage.getItem("tabOrder")) || [];
        const sessionTabIds = Object.keys(sessions);

        // A mentett tab sorrend alapján építjük fel a tabokat
        savedTabOrder.forEach((tabId) => {
            if (sessions.hasOwnProperty(tabId)) {
                const session = sessions[tabId];
                if (!session) {
                    console.warn(`Session with ${tabId} ID is undefined.`);
                    return;
                }

                const tabElement = document.createElement("li");
                const tabName = session.tabName || `Tab`;
                tabElement.innerHTML = `
                    <a href="#" data-tab="${tabId}">${tabName}</a>
                    <span class="close-tab" data-tab="${tabId}">❌</span>
                `;
                if (tabId === currentTabId) {
                    tabElement.classList.add("active");
                }
                tabList.appendChild(tabElement);

                tabElement.querySelector("a").addEventListener("click", (e) => {
                    e.preventDefault();
                    switchTab(tabId);
                });

                tabElement.querySelector(".close-tab").addEventListener("click", (e) => {
                    e.stopPropagation();
                    closeTab(tabId);
                });
            }
        });

        // Hozzáadjuk az esetleges új tabokat, amelyek még nincsenek a mentett sorrendben
        sessionTabIds.forEach((tabId) => {
            if (!savedTabOrder.includes(tabId)) {
                const session = sessions[tabId];
                if (!session) {
                    console.warn(`Session with ${tabId} ID is undefined.`);
                    return;
                }
                
                const tabElement = document.createElement("li");
                const tabName = session.tabName || `Tab`;
                tabElement.innerHTML = `
                    <a href="#" data-tab="${tabId}">${tabName}</a>
                    <span class="close-tab" data-tab="${tabId}">❌</span>
                `;
                if (tabId === currentTabId) {
                    tabElement.classList.add("active");
                }
                tabList.appendChild(tabElement);

                tabElement.querySelector("a").addEventListener("click", (e) => {
                    e.preventDefault();
                    switchTab(tabId);
                });

                tabElement.querySelector(".close-tab").addEventListener("click", (e) => {
                    e.stopPropagation();
                    closeTab(tabId);
                });
            }
        });

        // Ellenőrizzük, hogy az aktuális tab létezik-e a sessions-ben
        if (sessions[currentTabId]) {
            document.getElementById('initialPrompt').value = sessions[currentTabId].selectedInitialPrompt || initialPromptOnLoad;
            checkToggleStatus();
        } else {
            console.warn(`currentTabId (${currentTabId}) is not found in sessions object`);
            const firstTabId = Object.keys(sessions)[0];
            if (firstTabId) {
                currentTabId = firstTabId;
                session = sessions[currentTabId];
                switchTab(currentTabId);
            }
        }
    };

    const closeTab = (tabId) => {
        // Ellenőrizzük, hogy a tabId létezik-e a sessions-ben
        if (!sessions.hasOwnProperty(tabId)) {
            console.warn(`Tab ID ${tabId} does not exist in sessions.`);
            alert("Invalid tab. Cannot close.");
            return;
        }

        // Ellenőrizzük, hogy a tab zárolva van-e
        if (lockedTabs[tabId]) {
            alert("Locked tab cannot be closed");
            return;
        }

        // Ellenőrizzük, hogy csak egy tab van-e
        if (Object.keys(sessions).length === 1) {
            alert("Main tab cannot be closed");
            return;
        }

        // Töröljük a tabot a sessions objektumból
        delete sessions[tabId];
        // Ha a bezárt tab volt az aktuális, váltsunk át egy másikra
        if (currentTabId === tabId) {
            const remainingTabIds = Object.keys(sessions);
            currentTabId = remainingTabIds[0]; // Választhatsz másik logikát is
            session = sessions[currentTabId];
        }

        // Frissítjük a localStorage-t
        localStorage.setItem("chatSessions", JSON.stringify(sessions));
        saveTabOrder();
        updateTabsFromSessions();
        updateTabLockStatus();
        loadCurrentSession();
        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
        switchTab(currentTabId);

    };



    const removeChatFromLocalStorage = () => {
        if (sessions[currentTabId]) {
            delete sessions[currentTabId];
        }

        localStorage.setItem("chatSessions", JSON.stringify(sessions));

        const messagesDiv = document.getElementById("messages");
        messagesDiv.innerHTML = '';
        updateTabsFromSessions();
    };
    
    sessions = {
        [initialTabId]: {
            conversationHistory: [],
            initialPromptContent: '',
            additionalFile: '',
            knowledgeBaseContent: ''
        }
    };

    function checkToggleStatus() {
        const messagesDiv = document.getElementById('messages');
        const systemMessageElements = messagesDiv.querySelectorAll('.message.system');
        
        // Convert NodeList to an array and get the last six messages
        const lastMessages = Array.from(systemMessageElements).slice(-6);
    
        // Retrieve saved settings
        const savedBingSearchEnabled = localStorage.getItem('bingSearchEnabled');
        const savedGoogleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        const savedLocationEnabled = localStorage.getItem('locationEnabled');
        const savedPerplexitySearchEnabled = localStorage.getItem('perplexitySearchEnabled');
    
        // Function to strip HTML tags (ensure this is defined)
        function stripHtml(html) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            return tempDiv.textContent || tempDiv.innerText || "";
        }
    
        // Location Toggle
        if (savedLocationEnabled !== null) {
            const locationEnabled = JSON.parse(savedLocationEnabled);
            document.getElementById('locationToggle').checked = locationEnabled;
            if (locationEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🌍 Location sharing enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🌍 Location sharing enabled", "system");
                    logToFile(`🌍 Location sharing enabled`);
                }
            }    
        }
    
        // Perplexity Toggle
        if (savedPerplexitySearchEnabled !== null) {
            perplexitySearchEnabled = JSON.parse(savedPerplexitySearchEnabled);
            document.getElementById('perplexityToggle').checked = perplexitySearchEnabled;
            if (perplexitySearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Perplexity Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Perplexity Search enabled", "system");
                    logToFile(`🔎 Perplexity Search enabled`);
                }
            }
        }
    
        // Bing Toggle
        if (savedBingSearchEnabled !== null) {
            bingSearchEnabled = JSON.parse(savedBingSearchEnabled);
            document.getElementById('bingToggle').checked = bingSearchEnabled;
            if (bingSearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Bing Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Bing Search enabled", "system");
                    logToFile(`🔎 Bing Search enabled`);
                }
            }
        }
    
        // Google Toggle
        if (savedGoogleSearchEnabled !== null) {
            googleSearchEnabled = JSON.parse(savedGoogleSearchEnabled);
            document.getElementById('googleToggle').checked = googleSearchEnabled;
            if (googleSearchEnabled) {
                const messageAlreadyDisplayed = lastMessages.some(messageElement => {
                    const contentElement = messageElement.querySelector('.content');
                    const textContent = contentElement ? stripHtml(contentElement.innerHTML).trim() : '';
                    return textContent === "🔎 Google Search enabled";
                });
                if (!messageAlreadyDisplayed) {
                    displayMessage("🔎 Google Search enabled", "system");
                    logToFile(`🔎 Google Search enabled`);
                }
            }
        }
    }
    

    const switchTab = (tabId) => {
        if (!sessions[tabId]) {
            console.warn(`Tab with ${tabId} ID session not found`);
            return;
        }
        saveChatToLocalStorage();
        currentTabId = tabId;
        session = sessions[currentTabId];        

        if (!session) {
            console.warn(`Session for ${currentTabId} not found.`);
            setSession();
        }

        if (session) {             
            document.getElementById('knowledgeBase').value = session.knowledgeBase || knowledgeBaseOnLoad;
            document.getElementById('initialPrompt').value = session.selectedInitialPrompt || initialPromptOnLoad;
            //session.userLocation = session.userLocation || "\nLocation sharing disabled";
            //document.createElement('userLocation').value = userLocation || "\nLocation sharing disabled";
            //session.userLocation = userLocation || "\nLocation sharing disabled";
            localStorage.setItem("userLocation", userLocation || "\nLocation sharing disabled");
            session.userLocation = userLocation || "\nLocation sharing disabled";            
        }                                    
        loadCurrentSession();
        updateActiveTab();
        toggleRemoveFilesButton();        
        reattachEventListeners();        
        localStorage.setItem("currentTabId", currentTabId);
        localStorage.setItem("userLocation", userLocation || "\nLocation sharing disabled");
        session.userLocation = userLocation || "\nLocation sharing disabled";                        
    };

    const updateActiveTab = () => {
        document.querySelectorAll("#tabList li").forEach(li => {
            li.classList.remove("active");
        });

        const activeTabLink = document.querySelector(`[data-tab="${currentTabId}"]`);
        if (activeTabLink && activeTabLink.parentElement) {
            activeTabLink.parentElement.classList.add("active");            
        }
    };

    const addTab = async () => {
        const currentSession = sessions[currentTabId];
        const isCurrentTabEmpty = !currentSession || !currentSession.conversationHistory.length;

        const tabNumbers = Object.values(sessions).map(session => {
            const tabName = session.tabName || '';
            const match = tabName.match(/Tab (\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });

        const nextTabNumber = tabNumbers.length > 0 ? Math.max(...tabNumbers) + 1 : 1;
        const tabId = `tab-${Date.now()}`;
        const newTabName = `Tab ${nextTabNumber}`;

        sessions[tabId] = {
            tabName: newTabName,
            conversationHistory: [],
            initialPromptContent: '',
            customInitialPrompt: '',
            additionalFile: '',
            knowledgeBaseContent: '',
            chatLog: '',
            aiProfileName: initialPromptOnLoad,
            knowledgeBase: knowledgeBaseOnLoad,
            selectedInitialPrompt: initialPromptOnLoad
        };

        const tabList = document.getElementById("tabList");
        const newTab = document.createElement("li");
        newTab.innerHTML = `
        <a href="#" data-tab="${tabId}">${newTabName}</a>
        <span class="close-tab" data-tab="${tabId}">❌</span>`;
        tabList.appendChild(newTab);

        newTab.querySelector("a").addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(tabId);
        });

        newTab.querySelector(".close-tab").addEventListener("click", (e) => {
            e.stopPropagation();
            closeTab(tabId);
        });
        await saveTabOrder();
        await switchTab(tabId);
        await saveChatToLocalStorage();
        await setAndClear();
        await updateTabsFromSessions();
        await updateTabLockStatus();
        document.getElementById('knowledgeBase').value = knowledgeBaseOnLoad;
        document.getElementById('initialPrompt').value = initialPromptOnLoad;
        await updateActiveTab();
        await reattachEventListeners();
        await saveChatToLocalStorage();
        //await saveChatToGoogleDrive();
    };

    const loadCurrentSession = () => {
        session = sessions[currentTabId];
        if (session) {
            conversationHistory = [...session.conversationHistory];
            const knowledgeBase = session.knowledgeBase || '';
            const selectedInitialPrompt = session.selectedInitialPrompt || '';
            const customPrompt = session.customInitialPrompt || '';
            const aiProfileName = session.aiProfileName || '';

            document.getElementById("messages").innerHTML = session.chatLog || '';

            document.getElementById('knowledgeBase').value = knowledgeBase;
            document.getElementById('initialPrompt').value = selectedInitialPrompt;
            document.getElementById('customInitialPrompt').value = customPrompt;

            if (!customPrompt && aiProfileName) {                
                const initialPromptSelect = document.getElementById('initialPrompt');
                const aiProfileOption = Array.from(initialPromptSelect.options).find(option => option.textContent === aiProfileName);
                if (aiProfileOption) {
                    initialPromptSelect.value = aiProfileOption.value;
                }
            }
            reattachEventListeners();            
        } else {
            conversationHistory = [];
            document.getElementById("messages").innerHTML = '';
            document.getElementById('customInitialPrompt').value = '';
            document.getElementById('knowledgeBase').value = '';
            document.getElementById('initialPrompt').value = '';
        }
        toggleSaveButton();
        toggleUpdateButton();        
    };

    const fetchBingSearch = async (query) => {
        try {
            const searchUrl = `bing.php?q=${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl);

            if (response.ok) {
                const data = await response.json();
                const results = data.webPages.value.map(item => ({
                    name: item.name,
                    snippet: item.snippet,
                    url: item.url
                }));
                return results;
            } else {
                throw new Error(`Failed to fetch Bing search results: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error during Bing search:", error);
            displayMessage("❌ Error during Bing search.", "system");
            return [];
        }
    };

    const fetchGoogleSearch = async (query) => {
        try {
            const browserLocale = navigator.language || 'en-US';
            const [languageCode, countryCode] = browserLocale.split('-');
            const response = await fetch(`google.php?q=${encodeURIComponent(query)}`);

            if (response.ok) {
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    return data.items.map(item => ({
                        name: item.title,
                        url: item.link,
                        snippet: item.snippet,
                        displayLink: item.displayLink
                    }));
                } else {
                    displayMessage("⚠️ No Google search results found.", "system");
                    return [];
                }
            } else {
                throw new Error(`Failed to fetch Google search results: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error during Google search:", error);
            displayMessage("❌ Error during Google search.", "system");
            return [];
        }
    };

    const fetchPerplexitySearch = async (query) => {
        try {
            const searchUrl = `perplexity.php`; // Removed the query parameter from the URL
            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ q: query })
            });
    
            if (response.ok) {
                const data = await response.json();
    
                if (data.error) {
                    throw new Error(data.error);
                }
    
                const content = data.choices[0].message.content;
    
                let citations = [];
                if (data.choices[0].citations) {
                    citations = data.choices[0].citations.map(citation => ({
                        name: citation.title,
                        snippet: citation.excerpt,
                        url: citation.url
                    }));
                }
    
                return {
                    content: content,
                    citations: citations
                };
            } else {
                throw new Error(`Failed to fetch Perplexity search results: ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error during Perplexity search:", error);
            displayMessage("❌ Error during Perplexity search.", "system");
            return null;
        }
    };
    

    async function generateKeywords(userInput) {
        let conversationLog;
        conversationLog = conversationHistory.filter(message => message.role !== 'system');
        const lastThreeMessages = conversationLog.slice(-5);
        //console.log("\nconversation log: " + JSON.stringify(lastThreeMessages, null, 2));
        locationLatLon = userLocationText !== "" ? userLocationText : `Latitude: ${latitude}, Longitude: ${longitude}`;
        const payload = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `You must return only the most relevant search keywords formatted for direct use in a search query. Provide no additional text or explanation. Generate keywords based on the user's input. Incorporate the current date, time, and location data only if they are necessary for accuracy or contextual relevance. Use the conversation log for additional context, but ensure that the keywords remain directly relevant to the user's input. Current Date and Time at User Location: ${currentDateTime}\n${locationLatLon}\nConversation log: ` },
                ...lastThreeMessages,
                { role: "user", content: "User Input to generate keywords: " + userInput }
            ],
            temperature: 0.2
        };

        //console.log("\nkeywords payload " + JSON.stringify(payload, null, 2));

        try {
            const response = await fetch(ENDPOINT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const textResponse = await response.text();

            let responseData;
            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error("Failed to parse JSON response: " + textResponse);
            }

            if (responseData.error) {
                throw new Error(responseData.error);
            }
            //console.log("\nkeywords response " + JSON.stringify(responseData, null, 2));        
            return responseData.choices[0].message.content.trim();
        } catch (error) {
            console.error(`Error generating keywords: ${error.message}`);
            return null;
        }
    }

    const generateExactTerms = async (userInput) => {

        let conversationLog;
        conversationLog = conversationHistory.filter(message => message.role !== 'system');
        const lastMessages = conversationLog.slice(-5);
        locationLatLon = userLocationText !== "" ? userLocationText : `Latitude: ${latitude}, Longitude: ${longitude}`;

        const payload = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: `Generate a list of highly relevant exact search terms based on the user input. Return only exact terms without any additional text or explanation. The terms should reflect important and contextually relevant phrases from the input. Will be used in Google Search. Current Date and Time at User Location: ${currentDateTime}\n${locationLatLon}\nConversation log:` },
                ...lastMessages,
                { role: "user", content: "User Input: " + userInput }
            ],
            temperature: 0.2
        };

        try {
            const response = await fetch(ENDPOINT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const textResponse = await response.text();

            let responseData;
            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error("Failed to parse JSON response: " + textResponse);
            }

            if (responseData.error) {
                throw new Error(responseData.error);
            }
            //console.log("\nkeywords response " + JSON.stringify(responseData, null, 2));        
            return responseData.choices[0].message.content.trim();
        } catch (error) {
            console.error("Error generating exact terms:", error);
            return "";
        }
    };

    async function getGeocodedAddress(lat, lon) {
        const url = `geocode.php?lat=${lat}&lon=${lon}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    return {
                        fullAddress: data.address,
                        country: data.country,
                        postcode: data.postcode,
                        state: data.state,
                        region: data.region,
                        country_code: data.country_code,
                        borough: data.borough,
                        road: data.road,
                        house_number: data.house_number,
                        suburb: data.suburb,
                        city_district: data.city_district,
                        neighbourhood: data.neighbourhood,
                        county: data.county,
                        municipality: data.municipality,
                        city: data.city
                    };
                } else {
                    return {
                        fullAddress: `No address found, your coordinates: ${lat} lat, ${lon} lon`,
                        country: 'Unknown',
                        postcode: 'Unknown',
                        state: 'Unknown',
                        region: 'Unknown',
                        country_code: 'Unknown',
                        borough: 'Unknown',
                        road: 'Unknown',
                        house_number: 'Unknown',
                        suburb: 'Unknown',
                        city_district: 'Unknown',
                        neighbourhood: 'Unknown',
                        county: 'Unknown',
                        municipality: 'Unknown',
                        city: 'Unknown'
                    };
                }
            } else {
                return {
                    fullAddress: 'Geocoding failed',
                    country: 'Unknown',
                    postcode: 'Unknown',
                    state: 'Unknown',
                    region: 'Unknown',
                    country_code: 'Unknown',
                    borough: 'Unknown',
                    road: 'Unknown',
                    house_number: 'Unknown',
                    suburb: 'Unknown',
                    city_district: 'Unknown',
                    neighbourhood: 'Unknown',
                    county: 'Unknown',
                    municipality: 'Unknown',
                    city: 'Unknown'
                };
            }
        } catch (error) {
            return {
                fullAddress: 'Geocoding error',
                postcode: 'Unknown',
                state: 'Unknown',
                region: 'Unknown',
                country_code: 'Unknown',
                country: 'Unknown',
                borough: 'Unknown',
                road: 'Unknown',
                house_number: 'Unknown',
                suburb: 'Unknown',
                city_district: 'Unknown',
                neighbourhood: 'Unknown',
                county: 'Unknown',
                municipality: 'Unknown',
                city: 'Unknown'
            };
        }
    }


    const waitForDOMUpdate = () => new Promise(resolve => requestAnimationFrame(resolve));
    const captureImage = () => {

        now = new Date();
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' };
        currentDateTime = `${now.toLocaleDateString('hu-HU', options)}`;

        const input = document.createElement('input');
        const allowedExtensions = ['png', 'jpg', 'gif', 'jpeg', 'webp', 'bmp', 'heic', 'tga'];
        const acceptedFileTypes = allowedExtensions.map(ext => `.${ext}`).join(',');
        input.type = 'file';
        input.accept = acceptedFileTypes;
        input.multiple = true; // Allow multiple image selection

        input.onchange = async (event) => {
            const files = event.target.files; // All selected files
            let imageUrls = [];

            if (files.length === 0) return;

            // Show the appropriate uploading status
            const uploadStatusId = (files.length > 1)
                ? displayMessage("🚀 Uploading images...", "system")
                : displayMessage("🚀 Uploading image...", "system");

            // Allow DOM to update before starting uploads
            await waitForDOMUpdate();

            // Loop through files and upload them sequentially
            for (const file of files) {


                // Display uploading message for each file
                const fileUploadingId = displayMessage(`⬆️ Uploading ${file.name}...`, "system");
                await waitForDOMUpdate();

                const resizedImage = await resizeAndConvertImage(file, 1024, 2 * 1024 * 1024); // Resize image

                if (resizedImage) {
                    const formData = new FormData();
                    formData.append('image', resizedImage, 'image.jpg');

                    try {
                        const response = await fetch('upload_image.php', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await response.json();

                        if (data.status === 'success') {
                            imageUrls.push(data.image_url); // Add image URL to the list
                            // Display success message for each uploaded image
                            displayMessage(`✅ ${file.name} uploaded successfully.`, "system");
                            await waitForDOMUpdate();
                        } else {
                            displayMessage(`❌ Error uploading ${file.name}`, "system");
                            await waitForDOMUpdate();
                        }
                    } catch (error) {
                        console.error("Error uploading image:", error);
                        displayMessage(`❌ Error uploading ${file.name}`, "system");
                        await waitForDOMUpdate();
                    }
                } else {
                    displayMessage(`⚠️ ${file.name} is too large or could not be converted`, "system");
                    await waitForDOMUpdate();
                }

                // Remove the individual uploading status message
                removeMessage(fileUploadingId);
            }

            // Remove the general uploading status message after all images are processed
            removeMessage(uploadStatusId);
            await waitForDOMUpdate();

            // Now that all images are uploaded and processed, ask for user input
            if (imageUrls.length > 0) {
                let userInput = await promptUserForInput();
                conversationLog = conversationHistory.filter(message => message.role !== 'system');
                const lastThreeMessages = conversationLog.slice(-5);
                let contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\nConversation history: \n" + lastThreeMessages.map(message => message.content).join('\n\n') + "\nUser location: " + userLocationText + "\nUser Location coordinates: " + userLocation + "\nCurent Date and Time: " + currentDateTime + "\nUser Input: ";
                if (userInput === null) {
                    displayMessage("❌ Image analysis cancelled", "system");
                    return; // Exit the function early
                }

                if (imageUrls.length === 1) {
                    if (!userInput || userInput.trim() === "") {
                        userInput = "What’s in this image?";
                        displayMessage("⚠️ Missing user question, using default: 'What’s in this image?'", "system");
                        await waitForDOMUpdate();
                    }
                } else {
                    if (!userInput || userInput.trim() === "") {
                        userInput = "What’s in these images?";
                        displayMessage("⚠️ Missing user question, using default: 'What’s in these images?'", "system");
                        await waitForDOMUpdate();
                    }
                }

                imageUrls.forEach(imageUrl => {
                    displayImage(imageUrl, "user");
                });

                displayMessage(userInput, "user");
                await waitForDOMUpdate();
                await logToFile(`🧑 User: ${userInput}`);
                await logToFile(`🖼️ Images: ${imageUrls}`);
                if (imageUrls.length === 1) {
                    loadingVision = displayMessage("📷 Analyzing image...", "system");
                } else {
                    loadingVision = displayMessage("📷 Analyzing images...", "system");
                }
                await waitForDOMUpdate();
                loadingMessageId = displayMessage(`🤖 AI is thinking about the response...`, "system");
                await waitForDOMUpdate();
                const visionResponse = await fetch('process_image.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image_urls: imageUrls, // Multiple image URLs
                        user_input: contextForImages + userInput
                    })
                });
                //console.log(contextForImages + userInput);                                   
                const visionData = await visionResponse.json();

                if (visionData.status === 'success') {
                    const visionResult = visionData.result;
                    await logToFile(`🤖 Assistant: ${visionResult}\n`);
                    appendVisionResult(visionResult, imageUrls); // Display results for multiple images
                    if (loadingVision) removeMessage(loadingVision);
                    if (loadingMessageId) removeMessage(loadingMessageId);
                } else {
                    displayMessage("❌ OpenAI Vision processing error", "system");
                    if (loadingVision) removeMessage(loadingVision);
                    if (loadingMessageId) removeMessage(loadingMessageId);
                }
            }
        };

        input.click();
    };


    const resizeAndConvertImage = (file, maxWidth, maxSizeInBytes) => {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();

            // Function to resize the image and convert it to a Blob
            const processImage = (imageFile) => {
                reader.onload = (e) => {
                    img.src = e.target.result;

                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        let width = img.width;
                        let height = img.height;

                        // Resizing logic
                        if (width > maxWidth) {
                            height = Math.floor((height * maxWidth) / width);
                            width = maxWidth;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob(
                            (blob) => {
                                if (blob.size <= maxSizeInBytes) {
                                    resolve(blob);
                                } else {
                                    displayMessage("⚠️ The image became too large after conversion", "system");
                                    resolve(null);
                                }
                            },
                            'image/jpeg', // Force the conversion to JPEG format
                            0.85 // Compression level
                        );
                    };
                };

                reader.readAsDataURL(imageFile);
            };

            // Check if it's a HEIC file
            if (file.type === "image/heic" || file.name.endsWith(".heic")) {
                heic2any({ blob: file, toType: "image/jpeg" })
                    .then((convertedBlob) => {
                        // Once the HEIC is converted, process the converted image
                        processImage(convertedBlob);
                    })
                    .catch((error) => {
                        console.error("Error converting HEIC:", error);
                        displayMessage("⚠️ Error converting HEIC image", "system");
                        resolve(null);
                    });
            }
            // Check if it's a TGA file
            else if (file.name.endsWith(".tga")) {
                displayMessage("⚠️ TGA format is not supported in this browser environment.", "system");
                resolve(null);
            } else {
                // Process non-HEIC and non-TGA images directly
                processImage(file);
            }
        });
    };

    // Helper function to convert a canvas to a Blob
    const canvasToBlob = (canvas) => {
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/jpeg',
                0.85 // Compression level
            );
        });
    };

    // Ez a függvény várja a felhasználói inputot
    const promptUserForInput = () => {
        return new Promise((resolve) => {
            const userInput = prompt("Please enter your question about the image(s):");
            resolve(userInput);
        });
    };

    const displayImage = (imageUrl, role, subRole = null) => {
        const messagesDiv = document.getElementById("messages");
        const messageElement = document.createElement("div");
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        messageElement.id = messageId;
        messageElement.classList.add("message", role);

        session = sessions[currentTabId];

        const now = new Date();
        const formattedDate = `${now.getDate()}/${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear().toString().slice(-2)}`;
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let avatarText = '';
        if (role === "user") {
            avatarText = `🧑 You`;
        } else if (role === "assistant") {
            avatarText = `${session.aiProfileName}`;
        }

        let timestampHtml = '';
        const subRoleClass = subRole ? ` ${subRole}` : '';
        if (role === "user" || role === "assistant") {
            timestampHtml = `<div class="timestamp">${formattedDate} ${formattedTime}</div>`;
        }

        // Kép HTML eleme
        const imgHtml = `<img src="${imageUrl}" alt="Uploaded Image" style="max-width: 100%; height: auto; border-radius: 5px;"><br><br>`;

        messageElement.innerHTML = `        
        <div class="avatar">${avatarText}</div>
        <div class="content${subRoleClass}">${imgHtml}</div>
        ${timestampHtml}
        <div class="icons-container" style="position: relative; bottom: 0px;">                 
        </div>
        `;

        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        toggleSaveButton();
        toggleUpdateButton();
        saveChatToLocalStorage();
        //saveChatToGoogleDrive();

        return messageId;
    };

    const appendVisionResult = (visionText, imageUrls) => {
        // Hozzáadjuk a Vision eredményét a beszélgetéshez, mint felhasználói input            
        displayMessage(`📸 ${visionText}`, "assistant");
        conversationHistory.push({ role: "user", content: `Image Analysis: ${visionText}` });

        // Megjelenítjük a feltöltött képet a chatben
        //for (const imageUrl of imageUrls) {
        //    displayImage(imageUrl, "assistant");
        //}

        // Automatikusan elküldjük a beszélgetést a válasz generálásához
        sendMessage();
        saveChatToLocalStorage();
        //saveChatToGoogleDrive();
    };

    function splitTextIntoChunks(fileContents, chunkSize = fileCharacterChunk) {
        const chunks = [];
        const files = Object.keys(fileContents); // A fájlnevek listája
      
        files.forEach((fileName) => {
          const content = fileContents[fileName];
          const totalParts = Math.ceil(content.length / chunkSize);
      
          for (let i = 0; i < totalParts; i++) {
            const chunkContent = content.slice(i * chunkSize, (i + 1) * chunkSize);
            const chunkInfo = {
              fileName: fileName,
              part: i + 1,
              totalParts: totalParts,
              content: chunkContent,
            };
            chunks.push(chunkInfo);
          }
        });
      
        return chunks;
      }

      async function processLargeText(chunk, userInput) {
        let conversationLog = conversationHistory.filter(message => message.role !== 'system');
        const lastFiveMessages = conversationLog.slice(-5);
      
        const payload = {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              //content: `A feladat hosszú szövegek és könyvek feldolgozása. Az aktuálisan feldolgozott fájl: ${chunk.fileName}, Part ${chunk.part} of ${chunk.totalParts}. Válaszolj a felhasználó kérdésére az adott szövegrészlet alapján.`,
              //content: `Your task is to process long texts and books. You are currently processing the file: ${chunk.fileName}, Part ${chunk.part} of ${chunk.totalParts}. Answer the user's question based on the provided text chunk.`,
              content: `Your task is to process long texts and books. You are currently processing the file: ${chunk.fileName}, Part ${chunk.part} of ${chunk.totalParts}. Provide a concise summary of this text chunk to help maintain context when combining chunks later. Answer the user's question based on the provided text chunk. Ensure that your responses help in connecting the threads between chunks.`,
            },
            ...lastFiveMessages,
            { role: "user", content: `User question: ${userInput}` },
            { role: "assistant", content: `Text chunk:\n${chunk.content}` },
          ],
          temperature: 0.2,
        };
      
        try {
          const response = await fetch(ENDPOINT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const textResponse = await response.text();
      
          let responseData;
          try {
            responseData = JSON.parse(textResponse);
          } catch (e) {
            throw new Error("Failed to parse JSON response: " + textResponse);
          }
      
          if (responseData.error) {
            throw new Error(responseData.error);
          }
      
          const reply = responseData.choices[0].message.content.trim();
          return reply;
        } catch (error) {
            console.error(`Error during processLargeText: ${error.message}`);
            return `An error occurred during processing: ${error.message}`;
        }
      }      


    const sendMessage = async () => {
        session = sessions[currentTabId];
        const userInput = sanitizeInput(document.getElementById("userInput").value);
        if (!userInput) return;

        document.getElementById("userInput").value = '';
        displayMessage(userInput, "user");
        document.getElementById("sendBtn").disabled = true;

        const selectedFile = document.getElementById('knowledgeBase').value;
        if (selectedFile && !sessions[currentTabId].knowledgeBaseContent) {
            try {
                await loadKnowledgeBaseContent(selectedFile);
            } catch (error) {
                console.error("Error loading knowledge base:", error);
                displayMessage("❌ Error loading knowledge base.", "system");
                return;
            }
        }

        conversationHistory.push({ role: "user", content: userInput });

        while (getTokenCount(conversationHistory) > MAX_TOKENS) {
            if (conversationHistory.length > 1) {
                conversationHistory.splice(1, 1);
            } else {
                break;
            }
        }

        now = new Date();
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' };
        currentDateTime = `${now.toLocaleDateString('hu-HU', options)}`;

        bingSearchResults = [];
        googleSearchResults = [];
        perplexitySearchResults = null;
        let perplexityContent = "";
        let perplexityCitations = [];
        let bingSearchLinks = "";
        let googleSearchLinks = "";
        let keywords = userInput;
        combinedResponses = 'No files attached';


        if (session.fileContents) {
            combinedResponses = '';
            const totalCharacters = Object.values(session.fileContents).reduce((acc, content) => acc + content.length, 0);
            //console.log(totalCharacters);
            if (totalCharacters > fileCharacterChunk) {
              const chunks = splitTextIntoChunks(session.fileContents);
              //console.log(chunks);
              // Feldolgozási üzenet megjelenítése
              let processingMessageId = displayMessage("📄 Processing text files...", "system");
        
              // Chunkok feldolgozása
              
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];                
                // Feldolgozási állapot frissítése
                const progressMessage = `👁️‍🗨️ AI is reading the following document: ${chunk.fileName} - Part ${chunk.part} of ${chunk.totalParts}`;
                removeMessage(processingMessageId);
                processingMessageId = displayMessage(progressMessage, "system");
        
                // Válasz generálása az adott chunkra
                const response = await processLargeText(chunk, userInput);
                combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;
              }
        
              // Feldolgozási üzenet eltávolítása
              removeMessage(processingMessageId);
        
              // A kombinált válasz megjelenítése
              //displayMessage(combinedResponses, "assistant");
        
              // Az új tartalom elmentése
              //session.fileContents = combinedResponses;
            } else {
                //session.fileContents = session.fileContents;
                //session.fileContents =  Object.values(session.fileContents).join('\n');
                const fileNames = Object.keys(session.fileContents);
                for (const fileName of fileNames) {
                  const content = session.fileContents[fileName];
                  const chunk = {
                    fileName: fileName,
                    part: 1,
                    totalParts: 1,
                    content: content,
                  };
            
                  // Feldolgozási állapot frissítése
                  const progressMessage = `👁️‍🗨️ AI is reading the following document: ${chunk.fileName}`;
                  let processingMessageId = displayMessage(progressMessage, "system");
            
                  // Válasz generálása az adott chunkra
                  const response = await processLargeText(chunk, userInput);
            
                  // Feldolgozási üzenet eltávolítása
                  removeMessage(processingMessageId);
            
                  // A válasz megjelenítése
                  //displayMessage(`📄 ${chunk.fileName} response:\n${response}`, "assistant");
            
                  // Az új tartalom elmentése
                  combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;
                  //session.fileContents = combinedResponses;               
            }
          }
        }


        if (bingSearchEnabled || googleSearchEnabled) {
            loadingBingKeywordId = displayMessage("🔎 Generating keywords...", "system");
            keywords = await generateKeywords(userInput);
            removeMessage(loadingBingKeywordId);
        }

        if (!keywords) {
            displayMessage("⚠️ Failed to generate keywords for search.", "system");
        } else {

        }

        if (perplexitySearchEnabled) {
            let conversationLog;
            conversationLog = conversationHistory.filter(message => message.role !== 'system');
            //const lastMessages = conversationLog.slice(-5);
            //const lastMessages = conversationLog;
            const lastMessages = conversationLog.slice(-7);
            const lastMessagesContent = lastMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
            const loadingPerplexityMessageId = displayMessage("🔎 Searching on Perplexity...", "system");
            //const perplexityResult = await fetchPerplexitySearch("Last user messages:\n" + lastMessages + "\nUser input: " + userInput);
            const perplexityResult = await fetchPerplexitySearch("Current date and time: " + currentDateTime + "\nChat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);

            //console.log("Current date and time: " + currentDateTime + "\nChat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);
            //console.log("Chat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);
            //console.log(perplexityResult);
            removeMessage(loadingPerplexityMessageId);

            if (perplexityResult) {
                perplexityContent = perplexityResult.content;
                perplexityCitations = perplexityResult.citations;
            }
        }

        if (bingSearchEnabled) {
            loadingBingMessageId = displayMessage("🔎 Searching on Bing...", "system");
            bingSearchResults = await fetchBingSearch(keywords);
            if (bingSearchResults.length > 0) {
                bingSearchLinks = bingSearchResults.map(result => `<a href="${result.url}" target="_blank">${result.name}</a>`).join("<br>");
            }
            removeMessage(loadingBingMessageId);
        }

        if (googleSearchEnabled) {
            loadingGoogleMessageId = displayMessage("🔎 Searching on Google...", "system");
            googleSearchResults = await fetchGoogleSearch(keywords);
            //console.log(googleSearchResults)
            if (googleSearchResults.length > 0) {
                googleSearchLinks = googleSearchResults.map(result => `<a href="${result.url}" target="_blank">${result.name}</a>`).join("<br>");
            }
            //console.log(googleSearchResults);  
            removeMessage(loadingGoogleMessageId);
        }

        //console.log("keywords: " + keywords);
        let formattedBingResults = "";
        if (bingSearchResults.length > 0) {
            formattedBingResults = "Bing Search Results:\n" + bingSearchResults.map(result => `${result.name}: ${result.snippet} ${result.url}`).join("\n");
        }

        let formattedGoogleResults = "";
        if (googleSearchResults.length > 0) {
            formattedGoogleResults = "Google Search Results:\n" + googleSearchResults.map(result => `${result.name}: ${result.snippet} ${result.url}`).join("\n");
        }
        //console.log(formattedGoogleResults);
        //console.log(googleSearchResults);

        //console.log(formattedBingResults);

        let formattedPerplexityResults = "";
        if (perplexityContent) {
            //displayMessage(`🔎 Perplexity Answer:<br>${perplexityContent}`, "system");
            formattedPerplexityResults = perplexityText + perplexityContent;
        }

        if (perplexityCitations.length > 0) {
            const formattedPerplexityCitations = perplexityCitations.map((citation, index) =>
                `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${citation.url}" target="_blank">${citation.name}</a></span>`
            ).join("<br>");
            //displayMessage(`🔎 Perplexity Citations:<br>${formattedPerplexityCitations}`, "system");
        }

        locationLatLon = userLocationText !== "" ? userLocationText : `Latitude: ${latitude}, Longitude: ${longitude}`;
        if (session.loadedFiles && session.loadedFiles.length > 0) {
        formattedLoadedFiles = `Files are attached. In all of your responses, you must use the content of the summaries of the attached files to answer. Files are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries for each part are provided in the following format:\n\nfilename.ext - Part [number] response:\n[Summary of Part [number]]\n\nMultiple files and their respective parts will be included similarly. Please concatenate these summaries to provide a comprehensive response to the user.\n\nAttached files, documents, books, text files:\n${session.loadedFiles.join('\n')}\n\nSummary of the content of the files, used to answer the user's question, use by context, you can read files by context:`;
        } else {
            formattedLoadedFiles = ``;
        }
        const payload = {
            model: "gpt-4o-mini",
            messages: [
                //{ role: "system", content: `System parameters in context:\nCurrent Date and Time at User Location: ${currentDateTime}\n${userLocation}\n${userLocationText}\n${metarDataRaw}\nFile Attachment contents in context (PDF, docx or other plain text file contents):\n ${combinedResponses}\nKnowledge Base to use:\n ${sessions[currentTabId].knowledgeBaseContent}\n${formattedBingResults}\n${formattedGoogleResults}\n${formattedPerplexityResults}` },
                { role: "system", content: `System parameters in context:\nCurrent Date and Time at User Location: ${currentDateTime}\n${userLocation}\n${userLocationText}\n${metarDataRaw}\n\nFile Attachment contents in context (PDF, epub, docx or other text file contents):\nIf "No files attached" appears below, it means the user did not attach any files.\n\n${formattedLoadedFiles}${combinedResponses}\n\nKnowledge Base to use:\n ${sessions[currentTabId].knowledgeBaseContent}\n\n${formattedBingResults}\n\n${formattedGoogleResults}\n\n${formattedPerplexityResults}` },
                ...conversationHistory
            ],
            temperature: TEMPERATURE
        };
        //console.log(perplexityContent);
        //console.log(perplexityCitations);
        console.log(payload);
        //console.log(formattedLoadedFiles);

        const displaySearchResults = (bingResults, googleResults) => {
            if (bingResults.length > 0) {
                const formattedBingResults = bingResults.map(result => `<a href="${result.url}" target="_blank">${result.name}</a>`).join("<br>");
                displayMessage(`🔎 Bing Search Results:<br>${formattedBingResults}`, "system");
            }

            if (googleResults.length > 0) {
                const formattedGoogleResults = googleResults.map(result => `<a href="${result.url}" target="_blank">${result.name}</a>`).join("<br>");
                displayMessage(`🔎 Google Search Results:<br>${formattedGoogleResults}`, "system");
            }
        };

        //console.log("\npayload: " + JSON.stringify(payload, null, 2));     
        const loadingMessageId = displayMessage(`🤖 AI is thinking about the response...`, "system");

        try {
            const response = await fetch(ENDPOINT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const textResponse = await response.text();

            let responseData;
            try {
                responseData = JSON.parse(textResponse);
            } catch (e) {
                throw new Error("Failed to parse JSON response: " + textResponse);
            }

            if (responseData.error) {
                throw new Error(responseData.error);
            }
            //console.log(responseData)
            const reply = responseData.choices[0].message.content;
            conversationHistory.push({ role: "assistant", content: reply });

            removeMessage(loadingMessageId);

            displayMessage(reply, "assistant");

            const totalTokens = responseData.usage.total_tokens;
            await logToFile(`🧑 User: ${userInput}`);
            await logToFile(`🤖 Assistant: ${reply}`);
            await logToFile(`⭐ Total Tokens: ${totalTokens}\n`);




            if (bingSearchLinks && googleSearchLinks) {
                displayMessage(`🔗 Used keywords: ${keywords}`, "system", "bing-keywords");

                // Formázzuk a Bing keresési eredményeket
                const formattedBingSearchLinks = bingSearchResults.map((result, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a></span>`
                ).join("<br>");

                // Formázzuk a Google keresési eredményeket
                const formattedGoogleSearchLinks = googleSearchResults.map((result, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a></span>`
                ).join("<br>");

                // Bing Data össze- és kinyitható blokk
                const bingId = `bing-${Date.now()}`;
                const bingMessageHtml = `
                    <div>
                        <span id="${bingId}-legend" style="cursor: pointer;">
                            🔽 Bing Results 🔽
                        </span>
                        <div id="${bingId}-content" style="display: none; margin-left: 20px;">
                            ${formattedBingSearchLinks}
                        </div>
                    </div>
                `;
                displayMessage(bingMessageHtml, "system");

                // Eseménykezelő hozzáadása
                setTimeout(() => {
                    const bingLegendSpan = document.getElementById(`${bingId}-legend`);
                    bingLegendSpan.addEventListener('click', () => {
                        const bingContentDiv = document.getElementById(`${bingId}-content`);
                        if (bingContentDiv.style.display === 'none' || bingContentDiv.style.display === '') {
                            bingContentDiv.style.display = 'block';
                            bingLegendSpan.innerHTML = '🔼 Bing Results 🔼';
                        } else {
                            bingContentDiv.style.display = 'none';
                            bingLegendSpan.innerHTML = '🔽 Bing Results 🔽';
                        }
                    });
                }, 0);

                // Google Data össze- és kinyitható blokk
                const googleId = `google-${Date.now()}`;
                const googleMessageHtml = `
                    <div>
                        <span id="${googleId}-legend" style="cursor: pointer;">
                            🔽 Google Results 🔽
                        </span>
                        <div id="${googleId}-content" style="display: none; margin-left: 20px;">
                            ${formattedGoogleSearchLinks}
                        </div>
                    </div>
                `;
                displayMessage(googleMessageHtml, "system");

                // Eseménykezelők hozzáadása
                setTimeout(() => {
                    // Bing eseménykezelő
                    const bingLegendSpan = document.getElementById(`${bingId}-legend`);
                    bingLegendSpan.addEventListener('click', () => {
                        const bingContentDiv = document.getElementById(`${bingId}-content`);
                        if (bingContentDiv.style.display === 'none' || bingContentDiv.style.display === '') {
                            bingContentDiv.style.display = 'block';
                            bingLegendSpan.innerHTML = '🔼 Bing Results 🔼';
                        } else {
                            bingContentDiv.style.display = 'none';
                            bingLegendSpan.innerHTML = '🔽 Bing Results 🔽';
                        }
                    });

                    // Google eseménykezelő
                    const googleLegendSpan = document.getElementById(`${googleId}-legend`);
                    googleLegendSpan.addEventListener('click', () => {
                        const googleContentDiv = document.getElementById(`${googleId}-content`);
                        if (googleContentDiv.style.display === 'none' || googleContentDiv.style.display === '') {
                            googleContentDiv.style.display = 'block';
                            googleLegendSpan.innerHTML = '🔼 Google Results 🔼';
                        } else {
                            googleContentDiv.style.display = 'none';
                            googleLegendSpan.innerHTML = '🔽 Google Results 🔽';
                        }
                    });


                }, 0);
                reattachEventListeners();
                switchTab(currentTabId);
            } else if (bingSearchLinks) {
                displayMessage(`🔗 Bing keywords: ${keywords}`, "system", "bing-keywords");

                const formattedBingSearchLinks = bingSearchResults.map((result, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a></span>`
                ).join("<br>");

                // Bing Data össze- és kinyitható blokk
                const bingId = `bing-${Date.now()}`;
                const bingMessageHtml = `
                    <div>
                        <span id="${bingId}-legend" style="cursor: pointer;">
                            🔽 Bing Results 🔽
                        </span>
                        <div id="${bingId}-content" style="display: none; margin-left: 20px;">
                            ${formattedBingSearchLinks}
                        </div>
                    </div>
                `;
                displayMessage(bingMessageHtml, "system");

                // Eseménykezelő hozzáadása
                setTimeout(() => {
                    const bingLegendSpan = document.getElementById(`${bingId}-legend`);
                    bingLegendSpan.addEventListener('click', () => {
                        const bingContentDiv = document.getElementById(`${bingId}-content`);
                        if (bingContentDiv.style.display === 'none' || bingContentDiv.style.display === '') {
                            bingContentDiv.style.display = 'block';
                            bingLegendSpan.innerHTML = '🔼 Bing Results 🔼';
                        } else {
                            bingContentDiv.style.display = 'none';
                            bingLegendSpan.innerHTML = '🔽 Bing Results 🔽';
                        }
                    });

                }, 0);
                reattachEventListeners();
                switchTab(currentTabId);
            } else if (googleSearchLinks) {
                displayMessage(`🔗 Google keywords: ${keywords}`, "system", "bing-keywords");

                const formattedGoogleSearchLinks = googleSearchResults.map((result, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a></span>`
                ).join("<br>");

                // Google Data össze- és kinyitható blokk
                const googleId = `google-${Date.now()}`;
                const googleMessageHtml = `
                    <div>
                        <span id="${googleId}-legend" style="cursor: pointer;">
                            🔽 Google Results 🔽
                        </span>
                        <div id="${googleId}-content" style="display: none; margin-left: 20px;">
                            ${formattedGoogleSearchLinks}
                        </div>
                    </div>
                `;
                displayMessage(googleMessageHtml, "system");

                // Eseménykezelő hozzáadása
                setTimeout(() => {
                    const googleLegendSpan = document.getElementById(`${googleId}-legend`);
                    googleLegendSpan.addEventListener('click', () => {
                        const googleContentDiv = document.getElementById(`${googleId}-content`);
                        if (googleContentDiv.style.display === 'none' || googleContentDiv.style.display === '') {
                            googleContentDiv.style.display = 'block';
                            googleLegendSpan.innerHTML = '🔼 Google Results 🔼';
                        } else {
                            googleContentDiv.style.display = 'none';
                            googleLegendSpan.innerHTML = '🔽 Google Results 🔽';
                        }
                    });

                }, 0);
                reattachEventListeners();
                switchTab(currentTabId);
            }

            if (perplexitySearchResults) {
                const formattedPerplexitySearchLinks = perplexitySearchResults.map((result, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a></span>`
                ).join("<br>");
                displayMessage(`🔎 Used Perplexity results:<br>${formattedPerplexitySearchLinks}`, "system");
            }

            if (perplexityContent) {
                const perplexityId = `perplexity-${Date.now()}`;

                // Display the legend as a system message
                const legendHtml = `
                <span id="${perplexityId}-legend" style="cursor: pointer;">
                🔽 Perplexity AI Response 🔽
                </span>
                `;
                displayMessage(legendHtml, "system");

                // Display the perplexityContent as an assistant message, initially hidden
                const messageId = displayMessage(perplexityContent, "perplexity");
                const messageElement = document.getElementById(messageId);
                messageElement.style.display = 'none';

                // Add event listener to toggle display
                setTimeout(() => {
                    const legendSpan = document.getElementById(`${perplexityId}-legend`);
                    legendSpan.addEventListener('click', () => {
                        if (messageElement.style.display === 'none' || messageElement.style.display === '') {
                            messageElement.style.display = 'block';
                            legendSpan.innerHTML = '🔼 Perplexity AI Response 🔼';
                        } else {
                            messageElement.style.display = 'none';
                            legendSpan.innerHTML = '🔽 Perplexity AI Response 🔽';
                        }
                    });

                }, 0);
                reattachEventListeners();
                switchTab(currentTabId);
            }


            if (perplexityCitations.length > 0) {
                const formattedPerplexityCitations = perplexityCitations.map((citation, index) =>
                    `<span style="font-size: 10px; padding-left: 15px;">${index + 1}. <a href="${citation.url}" target="_blank">${citation.name}</a></span>`
                ).join("<br>");
                displayMessage(`🔎 Perplexity Citations:<br>${formattedPerplexityCitations}`, "system");
            }

            if (totalTokens >= TOKEN_LIMIT) {
                await resetSession();
            }
            await saveChatToLocalStorage();
            //await saveChatToGoogleDrive();
            await reattachEventListeners();
            await switchTab(currentTabId);
        } catch (error) {
            removeMessage(loadingMessageId);
            displayMessage(`Error: ${error.message}`, "system");
        } finally {
            userInput.value = "";
            document.getElementById("sendBtn").disabled = false;
            saveChatToLocalStorage();
            //saveChatToGoogleDrive();
            reattachEventListeners();
            switchTab(currentTabId);
        }
    };

    function restoreTabOrder() {
        const savedTabOrder = JSON.parse(localStorage.getItem("tabOrder"));
        if (savedTabOrder) {
            const tabList = document.getElementById("tabList");
            const allTabs = Array.from(tabList.children);

            tabList.innerHTML = '';
            savedTabOrder.forEach((tabId) => {
                const tab = allTabs.find(li => li.querySelector('a').getAttribute('data-tab') === tabId);
                if (tab) {
                    tabList.appendChild(tab);
                }
            });
        }
    }

    function saveTabOrder() {
        const tabList = document.getElementById("tabList");
        const tabOrder = Array.from(tabList.children).map(li => li.querySelector('a').getAttribute('data-tab'));
        localStorage.setItem("tabOrder", JSON.stringify(tabOrder));
    }

    async function initiateCloudSync() {
        try {
            // Először ellenőrizzük, hogy a felhasználó már be van-e jelentkezve a Google Drive-ba
            const response = await fetch('cloud_sync.php?action=check_auth');
            const data = await response.json();
    
            if (data.authenticated) {
                // Ha már be van jelentkezve, indítsd el a szinkronizációt
                //await saveChatToGoogleDrive();
            } else {
                // Ha nincs bejelentkezve, irányítsd át a felhasználót a Google OAuth2 hitelesítésre
                window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(api_client_id)}&redirect_uri=${encodeURIComponent(api_redirect_uri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive.file")}&access_type=offline&prompt=consent`;
            }
        } catch (error) {
            console.error("Error initiating cloud sync:", error);
            displayMessage("❌ Error initiating cloud sync.", "system");
        }
    }
    
    
    async function synchronizeChats() {
        //await saveChatToGoogleDrive();
    } 

    (function () {
        document.addEventListener("DOMContentLoaded", () => {
            
            window.addEventListener("load", function(){
                window.cookieconsent.initialise({
                    "palette": {
                        "popup": {
                            "background": "rgba(35, 122, 252, 0.8)",
                            "text": "#ffffff"
                        },
                        "button": {
                            "background": "#fff",
                            "text": "#237afc"
                        }
                    },
                    "position": "bottom",
                    "content": {
                        "message":  `${aiProfileName} uses cookies to ensure you get the best experience on our website.<br>By using our website, you agree to our use of cookies.<br>`,
                        "dismiss": " Got it!",
                        "link": " Click here to read our cookie & GDPR policy.",
                        "href": "https://www.hungaryvfr.hu/cookie_policy.php"
                    },
                    "onInitialise": function(status) {
                        var type = this.options.type;
                        var didConsent = this.hasConsented();
                        if (type == "opt-in" && didConsent) {
                            // User has given consent, hide the notification
                            this.destroy();
                        }
                    },
                    "onStatusChange": function(status, chosenBefore) {
                        if (status === 'dismiss') {
                            // User has clicked "Got it!", hide the notification
                            this.destroy();
                        }
                    }
                })
            });

            (async () => {                
                await loadKnowledgeBaseFiles();
                await loadInitialPromptFiles();
                await loadConfig();
                await initializeVoices();
                await loadChatFromLocalStorage();           

                session = sessions[currentTabId];



                if (!session.tabName) {
                    session.tabName = "Tab 1";
                    console.log("Test 1");
                    await loadConfig();
                    await setSession();
                    await saveChatToLocalStorage();
                    //await saveChatToGoogleDrive();
                    await setAndClear();
                }

                if (!session.conversationHistory || session.conversationHistory.length === 0) {
                    document.getElementById('knowledgeBase').value = knowledgeBaseOnLoad;
                    document.getElementById('initialPrompt').value = initialPromptOnLoad;
                    await setAndClear();
                    await saveTabOrder();
                    await switchTab(currentTabId);
                    await updateTabsFromSessions();
                    await updateTabLockStatus();
                    await updateActiveTab();
                    await saveChatToLocalStorage();
                    //await saveChatToGoogleDrive();
                    //await saveCurrentSession();             

                    //console.log("Test 2");
                    session = sessions[currentTabId];
                }

                session.usedKnowledgeBase = knowledgeBase;
                session.previousKnowledgeBase = session.usedKnowledgeBase;
                session.knowledgeBase = session.usedKnowledgeBase;

                document.getElementById("addTabBtn").addEventListener("click", addTab);

                now = new Date();
                userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' };
                currentDateTime = `${now.toLocaleDateString('hu-HU', options)}`

                /*await updateTabsFromSessions();
                await updateActiveTab();
                await updateTabLockStatus();  */


                setInterval(async () => {
                    if (document.getElementById("locationToggle").checked) {
                        await checkForPositionChange();
                    }
                }, 60000);

                document.getElementById("addTabBtn").addEventListener("click", addTab);

                document.getElementById("setAndClearBtn").addEventListener("click", setAndClear);

                function setLinksTarget() {
                    const links = document.querySelectorAll("#messages a");
                    links.forEach(link => {
                        link.setAttribute("target", "_blank");
                    });
                }

                setLinksTarget();

                const savedTabOrder = JSON.parse(localStorage.getItem("tabOrder"));
                if (savedTabOrder) {
                    const tabList = document.getElementById("tabList");
                    const allTabs = Array.from(tabList.children);

                    tabList.innerHTML = '';
                    savedTabOrder.forEach((tabId) => {
                        const tab = allTabs.find(li => li.querySelector('a').getAttribute('data-tab') === tabId);
                        if (tab) {
                            tabList.appendChild(tab);
                        }
                    });
                }

                const observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        if (mutation.addedNodes.length > 0) {
                            setLinksTarget();
                        }
                    });
                });

                const config = { childList: true, subtree: true };
                const targetNode = document.getElementById("messages");

                if (targetNode) {
                    observer.observe(targetNode, config);
                }

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

                sendBtn.disabled = true;
                sendBtn.classList.remove("enabled");

                userInput.addEventListener("input", toggleSendButton);

                // Function to adjust the height of the textarea
                const adjustTextareaHeight = () => {
                    // Reset the height to auto to calculate the scrollHeight correctly
                    userInput.style.height = 'auto';

                    // Get the computed line-height (in pixels)
                    const lineHeight = parseFloat(getComputedStyle(userInput).lineHeight);

                    // Calculate the maximum height (e.g., 5 lines)
                    //const maxHeight = lineHeight * 10;
                    const maxHeight = 300; //px

                    // Calculate the new height: the smaller of scrollHeight and maxHeight
                    const newHeight = Math.min(userInput.scrollHeight, maxHeight);

                    // Apply the new height
                    userInput.style.height = `${newHeight}px`;

                    // Toggle the scrollbar based on content height
                    if (userInput.scrollHeight > maxHeight) {
                        userInput.style.overflowY = 'auto';
                    } else {
                        userInput.style.overflowY = 'hidden';
                    }
                };

                userInput.addEventListener("input", adjustTextareaHeight);

                userInput.addEventListener("keydown", (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Megakadályozza az alapértelmezett viselkedést (küldés)
                        const { selectionStart, selectionEnd, value } = userInput;
                        // Beszúrja a sortörést a jelenlegi pozícióba
                        userInput.value = value.slice(0, selectionStart) + "\n" + value.slice(selectionEnd);
                        // Mozgatja a kurzort a sortörés utáni pozícióba
                        userInput.selectionStart = userInput.selectionEnd = selectionStart + 1;
                        adjustTextareaHeight();
                    }
                });

                // Küldés gomb eseménykezelő (példa)
                sendBtn.addEventListener("click", () => {
                    if (!sendBtn.disabled) {
                        sendMessage();
                        toggleSaveButton();
                        toggleSendButton();
                        toggleUpdateButton();
                        userInput.value = ""; // Törli az input mezőt
                        adjustTextareaHeight();
                        reattachEventListeners();
                        switchTab(currentTabId);
                    }
                    reattachEventListeners();
                    switchTab(currentTabId);                    
                });

                // Initialize the height on page load
                window.addEventListener('load', adjustTextareaHeight);

                // Bind the adjustTextareaHeight function to the input event
                userInput.addEventListener('input', adjustTextareaHeight);

                document.getElementById("aiConfigContent").style.display = "block";
                toggleAIConfig();
                document.getElementById('initialPrompt').value = session.selectedInitialPrompt || initialPromptOnLoad;
                const tabList = document.getElementById('tabList');
                const contextMenu = document.getElementById('contextMenu');
                let currentTabForRename = null;
                const originalTabNames = {};

                let touchStartX = 0;
                let touchStartY = 0;
                let isDragging = false;
                let touchStartTime = 0;
                let dragTimer;
                let renameTimer;
                const dragDuration = 500;
                const renameDuration = 1500;

                const sortable = new Sortable(tabList, {
                    animation: 150,
                    onStart: function (evt) {
                        isDragging = true;
                    },
                    onEnd: function (evt) {
                        isDragging = false;
                        const reorderedTabs = [...tabList.children].map((li, index) => {
                            const tabId = li.querySelector('a').getAttribute('data-tab');
                            sessions[tabId].tabOrder = index;
                            return tabId;
                        });

                        localStorage.setItem("tabOrder", JSON.stringify(reorderedTabs));
                        saveChatToLocalStorage();
                        //saveChatToGoogleDrive();
                    }
                });

                if ('ontouchstart' in window || navigator.maxTouchPoints) {
                    sortable.option("disabled", true);
                }

                tabList.addEventListener('touchstart', (event) => {
                    if (event.target.tagName === 'A') {
                        isDragging = false;
                        touchStartTime = Date.now();
                        touchStartX = event.touches[0].clientX;
                        touchStartY = event.touches[0].clientY;


                        dragTimer = setTimeout(() => {
                            sortable.option("disabled", false);
                            isDragging = true;
                        }, dragDuration);

                        renameTimer = setTimeout(() => {
                            isDragging = false;
                            sortable.option("disabled", true);
                            currentTabForRename = event.target;
                            contextMenu.style.left = `${event.touches[0].pageX}px`;
                            contextMenu.style.top = `${event.touches[0].pageY}px`;
                            contextMenu.style.display = 'block';
                        }, renameDuration);
                    }
                }, { passive: true });

                tabList.addEventListener('touchmove', (event) => {
                    const deltaX = Math.abs(event.touches[0].clientX - touchStartX);
                    const deltaY = Math.abs(event.touches[0].clientY - touchStartY);

                    if (deltaX > 10 || deltaY > 10) {
                        clearTimeout(dragTimer);
                        clearTimeout(renameTimer);
                        isDragging = false;
                    }
                }, { passive: true });

                tabList.addEventListener('touchend', (event) => {
                    clearTimeout(dragTimer);
                    clearTimeout(renameTimer);
                    sortable.option("disabled", true);

                    if (isDragging) {
                        // Ha húzás történik, ne csináljunk semmit
                    } else {
                        const tabLink = event.target.closest('a');
                        const closeBtn = event.target.closest('.close-tab');

                        if (closeBtn) {
                            const tabId = closeBtn.getAttribute('data-tab');

                            if (!closedTabsCooldown.has(tabId)) {
                                closeTab(tabId);
                                closedTabsCooldown.add(tabId);
                                setTimeout(() => {
                                    closedTabsCooldown.delete(tabId);
                                }, 1100);
                            }

                        } else if (tabLink) {
                            const tabId = tabLink.getAttribute('data-tab');
                            if (tabId) {
                                switchTab(tabId);                                
                            } else {
                                console.warn("No tabId found on tab link.");
                            }
                        }
                    }
                    isDragging = false;
                }, { passive: true });



                tabList.addEventListener('mousedown', (event) => {
                    sortable.option("disabled", false);
                    isDragging = false;
                });

                tabList.addEventListener('contextmenu', (event) => {
                    event.preventDefault();

                    if (event.target.tagName === 'A') {
                        currentTabForRename = event.target;
                        contextMenu.style.left = `${event.pageX}px`;
                        contextMenu.style.top = `${event.pageY}px`;
                        contextMenu.style.display = 'block';
                    }
                });

                document.addEventListener('click', () => {
                    contextMenu.style.display = 'none';
                });

/*                 document.getElementById("cloudSyncBtn").addEventListener("click", () => {
                    // Indítsd el a szinkronizációt
                    initiateCloudSync();
                });    */             
                

                document.getElementById("messages").addEventListener('click', function (event) {
                    const target = event.target;

                    if (target.classList.contains('copy-icon')) {
                        const messageElement = target.closest('.message');
                        const textToCopy = messageElement.querySelector('.content').innerText;
                        copyToClipboard(textToCopy);
                    } else if (target.classList.contains('speaker-icon')) {
                        const messageElement = target.closest('.message');
                        const messageContent = messageElement.querySelector('.content').innerText;
                        speakMessage(messageContent, target);
                    } else if (target.id && target.id.endsWith('-legend') && target.id.startsWith('perplexity-')) {
                        // Handle click on Perplexity legend
                        const perplexityId = target.id.replace('-legend', '');
                        const messageElement = target.closest('.message');

                        if (messageElement) {
                            // Find the assistant message that follows the legend
                            let assistantMessageElement = messageElement.nextElementSibling;
                            while (assistantMessageElement && !assistantMessageElement.classList.contains('perplexity')) {
                                assistantMessageElement = assistantMessageElement.nextElementSibling;
                            }

                            if (assistantMessageElement) {
                                reattachEventListeners();
                                if (assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '') {
                                    assistantMessageElement.style.display = 'block';
                                    target.innerHTML = '🔼 Perplexity AI Response 🔼';
                                } else {
                                    assistantMessageElement.style.display = 'none';
                                    target.innerHTML = '🔽 Perplexity AI Response 🔽';
                                }
                            }
                        }
                    } else if (target.id.startsWith('bing-')) {
                        // Handle Bing legend click
                        reattachEventListeners();
                        const bingId = target.id.replace('-legend', '');
                        const contentDiv = document.getElementById(`${bingId}-content`);
                        if (contentDiv) {
                            if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
                                contentDiv.style.display = 'block';
                                target.innerHTML = '🔼 Bing Results 🔼';
                            } else {
                                contentDiv.style.display = 'none';
                                target.innerHTML = '🔽 Bing Results 🔽';
                            }
                        }
                    } else if (target.id.startsWith('google-')) {
                        // Handle Google legend click
                        reattachEventListeners();
                        const googleId = target.id.replace('-legend', '');
                        const contentDiv = document.getElementById(`${googleId}-content`);
                        if (contentDiv) {
                            if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
                                contentDiv.style.display = 'block';
                                target.innerHTML = '🔼 Google Results 🔼';
                            } else {
                                contentDiv.style.display = 'none';
                                target.innerHTML = '🔽 Google Results 🔽';
                            }
                        }
                    }
                });



                document.getElementById('renameTab').addEventListener('click', () => {
                    if (currentTabForRename) {
                        const tabId = currentTabForRename.getAttribute('data-tab');
                        const currentName = originalTabNames[tabId] || currentTabForRename.textContent.trim();
                        const newTabName = prompt("Enter new tab name:", currentName);

                        if (newTabName) {
                            const displayTabName = newTabName.length > 8 ? newTabName.substring(0, 7) + '…' : newTabName;
                            currentTabForRename.textContent = displayTabName;

                            originalTabNames[tabId] = newTabName;

                            
                            if (sessions[tabId]) {
                                sessions[tabId].tabName = displayTabName;
                                localStorage.setItem("chatSessions", JSON.stringify(sessions));
                            }
                        }
                    }
                    contextMenu.style.display = 'none';
                });

                document.getElementById("lockTab").addEventListener("click", () => {
                    if (currentTabForRename) {
                        const tabId = currentTabForRename.getAttribute("data-tab");
                        if (lockedTabs[tabId]) {
                            delete lockedTabs[tabId];
                        } else {
                            lockedTabs[tabId] = true;
                        }
                        localStorage.setItem("lockedTabs", JSON.stringify(lockedTabs));
                        updateTabLockStatus();
                    }
                    contextMenu.style.display = "none";
                });

                tabList.addEventListener('contextmenu', (event) => {
                    if (event.target.tagName === 'A') {
                        currentTabForRename = event.target;
                        const tabId = currentTabForRename.getAttribute("data-tab");

                        document.getElementById("lockTab").textContent = lockedTabs[tabId] ? "🔓 Unlock Tab" : "🔒 Lock Tab";

                        const closeTabOption = document.getElementById("closeTab");
                        if (lockedTabs[tabId]) {
                            closeTabOption.style.color = "gray";
                            closeTabOption.style.pointerEvents = "none";
                        } else {
                            closeTabOption.style.color = "";
                            closeTabOption.style.pointerEvents = "auto";
                        }
                    }
                });

                document.querySelectorAll(".close-tab").forEach(closeBtn => {
                    closeBtn.addEventListener("click", (event) => {
                        const tabId = event.target.getAttribute("data-tab");
                        if (lockedTabs[tabId]) {
                            event.preventDefault();
                        }
                    });
                });

                document.getElementById('closeTab').addEventListener('click', () => {
                    if (currentTabForRename) {
                        const tabId = currentTabForRename.getAttribute('data-tab');
                        closeTab(tabId);
                    }
                    contextMenu.style.display = 'none';
                });

                async function updateLocation() {
                    userLocation = `\nLatitude: ${latitude}, Longitude: ${longitude}`;
                    session.userLocation = userLocation;
                    const locationData = await getGeocodedAddress(latitude, longitude);

                    userLocationCountry = locationData.country;
                    userLocationCity = locationData.city;
                    userLocationPostcode = locationData.postcode;
                    userLocationRegion = locationData.region;
                    userLocationCountryCode = locationData.country_code;
                    userLocationRoad = locationData.road;
                    userLocationHouseNumber = locationData.house_number;
                    userLocationCityDistrict = locationData.city_district;
                    userLocationBorough = locationData.borough;
                    userLocationSuburb = locationData.suburb;
                    userLocationNeighbourhood = locationData.neighbourhood;
                    userLocationMunicipality = locationData.municipality;
                    userLocationCounty = locationData.county;

                    userLocationText = [
                        userLocationCountry,
                        userLocationCounty,
                        userLocationMunicipality,
                        userLocationCity,
                        userLocationCityDistrict,
                        userLocationBorough,
                        userLocationPostcode,
                        userLocationNeighbourhood,
                        userLocationSuburb,
                        userLocationRoad,
                        userLocationHouseNumber
                    ].filter(item => item && !item.includes("Unknown")).join(" ");

                    locationLatLon = userLocationText !== "" ? userLocationText : `Latitude: ${latitude}, Longitude: ${longitude}`;

                    if (!session.previousLocationLatLon || session.previousLocationLatLon === "") {
                        displayMessage(`🗺️ Your location: ${locationLatLon}`, "system");
                    } else if (locationLatLon !== session.previousLocationLatLon) {
                        displayMessage(`🗺️ Location has been updated: ${locationLatLon}`, "system");
                    }
                    session.previousLocationLatLon = locationLatLon;                    

                    locationDisplay = userLocationCity !== "Unknown" ? userLocationCity : `Latitude: ${latitude}, Longitude: ${longitude}`;
                    const weatherData = await fetchWeatherData(latitude, longitude);
                    const weatherDataString = JSON.stringify(weatherData);

                    if (!session.previousWeatherDataString || session.previousWeatherDataString === "" || metarDataRaw === "Location sharing disabled - Location based weather data is notavailable") {
                        displayMessage(`🌤️ Weather has been loaded (${locationDisplay})`, "system");
                        metarDataRaw = "\nCurrent Weather Data at User Location: " + weatherData;
                    } else if (weatherDataString !== session.previousWeatherDataString) {
                        displayMessage(`🌤️ Weather has been updated (${locationDisplay})`, "system");
                        metarDataRaw = "\nCurrent Weather Data at User Location: " + weatherData;
                    } else if (!weatherData) {
                        metarDataRaw = "\nFailed to fetch weather data";
                    }
                    session.previousWeatherDataString = weatherDataString;   
                    saveChatToLocalStorage();     
                    //saveChatToGoogleDrive();            

                    locationCache = {
                        timestamp: new Date().getTime(),
                        latitude: latitude,
                        longitude: longitude,
                        userLocation: userLocation,
                        userLocationText: userLocationText,
                        userLocationTextMsg: userLocationTextMsg,
                        userLocationCountry: userLocationCountry,
                        userLocationCity: userLocationCity,
                        userLocationPostcode: userLocationPostcode,
                        userLocationRegion: userLocationRegion,
                        userLocationCountryCode: userLocationCountryCode,
                        userLocationRoad: userLocationRoad,
                        userLocationHouseNumber: userLocationHouseNumber,
                        userLocationCityDistrict: userLocationCityDistrict,
                        userLocationBorough: userLocationBorough,
                        userLocationSuburb: userLocationSuburb,
                        userLocationNeighbourhood: userLocationNeighbourhood,
                        userLocationMunicipality: userLocationMunicipality,
                        userLocationCounty: userLocationCounty,
                        weatherData: weatherData,
                        bingSearchResults: bingSearchResults,
                        locationNews: locationNews
                    };
                }

                let locationCache = {
                    timestamp: null,
                    latitude: null,
                    longitude: null,
                    userLocation: null,
                    userLocationCountry: null,
                    userLocationCity: null,
                    userLocationPostcode: null,
                    userLocationRegion: null,
                    userLocationCountryCode: null,
                    userLocationRoad: null,
                    userLocationHouseNumber: null,
                    userLocationCityDistrict: null,
                    userLocationBorough: null,
                    userLocationNeighbourhood: null,
                    userLocationMunicipality: null,
                    userLocationCounty: null,
                    userLocationSuburb: null,
                    userLocationText: null,
                    userLocationTextMsg: null,
                    bingSearchResults: null,
                    locationNews: null,
                    weatherData: null
                };

                document.getElementById("bingToggle").addEventListener("change", async () => {
                    if (document.getElementById("bingToggle").checked && document.getElementById("locationToggle").checked) {
                        await checkForPositionChange();
                    }
                });

                document.getElementById('locationToggle').addEventListener('change', async (event) => {
                    if (!event.isTrusted) {
                        return; // Ignore programmatic changes
                    }
                    const locationEnabled = event.target.checked;
                    localStorage.setItem('locationEnabled', locationEnabled);
                    if (locationEnabled) {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(async (position) => {
                                latitude = position.coords.latitude;
                                longitude = position.coords.longitude;
                                displayMessage("🌍 Location sharing enabled", "system");
                                await logToFile(`🌍 Location sharing enabled`);
                                await updateLocation();                                
                                locationRefreshInterval = setInterval(() => {
                                    checkForPositionChange();
                                }, refreshIntervalMinutes * 60 * 1000);

                            }, (error) => {
                                displayMessage("❌ Unable to retrieve location", "system");
                            });
                        } else {
                            displayMessage("❌ Geolocation not supported", "system");
                        }
                    } else {
                        clearInterval(locationRefreshInterval);
                        resetLocationData();
                        session.userLocation = "\nLocation sharing disabled";
                        displayMessage("🌍 Location sharing disabled", "system");
                        logToFile(`🌍 Location sharing disabled`);
                        
                    }
                });

                await saveChatToLocalStorage();
                //await saveChatToGoogleDrive();

                if (currentTabId) {
                    
                    await reattachEventListeners();
                    await updateTabsFromSessions();
                    await updateActiveTab();
                    await updateTabLockStatus();
                    if (locationStatus === true) {                        
                        await checkForPositionChange();
                    }
                    await switchTab(currentTabId);
                    await restoreTabOrder();                    
                }



                function checkForPositionChange() {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(async (newPosition) => {
                            const newLatitude = newPosition.coords.latitude;
                            const newLongitude = newPosition.coords.longitude;

                            const isPositionSignificantlyDifferent = Math.abs(newLatitude - latitude) > positionThreshold || Math.abs(newLongitude - longitude) > positionThreshold;

                            if (isPositionSignificantlyDifferent) {
                                latitude = newLatitude;
                                longitude = newLongitude;
                                await updateLocation();
                                localStorage.setItem("userLocation", userLocation || "\nLocation sharing disabled"); 
                                session.userLocation = userLocation || "\nLocation sharing disabled";
                            } else {
                                localStorage.setItem("userLocation", userLocation || "\nLocation sharing disabled"); 
                                session.userLocation = userLocation || "\nLocation sharing disabled";
                            }
                        }, (error) => {
                            console.error("Error retrieving new position for comparison:", error);
                        });
                    }
                }

                function resetLocationData() {
                    latitude = "";
                    longitude = "";
                    userLocation = "Location sharing disabled - User coordinates are not available";
                    userLocationText = "Location sharing disabled - Location based address is not available";
                    userLocationCity = "";
                    userLocationCountry = "";
                    userLocationTextMsg = "";
                    userLocationPostcode = "";
                    userLocationRegion = "";
                    userLocationCountryCode = "";
                    userLocationRoad = "";
                    userLocationHouseNumber = "";
                    userLocationCityDistrict = "";
                    userLocationMunicipality = "";
                    userLocationBorough = "";
                    userLocationSuburb = "";
                    userLocationNeighbourhood = "";
                    userLocationCounty = "";
                    weatherData = "";
                    metarDataRaw = "Location sharing disabled - Location based weather data is notavailable";
                    previousWeatherDataString = "";
                    previousLocationLatLon = "";
                    locationDisplay = "";
                    weatherDataString = "";
                    locationLatLon = "";
                }

                document.getElementById('bingToggle').addEventListener('change', async (event) => {
                    if (!event.isTrusted) {
                        return; // Ignore programmatic changes
                    }
                    bingSearchEnabled = event.target.checked;
                    localStorage.setItem('bingSearchEnabled', bingSearchEnabled);
                    if (bingSearchEnabled) {
                        displayMessage("🔎 Bing Search enabled", "system");
                        logToFile(`🔎 Bing Search enabled`);
                    } else {
                        locationNews = "";
                        bingSearchResults = "";
                        displayMessage("🔎 Bing Search disabled", "system");
                        logToFile(`🔎 Bing Search disabled`);
                    }
                });

                document.getElementById('googleToggle').addEventListener('change', async (event) => {
                    if (!event.isTrusted) {
                        return; // Ignore programmatic changes
                    }
                    googleSearchEnabled = event.target.checked;
                    localStorage.setItem('googleSearchEnabled', googleSearchEnabled);
                    if (googleSearchEnabled) {
                        displayMessage("🔎 Google Search enabled", "system");
                        logToFile(`🔎 Google Search enabled`);
                    } else {
                        locationNews = "";
                        googleSearchResults = "";
                        displayMessage("🔎 Google Search disabled", "system");
                        logToFile(`🔎 Google Search disabled`);
                    }
                });

                document.getElementById('perplexityToggle').addEventListener('change', async (event) => {
                    if (!event.isTrusted) {
                        return; // Ignore programmatic changes
                    }
                    perplexitySearchEnabled = event.target.checked;
                    localStorage.setItem('perplexitySearchEnabled', perplexitySearchEnabled);
                    if (perplexitySearchEnabled) {
                        displayMessage("🔎 Perplexity Search enabled", "system");
                        logToFile(`🔎 Perplexity Search enabled`);
                    } else {
                        perplexitySearchResults = null;
                        displayMessage("🔎 Perplexity Search disabled", "system");
                        logToFile(`🔎 Perplexity Search disabled`);
                    }
                });

                async function fetchWeatherData(latitude, longitude) {
                    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=&timezone=auto`);

                    if (response.ok) {
                        const data = await response.json();
                        const currentWeather = data.current;
                        //console.log(data.current);

                        const temperature = Math.round(currentWeather.temperature_2m);
                        const apparentTemperature = Math.round(currentWeather.apparent_temperature);
                        const relativeHumidity = currentWeather.relative_humidity_2m;

                        const isDay = currentWeather.is_day;
                        const precipitation = currentWeather.precipitation;
                        const rain = currentWeather.rain;
                        const showers = currentWeather.showers;
                        const snowfall = currentWeather.snowfall;
                        const weatherCode = currentWeather.weather_code;
                        const pressureMsl = currentWeather.pressure_msl;
                        const surfacePressure = currentWeather.surface_pressure;
                        const cloudCover = currentWeather.cloud_cover;
                        const windSpeed10m = currentWeather.wind_speed_10m;
                        const windDirection10m = currentWeather.wind_direction_10m;
                        const windGusts10m = currentWeather.wind_gusts_10m;

                        const weatherCodeDescription = getWeatherDescription(weatherCode);

                        return `        
                    Temperature: ${temperature}°C
                    Relative Humidity: ${relativeHumidity ? relativeHumidity + '%' : 'N/A'}
                    Apparent Temperature: ${apparentTemperature}°C
                    Is Day: ${isDay ? 'Yes' : 'No'}
                    Precipitation: ${precipitation ? precipitation + ' mm' : 'N/A'}
                    Rain: ${rain ? rain + ' mm' : 'N/A'}
                    Showers: ${showers ? showers + ' mm' : 'N/A'}
                    Snowfall: ${snowfall ? snowfall + ' mm' : 'N/A'}
                    Weather: ${weatherCodeDescription}
                    Pressure (MSL): ${pressureMsl} hPa
                    Surface Pressure: ${surfacePressure ? surfacePressure + ' hPa' : 'N/A'}
                    Cloud Cover: ${cloudCover ? cloudCover + '%' : 'N/A'}
                    Wind Speed at 10m: ${windSpeed10m} m/s
                    Wind Direction at 10m: ${windDirection10m}°
                    Wind Gusts at 10m: ${windGusts10m ? windGusts10m + ' m/s' : 'N/A'}
                    `;
                    } else {
                        console.error("Error fetching weather data");
                        return null;
                    }
                }

                function getWeatherDescription(weatherCode) {
                    const weatherDescriptions = {
                        0: "Clear sky",
                        1: "Mainly clear",
                        2: "Partly cloudy",
                        3: "Overcast",
                        45: "Fog",
                        48: "Depositing rime fog",
                        51: "Light drizzle",
                        53: "Moderate drizzle",
                        55: "Dense drizzle",
                        56: "Light freezing drizzle",
                        57: "Dense freezing drizzle",
                        61: "Slight rain",
                        63: "Moderate rain",
                        65: "Heavy rain",
                        66: "Light freezing rain",
                        67: "Heavy freezing rain",
                        71: "Slight snow fall",
                        73: "Moderate snow fall",
                        75: "Heavy snow fall",
                        77: "Snow grains",
                        80: "Slight rain showers",
                        81: "Moderate rain showers",
                        82: "Violent rain showers",
                        85: "Slight snow showers",
                        86: "Heavy snow showers",
                        95: "Thunderstorm",
                        96: "Thunderstorm with slight hail",
                        99: "Thunderstorm with heavy hail"
                    };

                    return weatherDescriptions[weatherCode] || "Unknown weather condition";
                }

                document.getElementById("loadChatBtn").addEventListener("click", async () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.html';

                    input.onchange = async (event) => {
                        const file = event.target.files[0];
                        if (file) {
                            const content = await file.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(content, 'text/html');
                            const messagesContainer = doc.getElementById("messages");
                            const initialPromptContainer = doc.getElementById("initialPrompt");

                            if (!messagesContainer) {
                                displayMessage('⚠️ Invalid file format. Please upload a valid chat log.', 'system');
                                return;
                            }

                            const localMessagesContainer = document.getElementById("messages");
                            localMessagesContainer.innerHTML = '';
                            conversationHistory = [];
                            if (initialPromptContent) {
                                const systemMessage = `${initialPromptContent}`;
                                conversationHistory.push({ role: "system", content: systemMessage });
                            }

                            Array.from(messagesContainer.children).forEach(msg => {
                                localMessagesContainer.appendChild(msg.cloneNode(true));
                                const role = msg.classList.contains('user') ? 'user' : 'assistant';
                                conversationHistory.push({ role, content: msg.querySelector('.content').innerText });
                            });
                            reattachEventListeners();
                            displayMessage('📂 Chat loaded successfully', 'system');
                            toggleSaveButton();
                            toggleUpdateButton();
                            saveChatToLocalStorage();
                            //saveChatToGoogleDrive();
                        }
                    };

                    input.click();
                });

                document.getElementById("saveChatBtn").addEventListener("click", () => {
                    displayMessage('💾 Chat exported successfully', 'system');
                    const messagesContainer = document.getElementById("messages");
                    const messages = messagesContainer.innerHTML;

                    const htmlTemplate = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <meta property="og:type" content="website" />
                        <meta property="og:title" content="HungaryVFR - The Microsoft Flight Simulator 2020 Scenery" />
                        <meta property="og:description" content="HungaryVFR CoPilot is a web-based assistant specializing in aviation and flight simulation. Although it shares its knowledge base with the HungaryVFR CoPilot Discord bot, it functions separately and offers details on Discord commands without executing them. Get expert support and real-time assistance with your aviation questions. Founded by ekre (Gergely Debreceni)" />            
                        <meta property="og:url" content="https://www.hungaryvfr.hu/" />
                        <meta property="og:site_name" content="HungaryVFR" />
                        <meta property="og:image" content="https://hungaryvfr.hu/images/thumbnail.jpg" />
                        <meta property="og:image:secure_url" content="https://hungaryvfr.hu/images/thumbnail.jpg" />
                        <title>HungaryVFR CoPilot - Saved Chat</title>
                        <link rel="icon" type="image/x-icon" href="https://www.hungaryvfr.hu/images/favicon.ico">
                        <style>
        :root {
            --primary-color: #007bff;
            --secondary-color: #28a745;
            --background-color: #f8f9fa;
            --border-color: #dee2e6;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            margin: 0;
            padding: 20px;
            background-color: var(--background-color);
            min-width: 364px;
            min-height: 335px;
            /* touch-action: pan-x pan-y; */
            overscroll-behavior: none;
            height: calc(95vh);
        }

        header img {
            width: 100px;
            height: auto;
            vertical-align: middle;
            margin-right: 5px;
        }

/*         #chat {
            display: flex;
            flex-direction: column;
            max-width: auto;
            height: calc(95vh);
            margin: 0px;
            padding: 0px;
        } */

        #header {
            display: flex;
            justify-content: space-between; /* Align left and right sections */
            align-items: center; /* Vertically center the content */
            flex-wrap: wrap;
        }

        /* Style the left side of the header */
        .header-left {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            flex-direction: row;            
        }

        /* Optional: Add spacing between the logo and the text */
        .header-left img {
            margin-right: 10px;
        }

        /* Style the right side of the header */
        .header-right {
            display: flex;
            flex-wrap: wrap;
            flex-direction: row-reverse;
        }

        /* Optional: Add spacing between the icons */
        .header-right .tour-icon,
        .header-right .maininfo-icon {
            margin-left: 10px;
            cursor: pointer; /* Indicate that the icons are clickable */
        }

        #chat {
            display: flex;
            flex-direction: column;
            width: 100%; /* Ensures full width */
            max-width: 100%; /* Prevents exceeding the viewport */
            height: calc(95vh);
            max-height: calc(95vh);
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            overflow: hidden; /* Prevents children from overflowing */
        }        

/*         main {
            flex: 1;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            flex-shrink: 1;
            margin-top: 10px;
        } */

        main {
            flex: 1;
            display: flex;
            flex-direction: column;
            margin-top: 0px;
            box-sizing: border-box;
            overflow: hidden; /* Prevents children from overflowing */
        }        

/*         #chatContainer {            
            width: 90%;           
            max-width: 90%; 
            margin: 0 auto; 
            padding: 20px;
            box-sizing: border-box;
        }    */    
            
        #chatContainer {
            width: 100%;
            max-width: 100%; /* Ensures it doesn't exceed parent width */
            margin: 0 0;
            padding: 8px 8px; 
            box-sizing: border-box;
            overflow: hidden; /* Prevents children from overflowing */
            min-height: 50px;
        }      


        #userInput {
            width: 100%; /* Maintains existing width */
            max-width: 100%; /* Prevents exceeding the parent container's width */
            resize: vertical; /* Allows only vertical resizing */
            min-height: 35px; /* Maintains existing minimum height */
            max-height: 300px; /* Maintains existing maximum height */
            overflow-y: auto; /* Enables vertical scrolling if content exceeds max-height */
            padding: 8px;
            box-sizing: border-box;
            font-size: 14px;
            line-height: 1.2;
            border: 1px solid #ccc; 
            border-radius: 4px;
            transition: max-height 0.2s ease;
            overscroll-behavior: contain;
        }

        /* Optional: Smooth transition for height changes */
        textarea {
            transition: height 0.2s ease;
        }        

        @media (max-width: 600px) {
            #userInput {
                width: 100%;
                max-width: 100%;
                resize: vertical;
                padding: 12px;
            }
        }      
        
        fieldset {
            display: block;
            min-inline-size: min-content;
            margin-inline: 2px;
            margin-top: 5px;
            border-width: 2px;
            border-style: none;
            border-color: threedface;
            border-image: initial;
            padding-block: 0.35em 0.625em;
            padding-inline: 0.75em;
            border-radius: 3px;
            box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 1px 3px 1px;
            transition: transform 1s ease; /* Add transition for a smooth effect */        
        }        

        #messages {
            border: 1px solid var(--border-color);
            padding: 10px;
            min-height: 150px;
            flex-basis: 150px;
            flex-grow: 1;
            flex-shrink: 1;
            overflow-y: auto;
            margin-bottom: 0px;
            background-color: white;
            overflow-x: hidden;
            transition: height 0.1s ease;
            overscroll-behavior: contain;
            border-radius: 5px;
        }

        /* Webkit-alapú böngészők: Chrome, Safari, Edge */
        #messages::-webkit-scrollbar {
            width: 10px; /* Görgetősáv szélessége */
        }

        #messages::-webkit-scrollbar-track {
            background: #f0f4f8; /* Görgetősáv háttérszíne */
        }

        #messages::-webkit-scrollbar-thumb {
            background-color: #afafaf; /* Görgetősáv színe */
            border-radius: 5px; /* Görgetősáv lekerekítése */
            border: 2px solid #f0f4f8; /* Szegély a scrollbar körül */
        }

        #messages::-webkit-scrollbar-thumb:hover {
            background-color: #aaaaaa; /* Hover szín */
        }

        /* Firefox esetén */
        #messages {
            scrollbar-width: thin; /* Görgetősáv szélessége */
            scrollbar-color: #afafaf #f0f4f8; /* Görgetősáv színe és háttérszíne */
        }        

        .message {
            position: relative;
            margin: 5px 0;
            padding: 10px;
            border-radius: 10px;
            max-width: 100%;
            overflow: auto; /* Támogatja a mindkét irányú görgetést, ha szükséges */
            scrollbar-width: thin; 
            scrollbar-color: auto;           
        }
        
        .message::-webkit-scrollbar {
            width: 6px;  /* Vertikális görgetősáv szélessége */
            height: 6px; /* Horizontális görgetősáv magassága */
        }
        
        .message::-webkit-scrollbar-track {
            background: #f0f4f8;
            border-radius: 10px;
        }
        
        .message::-webkit-scrollbar-thumb {
            border-radius: 10px; 
            border: 2px solid #f1f1f1;
            background: rgba(0, 0, 0, 0.2); /* Görgetősáv színe */
        }
        
        .message::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.4); /* Hover állapot */
        }
        
        .message::-webkit-scrollbar-corner {
            background: transparent; /* A sarokban lévő kis négyzet átlátszó marad */
        } 

        .assistant .content::-webkit-scrollbar {
            width: 10px; /* Görgetősáv szélessége */
        }

        .assistant .content::-webkit-scrollbar-track {
            background: #f0f4f8; /* Görgetősáv háttérszíne */
        }

        .assistant .content::-webkit-scrollbar-thumb {
            background-color: #afafaf; /* Görgetősáv színe */
            border-radius: 5px; /* Görgetősáv lekerekítése */
            border: 2px solid #f0f4f8; /* Szegély a scrollbar körül */
        }

        .assistant .content::-webkit-scrollbar-thumb:hover {
            background-color: #aaaaaa; /* Hover szín */
        }

        /* Firefox esetén */
        .assistant .content {
            scrollbar-width: thin; /* Görgetősáv szélessége */
            scrollbar-color: #afafaf #f0f4f8; /* Görgetősáv színe és háttérszíne */
        } 

        .user {
            background-color: var(--primary-color);
            color: white;
            box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px;
        }

        .assistant {
            background-color: var(--secondary-color);
            color: white;
            box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px;
        }

        .timestamp {
            font-size: 9px;
            position: absolute;
            bottom: 5px;
            right: 10px;
            text-align: right;
        }

        .speaker-icon {
            display: flex;
            left: 25px;
            bottom: 5px;
            cursor: pointer;
        }

        .copy-icon {
            display: flex;
            left: 5px;
            bottom: 0px;
            cursor: pointer;
        }

        .play-pause-stop-container {
            display: flex;
            align-items: left;
            margin-left: 0px;
            position: absolute;
            bottom: -5px;
            left: -5px;
        }

        .play-pause-button,
        .stop-button {
            font-size: 18px;
            margin: 5px;
            cursor: pointer;
            padding: 0px;
        }

        .play-pause-button:hover,
        .stop-button:hover {
            opacity: 0.7;
        }


        .assistant .content {
            /* white-space: pre-wrap; */
            word-wrap: break-word;
            overflow-x: auto;
            background-color: var(--secondary-color);
            padding: 2px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            line-height: 1.2;
            margin: 0;
        }

        .message {
            margin: 5px;
            padding: 5px 15px;
            border-radius: 10px;
            max-width: 100%;
            overflow-x: auto;
            line-height: 1.2;
        }

        .message p {
            margin: 0;
            line-height: 1.2;
        }

        .message h {
            margin: 0;
            line-height: 1.2;
        }

        .message ul,
        .message ol {
            margin: 0;
            padding-left: 20px;
        }

        .message li {
            margin-bottom: 0.5em;
        }

        .assistant .content h1,
        .assistant .content h2,
        .assistant .content h3,
        .assistant .content h4,
        .assistant .content h5,
        .assistant .content h6 {
            margin-top: 1px;
            margin-bottom: 1px;
            font-weight: bold;
            color: var(--heading-color, white);
            line-height: 1.2;
        }

        .assistant .content h1 {
            font-size: 1.4em;
        }

        .assistant .content h2 {
            font-size: 1.4em;
        }

        .assistant .content h3 {
            font-size: 1.2em;
        }

        .assistant .content h4 {
            font-size: 1.2em;
        }

        .assistant .content h5 {
            font-size: 1.0em;
        }

        .assistant .content h6 {
            font-size: 0.8em;
        }

        .assistant .content ul,
        .assistant .content ol {
            margin: 10px;
            padding-left: 10px;
            /* list-style-position: inside; */
        }

        .assistant .content li {
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }

        .assistant .content p {
            margin: 0px 0px 15px 0px;
            padding: 0;
            line-height: 1.2;
        }

        .user .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-x: auto;
            background-color: var(--primary-color);
            padding: 2px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            line-height: 1.2;
            margin: 0px;
        }

        .user .content h1,
        .user .content h2,
        .user .content h3,
        .user .content h4,
        .user .content h5,
        .user .content h6 {
            margin-top: 0px;
            margin-bottom: 0px;
            font-weight: bold;
            color: var(--heading-color, white);
            line-height: 1.2;
        }

        .user .content h1 {
            font-size: 1.8em;
        }

        .user .content h2 {
            font-size: 1.6em;
        }

        .user .content h3 {
            font-size: 1.4em;
        }

        .user .content h4 {
            font-size: 1.2em;
        }

        .user .content h5 {
            font-size: 1.0em;
        }

        .user .content h6 {
            font-size: 0.8em;
        }

        .user .content ul,
        .user .content ol {
            margin: 0;
            padding-left: 20px;
            list-style-position: inside;
        }

        .user .content li {
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }

        .user .content p {
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }

        .perplexity {
            background-color: #f0f0f0;
            color: #333;
            box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 2px 6px 2px;
        }        

        .perplexity .content {
            white-space: normal;
            word-wrap: break-word;
            overflow-x: auto;
            background-color: #f0f0f0; /* Válassz megfelelő háttérszínt */
            padding: 8px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            line-height: 1.2;
            margin: 0px;
            color: #333; /* Szöveg színe */
        }
        
        .perplexity .content h1,
        .perplexity .content h2,
        .perplexity .content h3,
        .perplexity .content h4,
        .perplexity .content h5,
        .perplexity .content h6 {
            margin-top: 10px;
            margin-bottom: 10px;
            font-weight: bold;
            color: #333;
            line-height: 1.2;
        }
        
        .perplexity .content ul,
        .perplexity .content ol {
            margin: 8px;
            margin-bottom: 10px;
            padding-left: 20px;
            /* list-style-position: inside; */
        }
        
        .perplexity .content li {
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }
        
        .perplexity .content p {
            margin: 0;
            padding: 0;
            line-height: 1.2;
        }        

        .system {
            color: gray;
            padding: 1px;
            border-radius: 0px;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.0;
            margin: 0;
        }

        .system .bing-keywords {
            font-size: 9px;
            padding-left: 0px;
            color: grey;
        }

        .system .google-keywords {
            font-size: 9px;
            padding-left: 0px;
            color: grey;
        }        

        textarea,        
        select {
            width: 100%;
            margin-bottom: 5px;
            padding: 5px;

        }

        
        button  {            
            margin-bottom: 5px;
            padding: 5px;

        }

        input {
            margin-bottom: 5px;
            padding: 5px;
        }

        button {
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 10px;
            cursor: pointer;
        }

        button:hover {
            opacity: 0.8;
        }

        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
        }

        #contextMenu li {
            padding: 5px 10px;
            cursor: pointer;
        }

        #contextMenu li:hover {
            background-color: #f0f0f0;
        }

        #buttonContainer {
            display: flex;
            flex-direction: row;
            flex-shrink: 1;
            width: 97%;
            gap: 5px;
            margin: 0px 0;
            user-select: none;
        }

        #buttonContainerSmall {
            display: flex;
            justify-content: space-between;
            width: 100%;
        }

        .buttonGroupLeft {
            display: flex;
            gap: 5px;
        }

        .buttonGroupRight {
            display: flex;
            gap: 5px;
        }

        #buttonContainerSmall>.buttonGroupLeft {
            margin-right: auto;
        }

        #buttonContainerSmall>.buttonGroupRight {
            margin-left: auto;
        }

        #buttonGroupSmall {
            display: flex;
            flex-direction: row;
            justify-content: flex-start;
            width: 35%;
            gap: 5px;
        }

        #setAndClearBtn,
        #setSessionBtn {
            border-radius: 8px;
            padding: 10px;
            font-size: 12px;
            background-color: #007bff;
            color: white;
            cursor: pointer;
            width: 80px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #loadChatBtn,
        #saveChatBtn,
        #cloudSyncBtn {
            border-radius: 8px;
            padding: 10px;
            font-size: 12px;
            background-color: #007bff;
            color: white;
            cursor: pointer;
            width: 40px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #sendBtn.enabled:active, 
        #setAndClearBtn:active,
        #setSessionBtn:active,
        #loadChatBtn:active,
        #saveChatBtn:active,
        #cloudSyncBtn:active,
        #removeFilesBtn:active,
        #loadTextFilesBtn:active,
        #captureImageBtn:active,
        #microphoneBtn:active,
        #addTabBtn:active,
        #tabList li:active {
            transform: scale(0.95); /* Scale down when the button is pressed */
        }  


        #setSessionBtn:disabled,
        #saveChatBtn:disabled {
            background-color: grey;
            color: #d3d3d3;
            cursor: not-allowed;
            transform: scale(1.00); /* Scale down when the button is pressed */
        }

        #loadChatBtn {
            background-color: #28a745;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #saveChatBtn {
            background-color: #28a745;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #sendBtnContainer {
            display: flex;
            justify-content: flex-end;
            width: 100%;
            margin-top: 0px;            
        }

        #sendBtn {
            border-radius: 8px;
            padding: 10px;
            border: none;
            cursor: not-allowed;
            background-color: grey;
            color: #d3d3d3;
            width: auto;
            flex-grow: 1;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
           /*  transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }
        
        #microphoneBtn {
            display: none;
            border-radius: 8px;
            padding: 10px;
            border: none;
            cursor: pointer;
            background-color: #28a745;
            color: #d3d3d3;
            width: auto;
            flex-grow: 1;
            margin-right: 25px;
            margin-left: 25px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #sendBtn.enabled {
            background-color: #28a745;
            color: white;
            cursor: pointer;
        }
    

        #removeFilesBtn,
        #loadTextFilesBtn {
            border-radius: 8px;
            padding: 0px;
            border: none;
            cursor: pointer;
            width: 40px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
           /*  transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #captureImageBtn {
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 0px;
            cursor: pointer;
            width: 40px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
          }
          
          #captureImageBtn:disabled {
            background-color: grey;
            color: #d3d3d3;
            cursor: not-allowed;
            transform: scale(1.00); /* Scale down when the button is pressed */
          }   

        #removeFilesBtn {
            background-color: #007bff;
            color: white;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #removeFilesBtn:disabled {
            background-color: grey;
            color: #d3d3d3;
            cursor: not-allowed;
            transform: scale(1.00); /* Scale down when the button is pressed */
        }

        #loadTextFilesBtn {
            background-color: #007bff;
            color: white;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }


        #loadTextFilesBtn:disabled {
            background-color: grey;
            color: #d3d3d3;
            cursor: not-allowed;
            transform: scale(1.00); /* Scale down when the button is pressed */
        }


        #customInitialPrompt::placeholder {
            font-size: 12px;
        }

        #customInitialPrompt {
            width: 98%;
        }

        #aiConfig {
            border: 0px solid var(--border-color);
            padding: 0px;
            background-color: var(--background-color);
            border-radius: 5px;
            margin-bottom: 5px;
            user-select: none;
            width: 99%;                
        }

        #aiConfig legend {
            cursor: pointer;
        }

        .disabled-cursor {
            cursor: not-allowed !important;
        }

        .avatar {
            margin-bottom: 2px;
        }

        #tabs {
            display: flex;
            align-items: left;
            justify-content: space-between;
            margin-bottom: 0px;
            overflow-x: auto;
            white-space: nowrap;
            /* min-height: 32px; */
            /* min-height: 55px; */
            min-height: auto;
            max-height: 60px;
            scrollbar-width: thin;
        }

        #tabList {
            display: flex;
           /*  align-items: center; */
            flex-direction: row;
            list-style-type: none;
            font-size: 12px;
            padding: 5px 5px;
            margin: 0;
            width: auto;
        }

        #tabList li {
            margin-right: 5px;
            width: 70px;
            position: relative;
            cursor: grab;
            user-select: none;
            border-radius: 5px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
        }

        #tabList li:active {
            cursor: grabbing;
        }

        #tabList li a {
            display: block;
            padding: 5px 5px;
            background-color: var(--primary-color);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            position: relative;
            width: 70px;
            text-align: left;
            box-sizing: border-box;
        }

        #tabList li.active a {
            background-color: var(--secondary-color);
            width: 70px;
        }

        .close-tab {
            position: absolute;
            right: 3px;
            top: 11px;
            transform: translateY(-50%);
            cursor: pointer;
            color: red;
            text-align: right;
            padding-left: 5px;
        }

        .close-tab:hover {
            color: darkred;
        }

        #addTabBtn {
            position: relative;
            padding: 5px 5px 5px 5px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: auto;
            margin-right: 5px;
            height: 30px;
            box-shadow: rgba(50, 50, 93, 0.25) 0px 2px 5px 1px, rgba(0, 0, 0, 0.3) 0px 1px 3px 0px;
            /* transition: transform 0.1s ease; */ /* Add transition for a smooth effect */
        }

        #addTabBtn:hover {
            background-color: var(--secondary-color);
        }

        #knowledgeBase {
            width: 100%;
        }

        #initialPrompt {
            width: 100%;
        }

        .help-text {
            display: none; /* Alapértelmezés szerint rejtve */
            margin-top: 5px;
            padding: 5px 15px;
            font-size: 0.95em;
            color: #333;
            background-color: #f0f4f8;
            border-left: 4px solid #007BFF; /* Kiemelő szín a bal oldalon */
            border-radius: 5px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            position: relative;
            transition: all 0.3s ease;
            margin-bottom: 15px;
            max-height: 250px;
            overflow-x: hidden;
            font-size: 12px;
            overscroll-behavior: contain;
        }

        .help-text.show {
            display: block;
            max-height: 250px; /* Kisebb maximális magasság a help-text-hez */
            opacity: 1;
        }

        /* Webkit-alapú böngészők: Chrome, Safari, Edge */
        .mainhelp-text::-webkit-scrollbar {
            width: 10px; /* Szélesség beállítása */
        }

        .mainhelp-text::-webkit-scrollbar-track {
            background: #f0f4f8; /* Háttérszín a scrollbar track-nél */
        }

        .mainhelp-text::-webkit-scrollbar-thumb {
            background-color: #007BFF; /* Görgetősáv színe */
            border-radius: 5px; /* Lekerekítés */
            border: 2px solid #f0f4f8; /* Szegély a scrollbar körül */
        }

        .mainhelp-text::-webkit-scrollbar-thumb:hover {
            background-color: #0056b3; /* Hover szín a scrollbar számára */
        }

                /* Firefox */
/*         .mainhelp-text {
            scrollbar-width: thin;

        }         */

        .header-text {
            user-select: none;
            font-size: 18px;
        }
        .mainhelp-text {
            display: none; /* Alapértelmezés szerint rejtve */
            margin-top: 5px;
            padding: 5px 15px;
            font-size: 0.95em;
            color: #333;
            background-color: #f0f4f8;
            border-left: 4px solid #007BFF; /* Kiemelő szín a bal oldalon */
            border-radius: 5px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            position: relative;
            transition: all 0.3s ease;
            margin-bottom: 15px;
            max-height: 250px;
            max-width: 92%;
            overflow-x: hidden;
            font-size: 12px;
            user-select: none;
            overscroll-behavior: contain;
        }
        
        .help-text::before {
            /* content: "ℹ️"; */
            position: absolute;
            top: -20px;
            left: -4px;
            background-color: #f0f4f8;
            border-radius: 50%;
            padding: 5px;
            font-size: 1.2em;
        }

        .mainhelp-text::before {
            /* content: "ℹ️"; */
            position: absolute;
            top: -20px;
            left: -4px;
            background-color: #f0f4f8;
            border-radius: 50%;
            padding: 5px;
            font-size: 1.2em;
        }
        
        .info-icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            line-height: 16px;
            border-radius: 50%;
            background-color: #007BFF; /* Kék háttérszín */
            color: white;
            text-align: center;
            cursor: pointer;
            font-size: 0.8em;
            /* font-weight: bold; */
            transition: background-color 0.3s ease;  
            margin-bottom: 5px;     
            user-select: none;     
        }

        .maininfo-icon {
            display: inline-block;
            width: 18px;
            height: 18px;
            line-height: 18px;
            border-radius: 50%;
            background-color: #007BFF; /* Kék háttérszín */
            color: white;
            text-align: center;
            cursor: pointer;
            font-size: 0.6em;
            font-family: 'Times New Roman', serif;
            font-weight: bold;
            /* font-weight: bold; */
            transition: background-color 0.3s ease;  
            user-select: none;   
            margin-left: 10px;       
        }

        .tour-icon {
            display: inline-block;
            width: 18px;
            height: 18px;
            line-height: 18px;
            border-radius: 50%;
            background-color: #007BFF; /* Kék háttérszín */
            color: white;
            text-align: center;
            cursor: pointer;
            font-size: 0.6em;
            /* font-weight: bold; */
            transition: background-color 0.3s ease;  
            user-select: none;  
            margin-left: 5px;        
        }
        
        .info-icon:hover {
            color: #007BFF;
            background-color: #0056b3; /* Sötétebb kék hover szín */
        }

        .tour-icon:hover {
            color: #007BFF;
            background-color: #0056b3; /* Sötétebb kék hover szín */
        }

        .maininfo-icon:hover {
            color: #007BFF;
            background-color: #0056b3; /* Sötétebb kék hover szín */
        }
     
        .switch-label {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
        }

        .switch {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: relative;
            display: inline-block;
            width: 40px;
            height: 20px;
            background-color: #ccc;
            border-radius: 20px;
            transition: 0.4s;
        }

        .slider.round {
            border-radius: 20px;
        }

        .slider::before {
            content: "";
            position: absolute;
            width: 18px;
            height: 18px;
            left: 1px;
            bottom: 1px;
            background-color: white;
            border-radius: 50%;
            transition: 0.4s;
        }

        .switch:checked+.slider {
            background-color: #2196F3;
        }

        .switch:checked+.slider::before {
            transform: translateX(20px);
        }

        #buttonContainerSmall {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .buttonGroupLeft,
        .buttonGroupRight {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        #locationToggleContainer {
            font-size: 12px;
            margin-left: 10px;
        }

        #bingToggleContainer {
            font-size: 12px;
            margin-left: 10px;
        }

        .icons-container {            
            margin-top: 10px;
        }

        

        .switch-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    }

    .switch {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    .slider {
        position: relative;
        display: inline-block;
        width: 25px; 
        height: 15px; 
        background-color: #ccc;
        border-radius: 15px;
        transition: 0.4s;
    }

    .slider::before {
        content: "";
        position: absolute;
        width: 13px;
        height: 13px;
        left: 1px;
        bottom: 1px;
        background-color: white;
        border-radius: 50%;
        transition: 0.4s;
    }

    .switch:checked + .slider {
        background-color: #2196F3;
    }

    .switch:checked + .slider::before {
        transform: translateX(10px); 
    }






                        </style>
                    </head>
                    <body>
                        <div id="messages">
                            ${messages}
                        </div>
                    </body>
                    </html>
                    `;
                    const chatBlob = new Blob([htmlTemplate], { type: "text/plain" });
                    const url = URL.createObjectURL(chatBlob);
                    const a = document.createElement("a");
                    const now = new Date();
                    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const formattedTime = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
                    const formattedDateTime = `${formattedDate}_${formattedTime}`;
                    a.href = url;
                    a.download = `[HVFR_CoPilot_Chat]-${formattedDateTime}.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });

                sendBtn.addEventListener("click", sendMessage);

                document.getElementById("customInitialPrompt").addEventListener("keydown", (event) => {
                    if (event.key === 'Enter') setSession();
                });

                document.getElementById("captureImageBtn").addEventListener("click", captureImage);
                document.getElementById("loadTextFilesBtn").addEventListener("click", loadTextFiles);
                document.getElementById("setSessionBtn").addEventListener("click", setSession);
                document.getElementById("removeFilesBtn").addEventListener("click", removeFiles);
                document.getElementById("removeFilesBtn").disabled = true;

                await saveChatToLocalStorage();
                //await saveChatToGoogleDrive();
            })();
        });
    })();

    knowledgeBase = knowledgeBaseOnLoad;
    usedKnowledgeBase = document.getElementById('knowledgeBase').value;
    previousKnowledgeBase = document.getElementById('knowledgeBase').value;

    function getLocale() {
        const locale = Intl.DateTimeFormat().resolvedOptions().locale;
        return locale || navigator.language;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    let isSpeechRecognitionInput = false;

    if (SpeechRecognition) {
        const microphoneBtn = document.getElementById('microphoneBtn');
        microphoneBtn.style.display = 'inline-block';
        recognition = new SpeechRecognition();
        recognition.lang = navigator.language || 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = function (event) {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            document.getElementById('userInput').value = transcript;
            isSpeechRecognitionInput = true;
        };

        recognition.onend = function () {
            document.getElementById('microphoneBtn').textContent = '🎤';
        };

        recognition.onerror = function (event) {
            console.error('Speech recognition error:', event.error);
        };        

        const toggleSendButton = () => {
            if (userInput.value.trim() === "") {
                sendBtn.disabled = true;
                sendBtn.classList.remove("enabled");
            } else {
                sendBtn.disabled = false;
                sendBtn.classList.add("enabled");
            }
        };

        microphoneBtn.addEventListener('mousedown', function () {
            recognition.start();
            microphoneBtn.textContent = '🗣️';
            microphoneBtn.style.backgroundColor = 'red';
        });

        microphoneBtn.addEventListener('mouseup', function () {
            recognition.stop();
            microphoneBtn.style.backgroundColor = '#28a745';

            if (document.getElementById('userInput').value.trim() !== '') {
                sendMessage();
            }
            document.getElementById('userInput').value = '';
        }, { passive: true });


        microphoneBtn.addEventListener('touchstart', function () {
            recognition.start();
            microphoneBtn.textContent = '🗣️';
            microphoneBtn.style.backgroundColor = 'red';
        }, { passive: true });

        microphoneBtn.addEventListener('touchend', function () {
            recognition.stop();
            microphoneBtn.style.backgroundColor = '#28a745';
            if (document.getElementById('userInput').value.trim() !== '') {
                sendMessage();
            }
            document.getElementById('userInput').value = '';
            //toggleSendButton();
        }, { passive: true });

    } else {
        microphoneBtn.style.display = 'none';
        console.error('Web Speech API not supported.');
        displayMessage('⚠️ Speech recognition is not supported in this browser. Please use Chrome or Edge for speech recognition.', 'system');
    }


    function copyToClipboard(text) {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextArea);
        displayMessage("📋 Copied to clipboard", "system");
        switchTab(currentTabId);
    }

    function populateVoiceOptions() {
        const voiceSelect = document.getElementById('aiVoice');
        const voices = window.speechSynthesis.getVoices();

        voiceSelect.innerHTML = '';

        const locale = getLocale();
        let defaultVoiceFound = false;

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;

            if (voice.lang === locale && !defaultVoiceFound) {
                option.selected = true;
                defaultVoiceFound = true;
            }

            if (voice.lang.startsWith(locale.split('-')[0]) && !defaultVoiceFound) {
                option.selected = true;
                defaultVoiceFound = true;
            }

            voiceSelect.appendChild(option);
        });

        if (!defaultVoiceFound && voices.length > 0) {
            voiceSelect.selectedIndex = 0;
        }
    }

    function initializeVoices() {
        const voices = window.speechSynthesis.getVoices();

        if (voices.length > 0) {
            populateVoiceOptions();
        }

        window.speechSynthesis.onvoiceschanged = function () {
            populateVoiceOptions();
        };
    }

    let isPlaying = false;
    let isPaused = false;
    let currentUtterance = null;
    let lastCharIndex = 0;

    function speakMessage(message, speakerIcon) {
        const sanitizedMessage = urlSanitize(message);

        //const controlContainer = speakerIcon.parentElement;

        let controlContainer;
        if (speakerIcon) {
            controlContainer = speakerIcon.parentElement;
        } else {
            controlContainer = document.createElement('div');
        }

        let playPauseStopContainer = controlContainer.querySelector('.play-pause-stop-container');
        const copyIcon = controlContainer.querySelector('.copy-icon');

        if (!playPauseStopContainer) {
            playPauseStopContainer = document.createElement('div');
            playPauseStopContainer.classList.add('play-pause-stop-container');
            controlContainer.appendChild(playPauseStopContainer);

            const playPauseButton = document.createElement('span');
            playPauseButton.classList.add('play-pause-button');
            playPauseButton.textContent = '⏸️';
            playPauseStopContainer.appendChild(playPauseButton);

            const stopButton = document.createElement('span');
            stopButton.classList.add('stop-button');
            stopButton.textContent = '⏹️';
            playPauseStopContainer.appendChild(stopButton);

            //speakerIcon.style.display = 'none';

            if (speakerIcon) {
                speakerIcon.style.display = 'none';
            }

            if (copyIcon) {
                copyIcon.style.display = 'none';
            }

            playPauseButton.addEventListener('click', () => {
                if (isPlaying && !isPaused) {
                    window.speechSynthesis.cancel();
                    isPaused = true;
                    isPlaying = false;
                    playPauseButton.textContent = '▶️';
                } else if (!isPlaying && isPaused) {
                    startPlaying(sanitizedMessage, playPauseButton, stopButton, speakerIcon, copyIcon, lastCharIndex);
                    isPaused = false;
                    playPauseButton.textContent = '⏸️';
                }
            });

            stopButton.addEventListener('click', () => {
                if (isPlaying || isPaused) {
                    window.speechSynthesis.cancel();
                    isPlaying = false;
                    isPaused = false;
                    lastCharIndex = 0;
                    resetSpeakerIcon(speakerIcon, playPauseStopContainer, copyIcon);
                }
            });
        }

        if (!isPlaying && !isPaused) {
            startPlaying(sanitizedMessage, playPauseStopContainer.querySelector('.play-pause-button'), playPauseStopContainer.querySelector('.stop-button'), speakerIcon, copyIcon);
        }
    }

    function startPlaying(message, playPauseButton = null, stopButton = null, speakerIcon = null, copyIcon = null, startCharIndex = 0) {
        const utterance = new SpeechSynthesisUtterance(message.substring(startCharIndex));
        const voiceSelect = document.getElementById('aiVoice');
        const selectedVoiceName = voiceSelect.value;
        const voices = window.speechSynthesis.getVoices();

        const selectedVoice = voices.find(voice => voice.name === selectedVoiceName);
        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        }

        currentUtterance = utterance;
        isPlaying = true;
        isPaused = false;

        playPauseButton.textContent = '⏸️';

        if (speakerIcon) {
            speakerIcon.style.display = 'none';
        }


        if (copyIcon) {
            copyIcon.style.display = 'none';
        }

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                lastCharIndex = startCharIndex + event.charIndex;
            }
        };

        utterance.onend = () => {
            isPlaying = false;
            isPaused = false;
            lastCharIndex = 0;
            resetSpeakerIcon(speakerIcon, playPauseButton.parentElement, copyIcon);
        };

        window.speechSynthesis.speak(utterance);
    }

    function resetSpeakerIcon(speakerIcon, playPauseStopContainer, copyIcon) {
        speakerIcon.textContent = '🔊';
        speakerIcon.style.display = 'inline-block';
        if (playPauseStopContainer) {
            playPauseStopContainer.remove();
        }
        if (copyIcon) {
            copyIcon.style.display = 'inline-block';
        }
    }

    function urlSanitize(message) {
        const urlPattern = /\b(?:https?|ftp):\/\/[^\s]+/g;
        let sanitized = message.replace(urlPattern, '');
        sanitized = sanitized.replace(/(\*\*|__)(.*?)\1/g, '$2');
        sanitized = sanitized.replace(/(\*|_)(.*?)\1/g, '$2');
        sanitized = sanitized.replace(/~~(.*?)~~/g, '$1');
        sanitized = sanitized.replace(/`(.*?)`/g, '$1');
        sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        sanitized = sanitized.replace(/!\[.*?\]\([^)]+\)/g, '');
        sanitized = sanitized.replace(/^#{1,6}\s*(.*)/gm, '$1');
        sanitized = sanitized.replace(/^>\s*(.*)/gm, '$1');
        sanitized = sanitized.replace(/^(\*|\+|-)\s+/gm, '');
        sanitized = sanitized.replace(/^\d+\.\s+/gm, '');
        sanitized = sanitized.replace(/^(-\s?){3,}$/gm, '');
        sanitized = sanitized.replace(/^(\*\s?){3,}$/gm, '');
        sanitized = sanitized.replace(/[*_~`>#\-+]/g, '');
        return sanitized;
    }

    function getStartFromLastTwoWords() {
        if (wordPositions.length >= 3) {
            return wordPositions[wordPositions.length - 3];
        } else if (wordPositions.length > 0) {
            return wordPositions[0];
        }
        return 0;
    }


    function addSpeakerIconEventListener(messageElement, message) {
        const speakerIcon = messageElement.querySelector('.speaker-icon');
        speakerIcon.addEventListener('click', () => {
            speakMessage(message, speakerIcon);
        });
    }

    const displayMessage = (message, role, subRole = null) => {
        const messagesDiv = document.getElementById("messages");
        const messageElement = document.createElement("div");
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        messageElement.id = messageId;
        messageElement.classList.add("message", role);
        
        
        if (role === "assistant" || role === "perplexity") {
            // Escape-eljük a HTML karaktereket, de hagyjuk a markdown kódblokkokat érintetlenül
              let escapedMessage = message.replace(/```[\s\S]*?```|`[^`]*`/g, (match) => {
                // Kódblokkokat nem escape-eljük
                return match;
            }); 
        
            //let htmlContent = marked.parse(message);
            // Markdown parse az escape-elt üzenettel
            htmlContent = marked.parse(escapedMessage);
            
            // Sanitize-oljuk a generált HTML-t
            htmlContent = sanitizeInput(htmlContent);
        
            // További szövegmanipulációk
            htmlContent = htmlContent
                .replace(/<\/li>\s*<li>/g, '</li><li>')
                .replace(/<\/p>\s*<p>/g, '</p><p>')
                .replace(/<\/h[1-6]>\s*<h[1-6]>/g, '</h1><h1>')
                .replace(/<\/h[1-6]>\s*<\/p>/g, '</h1></p>')
                .replace(/<p>\s*<\/p>/g, '')
                .replace(/<br\s*\/?>\s*/g, '<br>')
                .replace(/(?:\r\n|\r|\n){2,}/g, '<br>');
        } else if (role === "system") {
            // Ha a role "system", akkor közvetlenül használjuk a message tartalmát
            htmlContent = message;
        }

        if (role === "user") {
            // Escape-eljük a HTML karaktereket, de hagyjuk a markdown kódblokkokat érintetlenül
            let escapedMessage = message.replace(/```[\s\S]*?```|`[^`]*`/g, (match) => {
                // Kódblokkokat nem escape-eljük
                return match;
            }).replace(/&/g, '&')
              .replace(/</g, '< ')
              .replace(/>/g, '> ')
              .replace(/"/g, '"')
              .replace(/'/g, "'");
        
            // Markdown parse az escape-elt üzenettel
            htmlContent = marked.parse(escapedMessage);
        
            // Sanitize-oljuk a generált HTML-t
            htmlContent = sanitizeInput(htmlContent);
        
            // További szövegmanipulációk
            htmlContent = htmlContent
                .replace(/<\/li>\s*<li>/g, '</li><li>')
                .replace(/<\/p>\s*<p>/g, '</p><p>')
                .replace(/<\/h[1-6]>\s*<h[1-6]>/g, '</h1><h1>')
                .replace(/<\/h[1-6]>\s*<\/p>/g, '</h1></p>')
                .replace(/<p>\s*<\/p>/g, '')
                .replace(/<br\s*\/?>\s*/g, '<br>')
                .replace(/(?:\r\n|\r|\n){2,}/g, '<br>');
        } else if (role === "system") {
            // Ha a role "system", akkor közvetlenül használjuk a message tartalmát
            htmlContent = message;
        }        

        session = sessions[currentTabId];

        const now = new Date();
        const formattedDate = `${now.getDate()}/${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear().toString().slice(-2)}`;
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let avatarText = '';
        if (role === "user") {
            avatarText = `🧑 You`;
        } else if (role === "assistant") {
            avatarText = `${session.aiProfileName}`;
        } else if (role === "perplexity") {
            avatarText = ``;
        }

        let speakerIconHtml = '';
        let copyIconHtml = '';
        let stopIconHtml = '';
        let timestampHtml = '';
        const subRoleClass = subRole ? ` ${subRole}` : '';
        if (role === "user" || role === "assistant" || role === "perplexity") {
            timestampHtml = `<div class="timestamp">${formattedDate} ${formattedTime}</div>`;
        }

        if (role === "assistant" || role === "user" || role === "perplexity") {
            copyIconHtml = `<div class="copy-icon" style="position: absolute; left: 5px; bottom: 0px; cursor: pointer;" title="Copy to clipboard">📋</div>`;
        }

        if (role === "assistant" || role === "perplexity") {
            speakerIconHtml = `<div class="speaker-icon" style="position: absolute; left: 25px; bottom: 0px; cursor: pointer;" title="Read out loud">🔊</div>`;
            stopIconHtml = `<div class="stop-button" style="position: absolute; left: 20px; bottom: 0px; cursor: pointer;" title="Stop reading out loud">⏹️</div>`;
        }

        if (role === 'system') {
            messageElement.innerHTML = `                
                <div class="avatar">${avatarText}</div>
                <div class="content${subRoleClass}">${htmlContent}</div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="avatar">${avatarText}</div>
                <div class="content${subRoleClass}">${htmlContent}</div>
                ${timestampHtml}
                <div class="icons-container" style="position: relative; bottom: 0px;">
                    ${role === 'assistant' || role === 'user' || role === 'perplexity' ? '<br>' : ''}
                    ${copyIconHtml}
                    ${speakerIconHtml}
                </div>
            `;
        }        

        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        toggleSaveButton();
        toggleUpdateButton();
        //reattachEventListeners();

        if (role === "assistant") {
            const speakerIcon = messageElement.querySelector('.speaker-icon');
            addSpeakerIconEventListener(messageElement, message, speakerIcon);
            if (isSpeechRecognitionInput) {
                reattachEventListeners();                
                isSpeechRecognitionInput = false;
                speakMessage(message, speakerIcon);                
                reattachEventListeners();                
            }
        }              
        switchTab(currentTabId);
        reattachEventListeners();   
        return messageId;
    };

    const removeMessage = (messageId) => {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.remove();
        }
        toggleSaveButton();
        toggleUpdateButton();
    };

})();