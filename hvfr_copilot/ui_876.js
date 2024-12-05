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
    let knowledgeBaseOnLoad = "features.dat";
    let initialPromptOnLoad = "2-penny.ini";
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
    let extension = "";
    let file = "";
    let files = [];
    const baseUploadUrl = "https://hungaryvfr.hu/chat/reader";
    let userInputToAi = "";
    let combinedImageResponses = ''; // A válaszok összegyűjtése
    const saveChatBtn = document.getElementById("saveChatBtn");
    let imageMsgUrls = [];
    const setSessionBtn = document.getElementById("setSessionBtn");
    let currentFile = "";
    let imageUrls = [];
    let selectedImages;
    let fileNames;
    let fileName;


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

    const loadTextFiles = async () => {

        const fileTypeEmojis = {
            zip: '📦', // ZIP archívumok
            pdf: '📝', // PDF dokumentumok
            doc: '📝', // Word dokumentumok
            docx: '📝',
            epub: '📚', // E-könyvek
            xls: '📊', // Táblázatok
            xlsx: '📊',
            odt: '📝', // LibreOffice Writer dokumentumok
            fodt: '📝',
            ods: '📊', // LibreOffice Calc táblázatok
            fods: '📊',
            pptx: '🎞️', // PowerPoint prezentációk
            odp: '🎞️', // LibreOffice Impress prezentációk
            rtf: '📝', // RTF formátum
            ini: '⚙️', // Konfigurációs fájlok
            json: '🔧', // JSON fájlok
            csv: '📈', // CSV adatok
            js: '☕', // JavaScript kód
            html: '🌐', // HTML fájlok
            htm: '🌐',
            css: '🎨', // Stíluslapok
            md: '📘', // Markdown fájlok
            xml: '🗂️', // XML fájlok
            yaml: '🗂️', // YAML fájlok
            yml: '🗂️',
            log: '📃', // Naplófájlok
            config: '⚙️',
            cfg: '⚙️',
            properties: '⚙️',
            sql: '🗄️', // SQL parancsfájlok
            sh: '🐚', // Shell script
            bat: '💻', // Batch script
            cmd: '💻', 
            py: '🐍', // Python
            java: '☕', // Java
            cpp: '🖥️', // C++
            h: '🖥️',
            php: '🐘', // PHP
            txt: '📝', // Egyszerű szöveg
            tex: '📚', // LaTeX
            r: '📊', // R statisztikai fájl
            swift: '🦅', // Swift
            go: '🐹', // Go
            vb: '🔵', // Visual Basic
            cs: '🧩', // C#
            sass: '🎨', // SASS
            lua: '🌑', // Lua
            groovy: '🎶', // Groovy
            mak: '🏗️', // Build fájlok
            gradle: '🛠️' // Gradle
        };
        

        const allowedExtensions = [
            'txt', 'pdf', 'epub', 'xlsx', 'odt', 'ods', 'fodt', 'fods', 'docx', 'pptx', 'odp',
            'ini', 'json', 'csv', 'js', 'html', 'htm', 'css', 'md', 'xml',
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
            'ada', 'adb', 'ads', 'pro', 'gpr', 'kts', 'build', 'gradle', 'docx', 'rtf', 'zip'
        ];

        const getFileEmoji = (extension) => {
            return fileTypeEmojis[extension] || '📄';
        };

        const acceptedFileTypes = allowedExtensions.map(ext => `.${ext}`).join(',');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = acceptedFileTypes;
        input.multiple = true;
        imageUrls = [];
      
        input.onchange = async (event) => {
          files = Array.from(event.target.files);
          let validFiles = [];
          let invalidFiles = [];
      
          let session = sessions[currentTabId];
          session.fileContents = session.fileContents || {}; // Initialize as an object
          session.imageUrls = session.imageUrls || [];
          session.loadedFiles = session.loadedFiles || [];
      
          for ( file of files) {
            extension = file.name.split('.').pop().toLowerCase();
      
            if (allowedExtensions.includes(extension)) {
              let content = '';

              if (extension === 'pdf') {
                content = await extractTextFromPdf(file);                    
              } else if (extension === 'doc' || extension === 'docx') {
                content = await extractTextFromDoc(file);                               
              } else if (extension === 'epub') {
                content = await extractTextFromEpub(file);
              } else if (extension === 'xls' || extension === 'xlsx') {
                content = await extractTextFromXlsx(file);                               
              } else if (extension === 'odt') {
                content = await extractTextFromOdt(file);                               
              } else if (extension === 'fodt') {
                content = await extractTextFromFodt(file);                              
              } else if (extension === 'ods') {
                content = await extractTextFromOds(file);                             
              } else if (extension === 'fods') {
                content = await extractTextFromFods(file);                                
              } else if (extension === 'pptx') {
                content = await extractTextFromPPTX(file);                 
              } else if (extension === 'odp') {
                content = await extractTextFromODP(file);               
              } else if (extension === 'rtf') {
                content = await extractTextFromRtf(file);                               
               } else if (extension === 'zip') {
                //content = await extractTextFromZip(file); 
                content = ""; 
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
            // validFiles átalakítása fájlnév és kiterjesztés párok tömbjévé

            const filesWithTypes = validFiles.map(file => {
                const extension = file.split('.').pop().toLowerCase();
                return { name: file, extension };

                
            });       


            let filesWithEmoji = validFiles.map(file => {
                const extension = file.split('.').pop().toLowerCase();
                const emoji = getFileEmoji(extension);
                return `<div class="content" style="margin-bottom:5px">${emoji} ${file}</div>`;
            }).join('');
        
            const fileCount = validFiles.length;
            const fileWord = fileCount === 1 ? 'File' : 'Files';
        
            displayMessage(
                `<div class="content" style="margin-bottom:5px">🔗 ${fileWord} loaded successfully:</div>
                <div class="content" style="margin-bottom:5px">${filesWithEmoji}</div>`, 
                'system'
            );
        
            await logToFile(`📄 ${fileWord} loaded: ${validFiles.join(', ')}`);
            document.getElementById("removeFilesBtn").disabled = false;
        } else {
            displayMessage('⛔ No valid files were loaded.', 'system');
        }
        
      
          if (invalidFiles.length > 0) {
            const formattedInvalidFiles = invalidFiles.map(file => `⛔ ${file}`).join('<br>');
            displayMessage(`⛔ Invalid file types:<br>${formattedInvalidFiles}`, 'system');
          }


          for ( file of files) {
            extension = file.name.split('.').pop().toLowerCase();  
            if (allowedExtensions.includes(extension)) {                    
                if (extension === 'pdf') {            
                    imageUrls = await extractImagesFromPdf(file);            
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);  
                    
                } else if (extension === 'doc' || extension === 'docx') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)              
                    }                                    
                } else if (extension === 'epub') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);                              
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)               
                    }                      
                    selectedImages = updateSelectedImages(imageUrls); 
                } else if (extension === 'xls' || extension === 'xlsx') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);                              
                } else if (extension === 'odt') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                 
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);                                
                } else if (extension === 'fodt') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);                                
                } else if (extension === 'ods') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);                               
                } else if (extension === 'fods') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);                               
                } else if (extension === 'pptx') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)               
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);              
                } else if (extension === 'odp') {            
                    imageUrls = await extractAndSaveImagesFromZip(file);
                    if (imageUrls.length > 0) {
                        initializeImageLegend(imageUrls, file.name)                
                    }                      
                    selectedImages = updateSelectedImages(imageUrls);               
                } else if (extension === 'rtf') {            
                } else if (extension === 'zip') {
                    //content = await extractTextFromZip(file); 
                    imageUrls = ""; 
                } else {                
                    imageUrls = ""; 
                }
                //console.log(`Fájl betöltve: ${file.name}`);
                
            }
          
        }                  
          saveChatToLocalStorage();
          reattachEventListeners(); 
          switchTab(currentTabId); 
        };          
        reattachEventListeners();    
        switchTab(currentTabId);
        input.click();
      };


      const updateMessage = (messageId, newContent) => {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.innerHTML = newContent;
        }
      };

      const extractImagesFromPdf = async (file, baseUploadUrl) => {
        //imageUrls = [];
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
            let containsText = false;
    
            // Ellenőrizzük, van-e szöveg a PDF-ben
            for (let i = 0; i < pdf.numPages; i++) {
                const page = await pdf.getPage(i + 1);
                const textContent = await page.getTextContent();
                if (textContent.items.some(item => item.str.trim())) {
                    containsText = true;
                    break;
                }
            }
    
            if (containsText) {
                // Ha van szöveg, csak a beágyazott képeket nyerjük ki
                //let pdfMsgId = displayMessage("📥 Scanned PDF, AI will use Image Recognition...", "system");
                const embeddedImages = await extractEmbeddedImagesFromPdf(pdf, baseUploadUrl);
                imageUrls.push(...embeddedImages);
                //removeMessage(pdfMsgId);
            } else {
                // Ha nincs szöveg, az oldalakat rendereljük képként
                for (let i = 0; i < pdf.numPages; i++) {
                    let pdfMsgId = displayMessage("📥 Scanned PDF, converting pages to images...", "system");
                    //const grabId = displayMessage(`🖼️ Converting PDF to Image (${i + 1} page / ${pdf.numPages} page...)`, "system");                    
                    const grabId = displayMessage(`🖼️ Converting PDF to image (Page ${i + 1} of ${pdf.numPages}...)`, "system");
                    const page = await pdf.getPage(i + 1);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;                    
    
                    // Rendereljük az oldalt a canvas-re
                    await page.render({ canvasContext: context, viewport }).promise;
    
                    // Konvertáljuk a canvas-t Blob formátumba (kép)
                    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg"));
    
                    // Dinamikus fájlnév
                    const randomName = `${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    
                    // Kép feltöltése szerverre
                    const formData = new FormData();
                    formData.append("file", imageBlob);
                    formData.append("fileName", randomName);
    
                    const response = await fetch(`reader_image.php`, {
                        method: "POST",
                        body: formData,
                    });
    
                    const result = await response.json();
                    if (result.status === "success") {
                        imageUrls.push(result.url);
                    } else {
                        console.error(`Kép mentési hiba (page ${i + 1}):`, result.message);
                    }
                    removeMessage(grabId);
                    removeMessage(pdfMsgId);
                }
            }
        } catch (error) {
            console.error("Hiba a PDF képek kinyerése közben:", error);
        }
        return imageUrls;
    };


    /* const extractEmbeddedImagesFromPdf = async (pdf, baseUploadUrl) => {
        imageUrls = [];
        try {
            for (let i = 0; i < pdf.numPages; i++) {
                const page = await pdf.getPage(i + 1);
                const operatorList = await page.getOperatorList();                
                for (let j = 0; j < operatorList.fnArray.length; j++) {
                    const fn = operatorList.fnArray[j];
                    let pdfMsgId = displayMessage("📥 Images in PDF, AI will use Image Recognition...", "system");
                    //const grabId = displayMessage(`🖼️ Extracting Images from PDF (${i + 1} page / ${pdf.numPages} page...)`, "system");                                
                    const grabId = displayMessage(`🖼️ Extracting Images from PDF (Page ${i + 1} of ${pdf.numPages}...)`, "system");

                    if (fn === pdfjsLib.OPS.paintJpegXObject || fn === pdfjsLib.OPS.paintImageXObject) {
                        const args = operatorList.argsArray[j];
                        const objectName = args[0];
    
                        try {
                            let imageObject = null;
                            if (page.commonObjs.has(objectName)) {
                                imageObject = await page.commonObjs.get(objectName);
                            } else {
                                imageObject = await page.objs.get(objectName);
                            }
    
                            if (imageObject) {
                                const imageBlob = await renderImageToBlob(page, imageObject);
                                if (imageBlob) {
                                    await saveImageObject(imageBlob, baseUploadUrl, imageUrls);
                                }
                            } else {
                                console.warn(`Objektum nem elérhető vagy nem tartalmaz adatot: ${objectName}`);
                            }                            
                        } catch (innerError) {
                            console.warn(`Hiba az objektum (${objectName}) feldolgozása közben:`, innerError);
                        }
                    }
                    removeMessage(grabId);    
                    removeMessage(pdfMsgId);          
                }
                
            }
        } catch (error) {
            console.error("Hiba a beágyazott képek feldolgozása közben:", error);
        }
        return imageUrls;
    }; */
    
/*     const extractEmbeddedImagesFromPdf = async (pdf, baseUploadUrl) => {
        const imageUrls = [];
        try {
            const tasks = Array.from({ length: pdf.numPages }, (_, i) => (async () => {
                
    
                try {                    
                    const pdfMsgId = displayMessage(`📥 Extracting images from page ${i + 1} of ${pdf.numPages}...`, "system");
                    const page = await pdf.getPage(i + 1);
                    const operatorList = await page.getOperatorList();
    
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        const fn = operatorList.fnArray[j];
                        if (fn === pdfjsLib.OPS.paintJpegXObject || fn === pdfjsLib.OPS.paintImageXObject) {
                            const args = operatorList.argsArray[j];
                            const objectName = args[0];
    
                            try {
                                const imageObject = page.commonObjs.has(objectName)
                                    ? await page.commonObjs.get(objectName)
                                    : await page.objs.get(objectName);
    
                                if (imageObject) {
                                    const imageBlob = await renderImageToBlob(page, imageObject);
                                    if (imageBlob) {
                                        await saveImageObject(imageBlob, baseUploadUrl, imageUrls);
                                    }
                                }
                            } catch (innerError) {
                                console.warn(`Error processing object (${objectName}):`, innerError);
                            }
                        }
                    }
                    removeMessage(pdfMsgId);
                } catch (pageError) {
                    console.error(`Error processing page ${i + 1}:`, pageError);
                } finally {
                    
                }
            })());
    
            await Promise.all(tasks);
        } catch (error) {
            console.error("Error extracting embedded images from PDF:", error);
        }
        return imageUrls;
    }; */
    

 /*    const extractEmbeddedImagesFromPdf = async (pdf, baseUploadUrl) => {
        const imageUrls = [];
        let statusMessageId = null;
    
        try {
            // Kezdő állapotüzenet
            statusMessageId = displayMessage(`📥 Extracting images from PDF...`, "system");
    
            for (let i = 0; i < pdf.numPages; i++) {
                try {
                    // Állapotüzenet frissítése az aktuális oldal alapján
                    updateMessage(statusMessageId, `📥 Extracting images from page ${i + 1} of ${pdf.numPages}...`);
                    
                    const page = await pdf.getPage(i + 1);
                    const operatorList = await page.getOperatorList();
    
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        const fn = operatorList.fnArray[j];
                        if (fn === pdfjsLib.OPS.paintJpegXObject || fn === pdfjsLib.OPS.paintImageXObject) {
                            const args = operatorList.argsArray[j];
                            const objectName = args[0];
    
                            try {
                                const imageObject = page.commonObjs.has(objectName)
                                    ? await page.commonObjs.get(objectName)
                                    : await page.objs.get(objectName);
    
                                if (imageObject) {
                                    const imageBlob = await renderImageToBlob(page, imageObject);
                                    if (imageBlob) {
                                        await saveImageObject(imageBlob, baseUploadUrl, imageUrls);
                                    }
                                }
                            } catch (innerError) {
                                console.warn(`Error processing object (${objectName}):`, innerError);
                            }
                        }
                    }
                } catch (pageError) {
                    console.error(`Error processing page ${i + 1}:`, pageError);
                }
            }
    
            // Végső állapotüzenet
            updateMessage(statusMessageId, `✅ Image extraction completed for ${pdf.numPages} pages.`);
        } catch (error) {
            console.error("Error extracting embedded images from PDF:", error);
    
            // Hibaüzenet állapota
            if (statusMessageId) {
                updateMessage(statusMessageId, `❌ Error during image extraction.`);
            }
        }
    
        return imageUrls;
    }; */
    
    const extractEmbeddedImagesFromPdf = async (pdf, baseUploadUrl) => {
        const imageUrls = [];
        let statusMessageId = null;
    
        try {
            // Kezdő állapotüzenet
            statusMessageId = displayMessage(`📥 Extracting images from PDF...`, "system");
    
            for (let i = 0; i < pdf.numPages; i++) {
                let foundImages = false; // Nyomon követi, hogy találtunk-e képet az oldalon
                try {
                    // Állapotüzenet frissítése az aktuális oldal alapján
                    updateMessage(statusMessageId, `📥 Extracting images from page ${i + 1} of ${pdf.numPages}...`);
    
                    const page = await pdf.getPage(i + 1);
                    const operatorList = await page.getOperatorList();
    
                    // OperatorList iterálása
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        const fn = operatorList.fnArray[j];
                        if (
                            fn === pdfjsLib.OPS.paintJpegXObject ||
                            fn === pdfjsLib.OPS.paintImageXObject ||
                            fn === pdfjsLib.OPS.paintXObject
                        ) {
                            const args = operatorList.argsArray[j];
                            const objectName = args[0];
    
                            try {
                                const imageObject = page.commonObjs.has(objectName)
                                    ? await page.commonObjs.get(objectName)
                                    : await page.objs.get(objectName);
    
                                if (imageObject) {
                                    const imageBlob = await renderImageToBlob(page, imageObject);
                                    if (imageBlob) {
                                        await saveImageObject(imageBlob, baseUploadUrl, imageUrls);
                                        foundImages = true; // Jelezzük, hogy találtunk képet
                                    }
                                }
                            } catch (innerError) {
                                console.warn(`Error processing object (${objectName}):`, innerError);
                            }
                        }
                    }
    
                    // Ha nem találtunk képeket az oldalon, rendereljük bitmapként
                    if (!foundImages) {
                        const viewport = page.getViewport({ scale: 1 });
                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d");
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
    
                        const renderTask = page.render({
                            canvasContext: context,
                            viewport: viewport,
                        });
    
                        await renderTask.promise;
    
                        const bitmapBlob = await new Promise((resolve) =>
                            canvas.toBlob((blob) => resolve(blob), "image/png")
                        );
    
                        if (bitmapBlob) {
                            await saveImageObject(bitmapBlob, baseUploadUrl, imageUrls);
                        }
                    }
                } catch (pageError) {
                    console.error(`Error processing page ${i + 1}:`, pageError);
                }
            }
    
            // Végső állapotüzenet
            updateMessage(statusMessageId, `✅ Image extraction completed for ${pdf.numPages} pages.`);
        } catch (error) {
            console.error("Error extracting embedded images from PDF:", error);
    
            // Hibaüzenet állapota
            if (statusMessageId) {
                updateMessage(statusMessageId, `❌ Error during image extraction.`);
            }
        }
    
        return imageUrls;
    };
    
      

    // Kép renderelése Canvas-ba és Blob-ba konvertálása
    const renderImageToBlob = async (page, imageObject) => {
        try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
    
            const { width, height, data, kind } = imageObject;
    
            // Beállítjuk a canvas méreteit
            canvas.width = width;
            canvas.height = height;
    
            const imageData = ctx.createImageData(width, height);
    
            // RGB kezelés
            const isRGB = kind === 2;
    
            if (isRGB) {
                // Az RGB adat feldolgozása
                for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
                    const r = data[i];      // R
                    const g = data[i + 1];  // G
                    const b = data[i + 2];  // B
                    imageData.data[j] = r;       // R
                    imageData.data[j + 1] = g;   // G
                    imageData.data[j + 2] = b;   // B
                    imageData.data[j + 3] = 255; // Alfa
                }
            } else {
                console.warn("Ismeretlen képtípus:", kind);
                return null;
            }
    
            // Képadatok kirajzolása a canvasra
            ctx.putImageData(imageData, 0, 0);
    
            // Canvas tartalom Blob-ba konvertálása
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/jpeg");
            });
        } catch (error) {
            console.error("Hiba a kép renderelése közben:", error);
            return null;
        }
    };
    
    const saveImageObject = async (imageBlob, baseUploadUrl, imageUrls) => {
        const randomName = `${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const formData = new FormData();
        formData.append("file", imageBlob);
        formData.append("fileName", randomName);
    
        const response = await fetch(`reader_image.php`, {
            method: "POST",
            body: formData,
        });
    
        const result = await response.json();
        if (result.status === "success") {
            imageUrls.push(result.url);
        } else {
            console.error(`Hiba a kép mentése közben:`, result.message);
        }
    };
    
    
    
    
    
    
    
    

    // Képek kinyerése ZIP fájlból és tárolása dinamikus néven
    const extractAndSaveImagesFromZip = async (file, baseUploadUrl) => {
        //imageUrls = [];
        try {
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(file);
    
            // Szűrd le csak a képfájlokat
            const imageFiles = Object.entries(zipContent.files).filter(([fileName, zipEntry]) =>
                fileName.match(/\.(jpg|jpeg|png|gif|bmp)$/i)
            );
    
            const totalImages = imageFiles.length;
            let processedImages = 0;
            let imgEpubId = displayMessage(`📥 Images in ${extension.toUpperCase()}, select Images to process by AI...`, "system");
            const grabId = displayMessage(`🖼️ Extracting images from ${extension.toUpperCase()}: 1 of ${totalImages} images`, "system");
    
            for (const [fileName, zipEntry] of imageFiles) {
                try {
                    const imageBlob = await zipEntry.async("blob");
                    const randomName = `${new Date().toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 8)}.jpg`;                    
                    // Kép mentése szerverre
                    const formData = new FormData();
                    formData.append("file", imageBlob);
                    formData.append("fileName", randomName);
    
                    const response = await fetch(`reader_image.php`, {
                        method: "POST",
                        body: formData,
                    });
    
                    const result = await response.json();
                    if (result.status === "success") {
                        imageUrls.push(result.url); // URL a szerveren
                    } else {
                        console.error(`Kép mentési hiba (${fileName}):`, result.message);
                    }
    
                    // Frissítsd a haladás üzenetet
                    processedImages++;
                    updateMessage(grabId, `🖼️ Extracting images from ${extension.toUpperCase()}: ${processedImages} of ${totalImages} images`);
                } catch (imageError) {
                    console.error(`Hiba a kép (${fileName}) feldolgozása közben:`, imageError);
                }
            }
    
            // Távolítsd el az üzenetet, ha kész
            removeMessage(grabId);
            removeMessage(imgEpubId);
        } catch (error) {
            console.error("Hiba a ZIP képek kinyerése közben:", error);
        }
    
        return imageUrls;
    };
    

    // OpenAI képfelismerés function
    const analyzeImagesWithOpenAI = async (file, imageUrls, userInput, contextForImages) => {

/*         selectedImages = imageUrls.filter((_, index) => {
            const checkbox = document.getElementById(`image-checkbox-${index}`);
            return checkbox && checkbox.checked;
        }); */


        //selectedImages = updateSelectedImages(imageUrls);        
    
        if (!selectedImages) {
            displayMessage("⚠️ No images selected for processing.", "system");
            return;
        }
        //console.log(selectedImages)

            //imageUrls.forEach(imageUrl => displayImage(imageUrl, "user"));                
            //displayThumbnails(imageUrls, "image");
            //displayMessage(userInput, "user");
            await waitForDOMUpdate();
            await logToFile(`\n🧑 User: ${userInput}\n`);
            await logToFile(`🖼️ Images: ${imageUrls.join(", ")}\n`);

            let conversationLog = conversationHistory.filter(message => message.role !== 'system');
            const lastFiveMessages = conversationLog.slice(-5);            

            for (let i = 0; i < selectedImages.length; i++) {
                const imageUrl = selectedImages[i];
                const loadingVision = displayMessage(`🖼️ Analyzing Image ${i + 1} of ${selectedImages.length}...`, "system");
                
                try {
                    contextForImages += sessions[currentTabId].conversationHistory;
                    contextForImages += `\nUser location: ${session.userLocationText}\nUser Location coordinates: ${session.userLocation}\nCurent Date and Time: ${currentDateTime}\nUser Input: ${userInput}`;
            
                    const adjustedContext = `${contextForImages}\n${combinedImageResponses}\nAnalyzing image ${i + 1} of ${selectedImages.length}...\n`;
                    
                    const visionResponse = await fetch('process_image.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            image_urls: [imageUrl], 
                            user_input: adjustedContext + userInput,
                        }),
                    });
            
                    const visionData = await visionResponse.json();
            
                    if (visionData.status === "success") {
                        const visionResult = visionData.result;
                        combinedImageResponses += `${file.name} - Image ${i + 1}:\nURL For Image: ${imageUrl}\nAI Image Analysis Result:\n${visionResult}\n\n`;
                    } else {
                        console.error(`❌ OpenAI Vision processing error for image ${i + 1}`);
                    }
                } catch (error) {
                    console.error(`⚠️ Error processing image ${i + 1}:`, error);
                } finally {
                    // Mindig eltávolítjuk az állapotüzenetet az adott képről
                    removeMessage(loadingVision);
                }
            }
            
            // Összefoglaló feldolgozása
            if (combinedImageResponses.trim()) {
                const summarizingMessage = displayMessage("🔄 Summarizing AI Image Recognition Responses...", "system");
            
                try {
                    const payload = {
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "system",
                                content: `You are a highly capable assistant tasked with analyzing both images and text-based documents, such as scanned pages or PDFs. [...]`, // Részletes leírás
                            },
                            ...lastFiveMessages,
                            {
                                role: "assistant",
                                content: `Here are the analysis results for multiple images based on the user's input:\n\n${combinedImageResponses}\n`,
                            },
                        ],
                        temperature: 0.2,
                    };
            
                    const summaryResponse = await fetch(ENDPOINT_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });

                    await new Promise(resolve => setTimeout(resolve, 500));                    
            
                    const summaryData = await summaryResponse.text();
                    let responseData;
                    try {
                        responseData = JSON.parse(summaryData);
                    } catch (e) {
                        throw new Error("Failed to parse JSON response: " + summaryData);
                    }
            
                    if (responseData.error) {
                        throw new Error(responseData.error);
                    }
            
                    const reply = responseData.choices[0].message.content.trim();
                    await logToFile(`🤖 Assistant Final Summary:\n${reply}`);
                } catch (summaryError) {
                    console.error("❌ Error summarizing responses:", summaryError);
                } finally {
                    removeMessage(summarizingMessage);
                }
            }

    };

      
    
    const processZipWithImageRecognition = async (file, baseUploadUrl, contextForImages, conversationHistory, userLocationText, userLocation, currentDateTime) => {
        //imageUrls = await extractAndSaveImagesFromZip(file, baseUploadUrl);        
        //selectedImages = updateSelectedImages(imageUrls);  
        //imageUrls = selectedImages.map(imageUrl => baseUploadUrl + imageUrl);
        //imageUrls = selectedImages;
        //imageUrls = "";
        //imageUrls = await extractAndSaveImagesFromZip(file, baseUploadUrl);        
        //console.log(userInputToAi);
        
        if (imageUrls.length > 0) {
            //initializeImageLegend(imageUrls);
            //let userInput = await promptUserForInput();
            const lastThreeMessages = conversationHistory.filter(message => message.role !== 'system').slice(-5);

            contextForImages += `\nConversation history: \n${lastThreeMessages.map(m => m.content).join('\n\n')}`;
            contextForImages += `\nUser location: ${userLocationText}\nUser Location coordinates: ${userLocation}\nCurent Date and Time: ${currentDateTime}\nUser Input: `;

/*             if (!userInputToAi || userInputToAi === "") {
                userInputToAi = imageUrls.length === 1 ? "What’s in this image?" : "What’s in these images?";
                displayMessage(`⚠️ Missing user question, using default: '${userInputToAi}'`, "system");
                await waitForDOMUpdate();
            } */

            await analyzeImagesWithOpenAI(file, imageUrls, userInputToAi, contextForImages);
            //initializeImageLegend(imageUrls);
        } else {
            //displayMessage("❌ No valid images found in ZIP file.", "system");
        }
    };

    const processFileWithImageRecognition = async (file, baseUploadUrl, contextForImages, conversationHistory, userLocationText, userLocation, currentDateTime) => {
        //imageUrls = await extractImagesFromPdf(file, baseUploadUrl);        
        //selectedImages = updateSelectedImages(imageUrls);  
        //imageUrls = selectedImages;
        //imageUrls = "";
        //imageUrls = await extractImagesFromPdf(file, baseUploadUrl);        
        let conversationLog;        
        conversationLog = sessions[currentTabId].conversationHistory.filter(message => message.role !== 'system');
        const lastThreeMessages = conversationLog.slice(-5);
        userInput = sanitizeInput(document.getElementById("userInput").value);        
        //console.log(userInput);

        if (imageUrls.length > 0) {
            //initializeImageLegend(imageUrls);
            //let userInput = await promptUserForInput();                 
            contextForImages += `\nConversation history: \n${lastThreeMessages.map(m => m.content).join('\n\n')}`;
            contextForImages += `\nUser location: ${userLocationText}\nUser Location coordinates: ${userLocation}\nCurent Date and Time: ${currentDateTime}\nUser Input: `;

/*             if (!userInputToAi || userInputToAi === "") {
                userInputToAi = imageUrls.length === 1 ? "What’s in this image?" : "What’s in these images?";
                displayMessage(`⚠️ Missing user question, using default: '${userIuserInputToAinput}'`, "system");
                await waitForDOMUpdate();
            } */

            await analyzeImagesWithOpenAI(file, imageUrls, userInputToAi, contextForImages);            
            //initializeImageLegend(imageUrls);
        } else {
            //displayMessage("❌ No valid images found in ZIP file.", "system");
        }
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
/*             if (epubText.trim() === '') {
                const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
                displayMessage("📥 Scanned EPUB, AI will use Image Recognition...", "system");
                await processZipWithImageRecognition(file, baseUploadUrl, contextForImages, conversationHistory, userLocationText, userLocation, currentDateTime);                
            }   */
            return epubText;
        } catch (error) {
            console.error("Error reading EPUB file with JSZip:", error);
            displayMessage("❌ Error loading EPUB file.", "system");
            return '';
        }
    };


    const extractTextFromPdf = async (file, baseUploadUrl, contextForImages, conversationHistory, userLocationText, userLocation, currentDateTime) => {
        let text = '';
            
        try {    
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
            for (let i = 0; i < pdf.numPages; i++) {
                const page = await pdf.getPage(i + 1);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                text += strings.join(' ') + '\n';
            }            

             if (text.trim() === '') {
              text = `Scanned document, use AI Image Analysis Result context`;
            }           
            return text;            
        } catch (error) {
            console.error("Hiba a PDF feldolgozása során:", error);
            displayMessage("❌ Error processing PDF file.", "system");
            return text;
        }
    };

    const extractTextFromZip = async (file, userInput) => {
        const arrayBuffer = await file.arrayBuffer();
        let progressBarId = displayMessage("📦 Extracting content of ZIP file...", "system");        
        const zip = await JSZip.loadAsync(arrayBuffer);
        let combinedText = "";
        
        // Csak a fájlokat szűrjük ki (könyvtárakat kihagyjuk)
        const fileEntries = Object.entries(zip.files).filter(([fileName, file]) => !file.dir);
        const totalFiles = fileEntries.length;
        const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
        processZipWithImageRecognition(file, baseUploadUrl, contextForImages, conversationHistory, userLocationText, userLocation, currentDateTime);                
        //console.log("ZIP tartalma:", fileEntries.map(([fileName]) => fileName));
    
        // A fájlneveket UTF-8-ban próbáljuk dekódolni
        const decodedFileEntries = fileEntries.map(([fileName, file]) => {
            // Próbáljuk UTF-8 kódolással dekódolni a fájlnevet
            let decodedName = new TextDecoder("utf-8").decode(new TextEncoder().encode(fileName));
            
            // Ha a dekódolás nem sikerült, akkor próbáljunk manuálisan ékezeteket pótolni
            decodedName = decodedName.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // eltávolítjuk a nem nyomtatható karaktereket
            return [decodedName, file];
        });
    
        //console.log("ZIP tartalma (dekódolt):", decodedFileEntries.map(([fileName]) => fileName));
        //console.log("ZIP tartalma:", decodedFileEntries.map(([fileName]) => fileName));
    
        let processedIndex = 0; // Csak a ténylegesen feldolgozott fájlokat követi
        removeMessage(progressBarId);
        for (const [fileName, file] of decodedFileEntries) {
            //console.log(`Feldolgozás alatt: ${fileName}`);  
    
            processedIndex++;
            const progressMessage = `👁️ AI is reading the content of the ZIP file (${processedIndex}/${totalFiles}):\n\n/${fileName}`;
            progressBarId = displayMessage(progressMessage, "system");            
    
            const extension = fileName.split('.').pop().toLowerCase();
    
            // Támogatott fájlkiterjesztések
            const supportedExtensions = [
                'txt', 'pdf', 'epub', 'xlsx', 'odt', 'ods', 'fodt', 'fods', 'docx', 'pptx', 'odp',
                'ini', 'json', 'csv', 'js', 'html', 'htm', 'css', 'md', 'xml',
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
                'ada', 'adb', 'ads', 'pro', 'gpr', 'kts', 'build', 'gradle', 'docx', 'rtf', 'zip'
            ];
    
            if (supportedExtensions.includes(extension)) {
                try {
                    let content = '';
                    if (extension === 'pdf') {
                        content = await extractTextFromPdf(await file.async('blob'));
                    } else if (['doc', 'docx'].includes(extension)) {
                        content = await extractTextFromDoc(await file.async('blob'));
                    } else if (extension === 'epub') {
                        content = await extractTextFromEpub(await file.async('blob'));
                    } else if (['xls', 'xlsx'].includes(extension)) {
                        content = await extractTextFromXlsx(await file.async('blob'));
                    } else if (extension === 'odt') {
                        content = await extractTextFromOdt(await file.async('blob'));
                    } else if (extension === 'fodt') {
                        content = await extractTextFromFodt(await file.async('blob'));
                    } else if (extension === 'ods') {
                        content = await extractTextFromOds(await file.async('blob'));
                    } else if (extension === 'fods') {
                        content = await extractTextFromFods(await file.async('blob'));
                    } else if (extension === 'pptx') {
                        content = await extractTextFromPPTX(await file.async('blob'));
                    } else if (extension === 'odp') {
                        content = await extractTextFromODP(await file.async('blob'));
                    } else if (extension === 'rtf') {
                        content = await extractTextFromRtf(await file.async('blob'));
                    } else {
                        content = await file.async('string');
                    }
    
                    // Feldolgozott tartalom chunk-okra bontása
                    const fileChunks = splitTextIntoChunks({ [fileName]: content });
    
                    for (const chunk of fileChunks) {
                        const processedChunk = await processLargeText(chunk, userInput);
                        combinedText += `--- File: ${chunk.fileName} (Part ${chunk.part}/${chunk.totalParts}) ---\n${processedChunk}\n\n`;
                    }
    
                    // Feldolgozott index frissítése
                    removeMessage(progressBarId);
                } catch (error) {
                    console.error(`Error reading file: ${fileName}`, error);
                }
            } else {
                //console.log(`Nem támogatott fájl: ${fileName}`);
            }
        }
    
        // Progress bar eltávolítása
        removeMessage(progressBarId);
    
        //console.log("Egyesített tartalom:", combinedText);
        return combinedText;
    };
        
    

    const extractTextFromDoc = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return doc.value;
    };

    const extractTextFromXlsx = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
    
                let text = '';
    
                // Minden munkalapon végigmegyünk
                workbook.SheetNames.forEach((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    const sheetText = XLSX.utils.sheet_to_csv(worksheet, { header: 1 });
    
                    // A CSV szöveg feldolgozása
                    text += `\n\nSheet: ${sheetName}\n${sheetText}`;
                });
    
                resolve(text);
            };
    
            reader.onerror = (error) => {
                console.error("Error reading XLSX file:", error);
                reject('');
            };
    
            reader.readAsArrayBuffer(file);
        });
    };    

    const extractTextFromOdt = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
    
            // Olvassuk be a content.xml fájlt
            const contentXml = await zip.file('content.xml').async('string');
    
            // Parse-oljuk az XML tartalmat
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contentXml, 'application/xml');
    
            // Definiáljuk a 'text' névtér URI-ját
            const textNs = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
    
            // Kinyerjük a szöveges tartalmat a névtér figyelembevételével
            const textElements = xmlDoc.getElementsByTagNameNS(textNs, 'p');
            let odtText = '';
    
            for (let i = 0; i < textElements.length; i++) {
                odtText += textElements[i].textContent + '\n';
            }
            //console.log(odtText);
            return odtText;
        } catch (error) {
            console.error("Error reading ODT file:", error);
            displayMessage("❌ Error loading ODT file.", "system");
            return '';
        }
        
    };

    const extractTextFromRtf = async (file) => {
        const text = await file.text();
        return text.replace(/{\\[^}]+}/g, ''); // Alapvető RTF markup eltávolítása
    };    
    
    
    const extractTextFromFodt = async (file) => {
        try {
            const text = await file.text();
    
            // Parse-oljuk az XML tartalmat
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'application/xml');
    
            // Kinyerjük a szöveges tartalmat
            const textElements = xmlDoc.getElementsByTagName('text:p');
            let fodtText = '';
    
            for (let i = 0; i < textElements.length; i++) {
                fodtText += textElements[i].textContent + '\n';
            }
    
            return fodtText;
        } catch (error) {
            console.error("Error reading FODT file:", error);
            displayMessage("❌ Error loading FODT file.", "system");
            return '';
        }
    };
    
    const extractTextFromOds = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
    
            // Olvassuk be a content.xml fájlt
            const contentXml = await zip.file('content.xml').async('string');
    
            // Parse-oljuk az XML tartalmat
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contentXml, 'application/xml');
    
            // Kinyerjük a cellák szöveges tartalmát
            const cellElements = xmlDoc.getElementsByTagName('table:table-cell');
            let odsText = '';
    
            for (let i = 0; i < cellElements.length; i++) {
                const textP = cellElements[i].getElementsByTagName('text:p');
                for (let j = 0; j < textP.length; j++) {
                    odsText += textP[j].textContent + '\t';
                }
                odsText += '\n';
            }
    
            return odsText;
        } catch (error) {
            console.error("Error reading ODS file:", error);
            displayMessage("❌ Error loading ODS file.", "system");
            return '';
        }
    };
    
    const extractTextFromFods = async (file) => {
        try {
            const text = await file.text();
    
            // Parse-oljuk az XML tartalmat
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'application/xml');
    
            // Kinyerjük a cellák szöveges tartalmát
            const cellElements = xmlDoc.getElementsByTagName('table:table-cell');
            let fodsText = '';
    
            for (let i = 0; i < cellElements.length; i++) {
                const textP = cellElements[i].getElementsByTagName('text:p');
                for (let j = 0; j < textP.length; j++) {
                    fodsText += textP[j].textContent + '\t';
                }
                fodsText += '\n';
            }
    
            return fodsText;
        } catch (error) {
            console.error("Error reading FODS file:", error);
            displayMessage("❌ Error loading FODS file.", "system");
            return '';
        }
    };    

    const extractTextFromPPTX = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
    
            let pptText = '';
    
            // Iteráljunk a "slides" mappa fájljain
            const slideFiles = Object.keys(zip.files).filter((fileName) =>
                fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
            );
    
            for (const slideFile of slideFiles) {
                const content = await zip.file(slideFile).async('string');
    
                // Parse-oljuk az XML-t
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, 'application/xml');
    
                // Kinyerjük a szöveges tartalmat (a <a:t> elemekből)
                const textElements = xmlDoc.getElementsByTagName('a:t');
                for (let i = 0; i < textElements.length; i++) {
                    pptText += textElements[i].textContent + '\n';
                }
            }
    
            return pptText;
        } catch (error) {
            console.error("Error reading PPTX file:", error);
            displayMessage("❌ Error loading PPTX file.", "system");
            return '';
        }
    };

    const extractTextFromODP = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
    
            // Olvassuk be a content.xml fájlt
            const contentXml = await zip.file('content.xml').async('string');
    
            // Parse-oljuk az XML tartalmat
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(contentXml, 'application/xml');
    
            // Definiáljuk a 'text' névtér URI-ját
            const textNs = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
    
            // Kinyerjük a szöveges tartalmat
            let odpText = '';
            const textElements = xmlDoc.getElementsByTagNameNS(textNs, 'p');
    
            for (let i = 0; i < textElements.length; i++) {
                odpText += textElements[i].textContent + '\n';
            }
    
            return odpText;
        } catch (error) {
            console.error("Error reading ODP file:", error);
            displayMessage("❌ Error loading ODP file.", "system");
            return '';
        }
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
    
    
    

 /*    function reattachEventListeners() {
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
            } else if (messageElement.classList.contains("image")) {
                role = "image";                
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

        
        // Add change event listeners to checkboxes
        imageUrls.forEach((_, index) => {
            const checkbox = document.getElementById(`image-checkbox-${index}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    updateSelectedImages(imageUrls);
                });
            }
        }); 

        // Reattach event listeners for Perplexity Answer legends
        const legendSpansImage = document.querySelectorAll('span[id^="image-"][id$="-legend"]');

        legendSpansImage.forEach(legendSpan => {
            const messageElement = legendSpan.closest('.message');
            if (messageElement) {
                // Find the assistant message that follows the legend
                let assistantMessageElement = messageElement.nextElementSibling;
                while (assistantMessageElement && !assistantMessageElement.classList.contains('image')) {
                    assistantMessageElement = assistantMessageElement.nextElementSibling;
                }

                if (assistantMessageElement) {
                    legendSpan.addEventListener('click', () => {
                        if (assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '') {
                            assistantMessageElement.style.display = 'block';
                            legendSpan.innerHTML = `🔼 Attached Images 🔼`;
                        } else {
                            assistantMessageElement.style.display = 'none';
                            legendSpan.innerHTML = `🔽 Attached Images 🔽`;
                        }
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
        
    } */

        function reattachEventListeners() {
            const messagesDiv = document.getElementById("messages");
            if (!messagesDiv) {
                console.error("Messages container not found!");
                return;
            }
        
            const messageElements = messagesDiv.querySelectorAll(".message");
            messageElements.forEach(messageElement => {
                let role;
                if (messageElement.classList.contains("user")) {
                    role = "user";
                } else if (messageElement.classList.contains("assistant")) {
                    role = "assistant";
                } else if (messageElement.classList.contains("perplexity")) {
                    role = "perplexity";
                } else if (messageElement.classList.contains("image")) {
                    role = "image";                
                } else {
                    role = "system";
                }
        
                const contentElement = messageElement.querySelector('.content');
                const messageContent = contentElement ? contentElement.innerText : null;
        
                if (role === "assistant" && messageContent) {
                    const speakerIcon = messageElement.querySelector('.speaker-icon');
                    const copyIcon = messageElement.querySelector('.copy-icon');
                    const playPauseStopContainer = messageElement.querySelector('.play-pause-stop-container');
                    
                    if (playPauseStopContainer) playPauseStopContainer.remove();
                    if (copyIcon) copyIcon.style.display = 'inline-block';
                    if (speakerIcon) {
                        speakerIcon.style.display = 'inline-block';
                        speakerIcon.addEventListener('click', () => {
                            speakMessage(messageContent, speakerIcon);
                        });
                    }
                }
            });
        
            // Add change event listeners to checkboxes
/*             if (window.imageUrls) {
                window.imageUrls.forEach((_, index) => {
                    const checkbox = document.getElementById(`image-checkbox-${index}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => {
                            updateSelectedImages(window.imageUrls);
                        });
                    }
                });
            } */

            // Add change event listeners to checkboxes
            imageUrls.forEach((_, index) => {
                const checkbox = document.getElementById(`image-checkbox-${index}`);
                if (checkbox) {
                    checkbox.addEventListener('change', () => {
                        updateSelectedImages(imageUrls);
                    });
                }
            });             
        
            // Handle legend spans for "image" messages
            const legendSpansImage = document.querySelectorAll('span[id^="image-"][id$="-legend"]');
            legendSpansImage.forEach(legendSpan => {
                const messageElement = legendSpan.closest('.message');
                if (messageElement) {
                    let assistantMessageElement = messageElement.nextElementSibling;
                    while (assistantMessageElement && !assistantMessageElement.classList.contains('image')) {
                        assistantMessageElement = assistantMessageElement.nextElementSibling;
                    }
        
                    if (assistantMessageElement) {
                        legendSpan.addEventListener('click', () => {
                            const isHidden = assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '';
                            assistantMessageElement.style.display = isHidden ? 'block' : 'none';
                            legendSpan.innerHTML = isHidden ? `🔼 Select Images for AI Processing 🔼` : `🔽 Select Images for AI Processing 🔽`;
                        });
                    }
                }
            });
        
            // Handle Perplexity legends
            const legendSpans = document.querySelectorAll('span[id^="perplexity-"][id$="-legend"]');
            legendSpans.forEach(legendSpan => {
                const messageElement = legendSpan.closest('.message');
                if (messageElement) {
                    let assistantMessageElement = messageElement.nextElementSibling;
                    while (assistantMessageElement && !assistantMessageElement.classList.contains('perplexity')) {
                        assistantMessageElement = assistantMessageElement.nextElementSibling;
                    }
        
                    if (assistantMessageElement) {
                        legendSpan.addEventListener('click', () => {
                            const isHidden = assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '';
                            assistantMessageElement.style.display = isHidden ? 'block' : 'none';
                            legendSpan.innerHTML = isHidden ? '🔼 Perplexity AI Response 🔼' : '🔽 Perplexity AI Response 🔽';
                        });
                    }
                }
            });
        
            // Handle Bing legends
            const bingLegends = document.querySelectorAll('span[id^="bing-"][id$="-legend"]');
            bingLegends.forEach(legendSpan => {
                const bingId = legendSpan.id.replace('-legend', '');
                legendSpan.addEventListener('click', () => {
                    const contentDiv = document.getElementById(`${bingId}-content`);
                    if (contentDiv) {
                        const isHidden = contentDiv.style.display === 'none' || contentDiv.style.display === '';
                        contentDiv.style.display = isHidden ? 'block' : 'none';
                        legendSpan.innerHTML = isHidden ? '🔼 Bing Results 🔼' : '🔽 Bing Results 🔽';
                    }
                });
            });
        
            // Handle Google legends
            const googleLegends = document.querySelectorAll('span[id^="google-"][id$="-legend"]');
            googleLegends.forEach(legendSpan => {
                const googleId = legendSpan.id.replace('-legend', '');
                legendSpan.addEventListener('click', () => {
                    const contentDiv = document.getElementById(`${googleId}-content`);
                    if (contentDiv) {
                        const isHidden = contentDiv.style.display === 'none' || contentDiv.style.display === '';
                        contentDiv.style.display = isHidden ? 'block' : 'none';
                        legendSpan.innerHTML = isHidden ? '🔼 Google Results 🔼' : '🔽 Google Results 🔽';
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

        if (session.loadedFiles && session.loadedFiles.length > 0) {
            toggleRemoveFilesButton();
        }

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
        setSessionBtn.disabled = true;
        setSessionBtn.classList.remove("enabled");
        setSessionBtn.classList.add("disabled-cursor");

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
            imageUrls = [];

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

/*                 imageUrls.forEach(imageUrl => {
                    displayImage(imageUrl, "user");
                });
 */
                fileName = null;
                displayMessage(userInput, "user");
                initializeImageLegend(imageUrls, fileName);                
                await waitForDOMUpdate();
                await logToFile(`\n🧑 User: ${userInput}\n`);
                await logToFile(`🖼️ Images: ${imageUrls}\n`);
                if (imageUrls.length === 1) {
                    loadingVision = displayMessage("📷 Analyzing Image...", "system");
                } else {
                    loadingVision = displayMessage("📷 Analyzing Images...", "system");
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

// Legend toggle logika újraírása
const initializeLegendToggles = (imageUrls) => {
    const legendSpansImage = document.querySelectorAll('span[id^="image-"][id$="-legend"]');

    legendSpansImage.forEach(legendSpan => {
        const messageElement = legendSpan.closest('.message');
        if (messageElement) {
            // Kapcsolódó képüzenet keresése
            const assistantMessageElement = messageElement.nextElementSibling;
            if (assistantMessageElement && assistantMessageElement.classList.contains('image')) {
                // Legend eseménykezelő hozzáadása
                legendSpan.addEventListener('click', () => {
                    const isHidden = assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '';
                    assistantMessageElement.style.display = isHidden ? 'block' : 'none';
                    legendSpan.innerHTML = isHidden ? `🔼 Select Images for AI Processing 🔼` : `🔽 Select Images for AI Processing 🔽`;
                });
            }
        }
    });
};

// Képgaléria inicializálása és kapcsolódó legend hozzáadása
 const initializeImageLegend = (imageUrls, fileName) => {
    if (imageUrls && imageUrls.length > 0) {
        //const imageId = `image-${Date.now()}`;
        const imageId = `image-${fileName}-${Date.now()}`;
        // Legend megjelenítése rendszerüzenetként
        const legendHtml = `
        <span id="${imageId}-legend" style="cursor: pointer;">
        🔽 Select Images for AI Processing 🔽
        </span>
        `;
        displayMessage(legendHtml, "system");

        // Thumbnail megjelenítés
        const messageId = displayThumbnails(imageUrls, "image", file);
        const messageElement = document.getElementById(messageId);
        messageElement.style.display = 'none';

        // Legend toggle inicializálása
        const legendSpan = document.getElementById(`${imageId}-legend`);
        if (legendSpan) {
            legendSpan.addEventListener('click', () => {
                const isHidden = messageElement.style.display === 'none' || messageElement.style.display === '';
                messageElement.style.display = isHidden ? 'block' : 'none';
                legendSpan.innerHTML = isHidden ? `🔼 Select Images for AI Processing 🔼` : `🔽 Select Images for AI Processing 🔽`;
            });
        }        
    }    
};     



    const displayThumbnails = (imageUrls, role, file) => {
        const messagesDiv = document.getElementById("messages");
        const messageElement = document.createElement("div");
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        messageElement.id = messageId;
        messageElement.classList.add("message", role);
    
        const now = new Date();
        const formattedDate = `${now.getDate()}/${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear().toString().slice(-2)}`;
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        
        let currentFile = "Images"; // Alapértelmezett érték, ha a fájl nem található

        // Ellenőrizd, hogy a file létezik és hogy van neve
        if (file && file.name) {
            currentFile = file.name;
        } else {
            //console.error(`Fájl nem található vagy nem rendelkezik névvel.`);
        }
        
        //const avatarText = role === "user" ? "🧑 You" : `${sessions[currentTabId]?.aiProfileName || "Assistant"}`;
        let avatarText = '';
        if (role === "user") {
            avatarText = `🧑 You`;
        } else if (role === "assistant") {
            avatarText = `${session.aiProfileName}`;
        } else if (role === "image") {
            //avatarText = `🖼️ ${file.name}`;
            avatarText = `🖼️ ${currentFile || "Images"}`;
        } else if (role === "perplexity") {
            avatarText = ``;
        }
        // Galéria HTML generálása
        const galleryId = `gallery-${messageId}`;
        const thumbnailsHtml = imageUrls
        .map((url, index) => `
            <div class="thumbnail-item">
                <input type="checkbox" id="image-checkbox-${index}" class="image-checkbox">
                <label for="image-checkbox-${index}" class="thumbnail-label">
                    <img src="${url}" alt="Image ${index + 1}" class="thumbnail">
                </label>
            </div>
        `)
        .join("");

    messageElement.innerHTML = `
        <div class="avatar">${avatarText}</div>
        <div class="content">
            <div id="${galleryId}" class="gallery">
                ${thumbnailsHtml}
            </div>
        </div>
        <div class="timestamp">${formattedDate} ${formattedTime}</div>
    `;
    
        messagesDiv.appendChild(messageElement);

        
        // PhotoSwipe inicializálása
        const lightbox = new PhotoSwipeLightbox({
            gallery: `#${galleryId}`,
            children: "a",
            pswpModule: () => PhotoSwipe,
        });
    
        lightbox.init();
 
    
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
        toggleSaveButton();
        toggleUpdateButton();
        saveChatToLocalStorage();
        reattachEventListeners();
        return messageId;
    };
    
    const updateSelectedImages = (imageUrls) => {
        selectedImages = imageUrls.filter((_, index) => {
            const checkbox = document.getElementById(`image-checkbox-${index}`);
            return checkbox && checkbox.checked;
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
        let conversationLog = conversationHistory.filter(message => message.role !== 'system' && message.role !== 'user');
        const lastFiveMessages = conversationLog.slice(-5);
        //console.log(combinedImageResponses);
        const payload = {
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Your task is to process document files (long texts, books, scanned and ocr pdf files, documents with images in them).\nYou are currently processing the file: ${chunk.fileName}, Part ${chunk.part} of ${chunk.totalParts}.\nProvide a concise summary of this text chunk to help maintain context when combining chunks later. Answer the user's question based on the provided text chunk. Ensure that your responses help in connecting the threads between chunks.\n${combinedImageResponses ? `The document also contains attached images. The AI Image Analysis Result has provided summaries of these images:\n${combinedImageResponses}` : ""}\nIf the attached document is a scanned image, please respond with: "Scanned document, use AI Image Analysis Result context".\nWhen replying, also refer to this Conversation Log: `,
              },
              ...lastFiveMessages,
              { role: "user", content: `User question (also take into account the content of the Conversation Log!): ${userInput}` },
              { role: "assistant", content: `Text chunk:\n${chunk.content}` },
            ],
            temperature: 0.2,
          };
        //console.log(payload);
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

      function convertToEmoji(text) {
        return text
        .replace(/(?:^|\s):hug:(?=\s|$)/g, '🤗')
        .replace(/(?:^|\s):facepalm:(?=\s|$)/g, '🤦')
        .replace(/(?:^|\s):\|:(?=\s|$)/g, '😔')
        .replace(/(?:^|\s):ok:(?=\s|$)/g, '👌')
        .replace(/(?:^|\s):wave:(?=\s|$)/g, '👋')
        .replace(/(?:^|\s):\+\)(?=\s|$)/g, '🤭')
        .replace(/(?:^|\s):\*\*(?=\s|$)/g, '🤩')
        .replace(/(?:^|\s):lol:(?=\s|$)/g, '😂')
        .replace(/(?:^|\s):rofl:(?=\s|$)/g, '🤣')
        .replace(/(?:^|\s):thumbsup:(?=\s|$)/g, '👍')
        .replace(/(?:^|\s):thumbsdown:(?=\s|$)/g, '👎')
        .replace(/(?:^|\s):clap:(?=\s|$)/g, '👏')
        .replace(/(?:^|\s):sleepy:(?=\s|$)/g, '😴')
        .replace(/(?:^|\s):sweat:(?=\s|$)/g, '😅')
        .replace(/(?:^|\s):confused:(?=\s|$)/g, '😕')
        .replace(/(?:^|\s):grin:(?=\s|$)/g, '😁')
        .replace(/(?:^|\s):smirk:(?=\s|$)/g, '😏')
        .replace(/(?:^|\s):rollingeyes:(?=\s|$)/g, '🙄')
        .replace(/(?:^|\s):cry:(?=\s|$)/g, '😭')
        .replace(/(?:^|\s):angry:(?=\s|$)/g, '😠')
        .replace(/(?:^|\s):heart:(?=\s|$)/g, '❤️')
        .replace(/(?:^|\s):star:(?=\s|$)/g, '⭐')
        .replace(/(?:^|\s):fire:(?=\s|$)/g, '🔥')
        .replace(/(?:^|\s):100:(?=\s|$)/g, '💯')
        .replace(/(?:^|\s):poop:(?=\s|$)/g, '💩')
        .replace(/(?:^|\s):alien:(?=\s|$)/g, '👽')
        .replace(/(?:^|\s):robot:(?=\s|$)/g, '🤖')
        .replace(/(?:^|\s):ghost:(?=\s|$)/g, '👻')
        .replace(/(?:^|\s):skull:(?=\s|$)/g, '💀')
        .replace(/(?:^|\s):cat:(?=\s|$)/g, '🐱')
        .replace(/(?:^|\s):dog:(?=\s|$)/g, '🐶')
        .replace(/(?:^|\s):unicorn:(?=\s|$)/g, '🦄')
        .replace(/(?:^|\s):chicken:(?=\s|$)/g, '🐔')
        .replace(/(?:^|\s):penguin:(?=\s|$)/g, '🐧')
        .replace(/(?:^|\s):monkey:(?=\s|$)/g, '🐒')
        .replace(/(?:^|\s):turtle:(?=\s|$)/g, '🐢')
        .replace(/(?:^|\s):elephant:(?=\s|$)/g, '🐘')
        .replace(/(?:^|\s):panda:(?=\s|$)/g, '🐼')
        .replace(/(?:^|\s):apple:(?=\s|$)/g, '🍎')
        .replace(/(?:^|\s):banana:(?=\s|$)/g, '🍌')
        .replace(/(?:^|\s):pizza:(?=\s|$)/g, '🍕')
        .replace(/(?:^|\s):cake:(?=\s|$)/g, '🍰')
        .replace(/(?:^|\s):coffee:(?=\s|$)/g, '☕')
        .replace(/(?:^|\s):beer:(?=\s|$)/g, '🍺')
        .replace(/(?:^|\s):wine:(?=\s|$)/g, '🍷')
        .replace(/(?:^|\s):sun:(?=\s|$)/g, '☀️')
        .replace(/(?:^|\s):moon:(?=\s|$)/g, '🌙')
        .replace(/(?:^|\s):star2:(?=\s|$)/g, '🌟')
        .replace(/(?:^|\s):cloud:(?=\s|$)/g, '☁️')
        .replace(/(?:^|\s):zap:(?=\s|$)/g, '⚡')
        .replace(/(?:^|\s):snowflake:(?=\s|$)/g, '❄️')
        .replace(/(?:^|\s):rainbow:(?=\s|$)/g, '🌈')
        .replace(/(?:^|\s):sparkles:(?=\s|$)/g, '✨')
        .replace(/(?:^|\s):balloon:(?=\s|$)/g, '🎈')
        .replace(/(?:^|\s):tada:(?=\s|$)/g, '🎉')
        .replace(/(?:^|\s):gift:(?=\s|$)/g, '🎁')
        .replace(/(?:^|\s):party:(?=\s|$)/g, '🥳')
        .replace(/(?:^|\s):birthday:(?=\s|$)/g, '🎂')
        .replace(/(?:^|\s):soccer:(?=\s|$)/g, '⚽')
        .replace(/(?:^|\s):basketball:(?=\s|$)/g, '🏀')
        .replace(/(?:^|\s):baseball:(?=\s|$)/g, '⚾')
        .replace(/(?:^|\s):tennis:(?=\s|$)/g, '🎾')
        .replace(/(?:^|\s):football:(?=\s|$)/g, '🏈')
        .replace(/(?:^|\s):medal:(?=\s|$)/g, '🏅')
        .replace(/(?:^|\s):trophy:(?=\s|$)/g, '🏆')
        .replace(/(?:^|\s):flag:(?=\s|$)/g, '🏳️')
        .replace(/(?:^|\s):lock:(?=\s|$)/g, '🔒')
        .replace(/(?:^|\s):unlock:(?=\s|$)/g, '🔓')
        .replace(/(?:^|\s):key:(?=\s|$)/g, '🔑')
        .replace(/(?:^|\s):lightbulb:(?=\s|$)/g, '💡')
        .replace(/(?:^|\s):hammer:(?=\s|$)/g, '🔨')
        .replace(/(?:^|\s):syringe:(?=\s|$)/g, '💉')
        .replace(/(?:^|\s):cryingcat:(?=\s|$)/g, '😿')
        .replace(/(?:^|\s):sunglasses:(?=\s|$)/g, '😎')
        .replace(/(?:^|\s):blush:(?=\s|$)/g, '😊')
        .replace(/(?:^|\s):kissing:(?=\s|$)/g, '😘')
        .replace(/(?:^|\s):thinking:(?=\s|$)/g, '🤔')
        .replace(/(?:^|\s):shushing:(?=\s|$)/g, '🤫')
        .replace(/(?:^|\s):ninja:(?=\s|$)/g, '🥷')
        .replace(/(?:^|\s):spock:(?=\s|$)/g, '🖖')
        .replace(/(?:^|\s):vampire:(?=\s|$)/g, '🧛')
        .replace(/(?:^|\s):pirate:(?=\s|$)/g, '🏴‍☠️')
        .replace(/(?:^|\s):clown:(?=\s|$)/g, '🤡')
        .replace(/(?:^|\s):zombie:(?=\s|$)/g, '🧟')
        .replace(/(?:^|\s):chocolate:(?=\s|$)/g, '🍫')
        .replace(/(?:^|\s):popcorn:(?=\s|$)/g, '🍿')
        .replace (/(?:^|\s):taco:(?=\s|$)/g, '🌮')
        .replace(/(?:^|\s):hamburger:(?=\s|$)/g, '🍔')
        .replace(/(?:^|\s):hotdog:(?=\s|$)/g, '🌭')
        .replace(/(?:^|\s):fries:(?=\s|$)/g, '🍟')
        .replace(/(?:^|\s):salad:(?=\s|$)/g, '🥗')
        .replace(/(?:^|\s):pie:(?=\s|$)/g, '🥧')
        .replace(/(?:^|\s):mushroom:(?=\s|$)/g, '🍄')
        .replace(/(?:^|\s):peach:(?=\s|$)/g, '🍑')
        .replace(/(?:^|\s):\)(?=\s|$)/g, '😊')
        .replace(/(?:^|\s):\((?=\s|$)/g, '🙁')
        .replace(/(?:^|\s):D(?=\s|$)/g, '😀')
        .replace(/(?:^|\s):P(?=\s|$)/g, '😛')
        .replace(/(?:^|\s);\)(?=\s|$)/g, '😉')
        .replace(/(?:^|\s):\|(?=\s|$)/g, '😐')
        .replace(/(?:^|\s):O(?=\s|$)/g, '😮')
        .replace(/(?:^|\s):o(?=\s|$)/g, '😯')
        .replace(/(?:^|\s):S(?=\s|$)/g, '😕')
        .replace(/(?:^|\s):s(?=\s|$)/g, '😕')
        .replace(/(?:^|\s):\/(?=\s|$)/g, '😕')
        .replace(/(?:^|\s):'\((?=\s|$)/g, '😢')
        .replace(/(?:^|\s):'\)(?=\s|$)/g, '😂')
        .replace(/(?:^|\s)<3(?=\s|$)/g, '❤️')
        .replace(/(?:^|\s):\*\)(?=\s|$)/g, '😘')
        .replace(/(?:^|\s)B\)(?=\s|$)/g, '😎')
        .replace(/(?:^|\s)X\((?=\s|$)/g, '😡')
        .replace(/(?:^|\s)O:\)(?=\s|$)/g, '😇')
        .replace(/(?:^|\s)\(\^_\^\)(?=\s|$)/g, '😊')
        .replace(/(?:^|\s)<\/3(?=\s|$)/g, '💔')
        .replace(/(?:^|\s):v(?=\s|$)/g, '😆')
        .replace(/(?:^|\s):c(?=\s|$)/g, '😥');
    }

    const sendMessage = async () => {
        
        const setSessionBtn = document.getElementById("setSessionBtn");
        setSessionBtn.disabled = true;
        setSessionBtn.classList.remove("enabled");
        setSessionBtn.classList.add("disabled-cursor");
        session = sessions[currentTabId];
        let userInput = sanitizeInput(document.getElementById("userInput").value);        
        userInput = convertToEmoji(userInput);
        if (!userInput) return;
        userInputToAi = userInput;
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
        let imageContent = "";
        let perplexityCitations = [];
        let bingSearchLinks = "";
        let googleSearchLinks = "";
        let keywords = userInput;
        combinedResponses = 'No files attached';


        // if (session.fileContents) {
        //     combinedResponses = '';
        //     if (extension === 'zip') {
        //     combinedResponses = await extractTextFromZip(file);      
        //     } /* else if (extension === 'pdf') {
        //         const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
        //         displayMessage("📥 Scanned PDF, AI will use Image Recognition...", "system");
        //         await processFileWithImageRecognition(
        //             file,
        //             baseUploadUrl,
        //             contextForImages,
        //             conversationHistory,
        //             userLocationText,
        //             userLocation,
        //             currentDateTime
        //         );
        //     } else if (extension === 'epub') {
        //         const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
        //         displayMessage("📥 Scanned EPUB, AI will use Image Recognition...", "system");
        //         await processZipWithImageRecognition(
        //             file,
        //             baseUploadUrl,
        //             contextForImages,
        //             conversationHistory,
        //             userLocationText,
        //             userLocation,
        //             currentDateTime
        //         );
        //     }      */          
            
        //     const totalCharacters = Object.values(session.fileContents).reduce((acc, content) => acc + content.length, 0);

        //     if (totalCharacters > fileCharacterChunk) {
        //       const chunks = splitTextIntoChunks(session.fileContents);
              
        //       let processingMessageId = displayMessage("📄 Processing files...", "system");
        //       let response = "";
              
              
        //       for (let i = 0; i < chunks.length; i++) {
        //         const chunk = chunks[i];                
              
        //         const totalFiles = new Set(chunks.map(chunk => chunk.fileName)).size; // Egyedi fájlnevek száma
        //         const fileIndex = Array.from(new Set(chunks.map(chunk => chunk.fileName))).indexOf(chunk.fileName) + 1;
            
        //         const progressMessage = totalFiles > 1 
        //         ? chunk.totalParts > 1 
        //             ? `👁️ AI is reading (${fileIndex}/${totalFiles}):<br>📄 ${chunk.fileName} - 💬 Part ${chunk.part} of ${chunk.totalParts}`
        //             : `👁️ AI is reading (${fileIndex}/${totalFiles}):<br>📄 ${chunk.fileName}`
        //         : chunk.totalParts > 1
        //             ? `👁️ AI is reading:<br>📄 ${chunk.fileName} - 💬 Part ${chunk.part} of ${chunk.totalParts}`
        //             : `👁️ AI is reading:<br>📄 ${chunk.fileName}`;                

            
        //         removeMessage(processingMessageId);
        //         processingMessageId = displayMessage(progressMessage, "system");

        //         response = await processLargeText(chunk, userInput);
        //         combinedResponses += `\n\n${chunk.fileName} - 💬 Part ${chunk.part} response:\n${response}`;
        //       }
        
        //       // Feldolgozási üzenet eltávolítása
        //       removeMessage(processingMessageId);
        
        //       // A kombinált válasz megjelenítése
        //       //displayMessage(combinedResponses, "assistant");
        
        //       // Az új tartalom elmentése
        //       //session.fileContents = combinedResponses;
        //     } else {
        //         //session.fileContents = session.fileContents;
        //         //session.fileContents =  Object.values(session.fileContents).join('\n');
                
        //         if (extension != 'zip') {                    
        //             const fileNames = Object.keys(session.fileContents);
        //             for (const fileName of fileNames) {
        //                 const content = session.fileContents[fileName];
        //                 const chunk = {
        //                 fileName: fileName,
        //                 part: 1,
        //                 totalParts: 1,
        //                 content: content,
        //                 };

        //                 const totalFiles = fileNames.length; // Egyedi fájlnevek száma
        //                 const fileIndex = fileNames.indexOf(chunk.fileName) + 1;
                                       
        //                 const progressMessage = totalFiles > 1 
        //                     ? `👁️ AI is reading (${fileIndex}/${totalFiles}):<br>📄 ${chunk.fileName}`
        //                     : `👁️ AI is reading:<br>📄 ${chunk.fileName}`;
                            
                                
        //                 let processingMessageId = displayMessage(progressMessage, "system");                        
        //                 response = await processLargeText(chunk, userInput);
        //                 removeMessage(processingMessageId);
        //                 combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;
        //                 //session.fileContents = combinedResponses;    
        //             }
                    
        //             if (extension === 'pdf') {
        //                     const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
        //                     displayMessage("📥 Scanned PDF, AI will use Image Recognition...", "system");
        //                     await processFileWithImageRecognition(
        //                         file,
        //                         baseUploadUrl,
        //                         contextForImages,
        //                         conversationHistory,
        //                         userLocationText,
        //                         userLocation,
        //                         currentDateTime
        //                     );
        //             } else if (extension === 'epub') {
        //                 const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";        
        //                 displayMessage("📥 Scanned EPUB, AI will use Image Recognition...", "system");
        //                 await processZipWithImageRecognition(
        //                     file,
        //                     baseUploadUrl,
        //                     contextForImages,
        //                     conversationHistory,
        //                     userLocationText,
        //                     userLocation,
        //                     currentDateTime
        //                 );
        //             }                           
                        
                    
        //         }
        //   }
        // }

        // if (session.fileContents) {
        //     combinedResponses = '';
        //     combinedImageResponses = '';
        //     //imageContent = '';
        //     const fileNames = Object.keys(session.fileContents);
        
        //     for (const fileName of fileNames) {
        //         const content = session.fileContents[fileName];
        //         const extension = fileName.split('.').pop().toLowerCase(); // Fájl kiterjesztésének meghatározása
        //         const chunk = {
        //             fileName: fileName,
        //             part: 1,
        //             totalParts: 1,
        //             content: content,
        //         };
        
        //         const totalFiles = fileNames.length; // Egyedi fájlnevek száma
        //         const fileIndex = fileNames.indexOf(chunk.fileName) + 1;
        
        //         const progressMessage = totalFiles > 1
        //             ? `👁️ AI is reading (${fileIndex}/${totalFiles}):<br>📄 ${chunk.fileName}`
        //             : `👁️ AI is reading:<br>📄 ${chunk.fileName}`;
        
                
        
        //         try {
        //             if (extension === 'pdf') {
        //                 const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
        //                 //let pdfMsgId = displayMessage("📥 Images in PDF, AI will use Image Recognition...", "system");
        //                 await processFileWithImageRecognition(
        //                     file,
        //                     baseUploadUrl,
        //                     contextForImages,
        //                     conversationHistory,
        //                     userLocationText,
        //                     userLocation,
        //                     currentDateTime
        //                 );
        //                 //removeMessage(pdfMsgId);
        //                 let processingMessageId = displayMessage(progressMessage, "system");
        //                 response = await processLargeText(chunk, userInput);
        //                 combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;                        
        //                 removeMessage(processingMessageId);
        //             } else if (extension === 'epub' || extension === 'docx' || extension === 'odt' || extension === 'fodt' || extension === 'pptx' || extension === 'odp' || extension === 'xlsx' || extension === 'ods' || extension === 'fods') {
        //                 const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
        //                 let imgEpubId = displayMessage(`📥 Images in ${extension.toUpperCase()}, AI will use Image Recognition...`, "system");
        //                 await processZipWithImageRecognition(
        //                     file,
        //                     baseUploadUrl,
        //                     contextForImages,
        //                     conversationHistory,
        //                     userLocationText,
        //                     userLocation,
        //                     currentDateTime
        //                 );
        //                 removeMessage(imgEpubId);
        //                 let processingMessageId = displayMessage(progressMessage, "system");
        //                 response = await processLargeText(chunk, userInput);
        //                 combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;                        
        //                 removeMessage(processingMessageId);                      
        //             } else {
        //                 // Szöveges tartalom feldolgozása
        //                 response = await processLargeText(chunk, userInput);
        //                 combinedResponses += `\n\n${chunk.fileName} - Part ${chunk.part} response:\n${response}`;
        //             }
        //             imageContent += combinedImageResponses;
        //         } catch (error) {
        //             console.error(`Hiba a ${extension.toUpperCase()} fájl feldolgozása során:`, error);
        //         } finally {
                    
        //         }
        //     }
        // }        

        
        /* if (session.fileContents) {
            combinedResponses = '';
            combinedImageResponses = '';
        
            const fileNames = Object.keys(session.fileContents);
        
            for (const fileName of fileNames) {
                const content = session.fileContents[fileName];
                const extension = fileName.split('.').pop().toLowerCase(); // Fájl kiterjesztésének meghatározása
                const totalCharacters = content.length;
        
                // Szöveges tartalom feldolgozása chunkokra bontással, ha szükséges
                const chunks = totalCharacters > fileCharacterChunk
                    ? splitTextIntoChunks({ [fileName]: content })
                    : [{ fileName, part: 1, totalParts: 1, content }];
        
                // Az aktuális fájl létrehozása objectként az iterációhoz
                //const currentFile = file;
        
                for (const chunk of chunks) {
                    const totalParts = chunks.length;
                    const progressMessage = totalParts > 1
                        ? `👁️ AI is reading:<br>📄 ${chunk.fileName} - 💬 Part ${chunk.part} of ${chunk.totalParts}`
                        : `👁️ AI is reading:<br>📄 ${chunk.fileName}`;
        
                    let processingMessageId = displayMessage(progressMessage, "system");
                    const response = await processLargeText(chunk, userInput);
                    combinedResponses += `\n\n${chunk.fileName} - 💬 Part ${chunk.part} response:\n${response}`;
                    removeMessage(processingMessageId);
        
                    try {

                // Az aktuális fájl objektumának biztosítása
                currentFile = files.find(f => f.name === fileName);

                        // Fájl típus szerinti logika teljes fájlra
                        if (extension === 'pdf') {
                            let grabId = displayMessage(`📥 Checking for Images in ${extension.toUpperCase()}, AI will use Image Recognition...`, "system");
                            const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
                            await processFileWithImageRecognition(
                                currentFile,
                                baseUploadUrl,
                                contextForImages,
                                conversationHistory,
                                userLocationText,
                                userLocation,
                                currentDateTime
                            );
                            removeMessage(grabId);
                        } else if (['epub', 'docx', 'odt', 'fodt', 'pptx', 'odp', 'xlsx', 'ods', 'fods'].includes(extension)) {
                            let grabId = displayMessage(`📥 Checking for Images in ${extension.toUpperCase()}, AI will use Image Recognition...`, "system");
                            const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
                            //console.log(currentFile)
                            //console.log(file);
                            await processZipWithImageRecognition(
                                currentFile,
                                baseUploadUrl,
                                contextForImages,
                                conversationHistory,
                                userLocationText,
                                userLocation,
                                currentDateTime
                            );
                            removeMessage(grabId);
                        }
        
                        imageContent += combinedImageResponses;
                    } catch (error) {
                        console.error(`Hiba a ${extension.toUpperCase()} fájl feldolgozása során:`, error);
                    }
                }
            }
        } */
        
            if (session.fileContents) {
                combinedResponses = '';
                combinedImageResponses = '';
                currentFile = '';
            
                fileNames = Object.keys(session.fileContents);
            
                for (fileName of fileNames) {
                    const content = session.fileContents[fileName];
                    const extension = fileName.split('.').pop().toLowerCase(); // Fájl kiterjesztésének meghatározása
                    const totalCharacters = content.length;
            
                    // Szöveges tartalom feldolgozása chunkokra bontással, ha szükséges
                    const chunks = totalCharacters > fileCharacterChunk
                        ? splitTextIntoChunks({ [fileName]: content })
                        : [{ fileName, part: 1, totalParts: 1, content }];
            
                    // Az aktuális fájl objektumának biztosítása
                    currentFile = files.find(f => f.name === fileName);
                    if (!currentFile) {
                        console.error(`Fájl nem található: ${fileName}`);
                        continue;
                    } 
            
                    // Chunks feldolgozása
                    for (const chunk of chunks) {
                        const totalParts = chunks.length;
                        const progressMessage = totalParts > 1
                            ? `👁️ AI is reading:<br>📄 ${chunk.fileName} - 💬 Part ${chunk.part} of ${chunk.totalParts}`
                            : `👁️ AI is reading:<br>📄 ${chunk.fileName}`;
            
                        let processingMessageId = displayMessage(progressMessage, "system");
                        const response = await processLargeText(chunk, userInput);
                        combinedResponses += `\n\n${chunk.fileName} - 💬 Part ${chunk.part} response:\n${response}`;
                        removeMessage(processingMessageId);
                    }
            
                    // Csak a chunkok feldolgozása után végezzük el a képfeldolgozást
                    try {
                        if (extension === 'pdf') {
                            let grabId = displayMessage(`🔍 AI is using Image Recognition on ${extension.toUpperCase()} file...`, "system");
                            const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
                            await processFileWithImageRecognition(
                                currentFile,
                                baseUploadUrl,
                                contextForImages,
                                conversationHistory,
                                userLocationText,
                                userLocation,
                                currentDateTime
                            );
                            removeMessage(grabId);
                        } else if (['epub', 'docx', 'odt', 'fodt', 'pptx', 'odp', 'xlsx', 'ods', 'fods'].includes(extension)) {
                            let grabId = displayMessage(`🔍 AI is using Image Recognition on ${extension.toUpperCase()} file...`, "system");
                            const contextForImages = "Mandatory, you **MUST** use the available Contextual Datas for better image recognition or response:\n";
                            await processZipWithImageRecognition(
                                currentFile,
                                baseUploadUrl,
                                contextForImages,
                                conversationHistory,
                                userLocationText,
                                userLocation,
                                currentDateTime
                            );
                            removeMessage(grabId);
                        }
            
                        imageContent += combinedImageResponses;
                    } catch (error) {
                        console.error(`Hiba a ${extension.toUpperCase()} fájl feldolgozása során:`, error);
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
            const perplexityResult = await fetchPerplexitySearch("System parameters in context, use it for your response:\nCurrent Date and Time at User Location: " + currentDateTime + "\n" + userLocation + "\n" + metarDataRaw + "\n\nChat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);

            //console.log("Current date and time: " + currentDateTime + "\nChat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);
            //console.log("Chat history:\n" + lastMessagesContent + "\nActual user question: " + userInput);
            //console.log(perplexityResult);
            removeMessage(loadingPerplexityMessageId);
            if (perplexityResult) {
                perplexityContent = perplexityResult.content;
                perplexityCitations = perplexityResult.citations;                
            }
        /*console.log("perplecityResult: " + JSON.stringify(perplexityResult));
            console.log("perplexityContent: " + perplexityContent);        
            console.log("perplexityCitations: " + perplexityCitations); */
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
        //formattedLoadedFiles = `Files are attached. In all of your responses, you must use the content of the summaries of the attached files to answer. Files are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries for each part are provided in the following format:\n\nfilename.ext - Part [number] response:\n[Summary of Part [number]]\n\nMultiple files and their respective parts will be included similarly. Please concatenate these summaries to provide a comprehensive response to the user.\n\nAttached files, documents, books, text files:\n${session.loadedFiles.join('\n')}\n\nSummary of the content of the files, used to answer the user's question, use by context, you can read files by context:\n`;
        
        //formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\n  filename.ext - Part [number] response:\n  [Summary of Part [number]]\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\n  Image [number]:\n  URL: [image URL]\n  AI Image Analysis Result:\n  [Summary of the image content]\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}`;
        //formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\n  filename.ext - Part [number] response:\n  [Summary of Part [number]]\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\n  Image [number]:\n  URL: [image URL]\n  AI Image Analysis Result:\n  [Summary of the image content]\n\nIf the image URLs are relevant or useful for the response, include them as part of your answer.\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}`;
        //formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\n  filename.ext - Part [number] response:\n  [Summary of Part [number]]\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\n  Image [number]:\n  URL: [image URL]\n  AI Image Analysis Result:\n  [Summary of the image content]\n\nIf the image URLs are relevant or useful for the response, include them as part of your answer.\nAlways consider the AI Image Analysis Result, as the text-based content may not always be available (e.g.: scanned PDF file) or evaluable.\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}\n\n`;
        //formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\n  filename.ext - Part [number] response:\n  [Summary of Part [number]]\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\n  filename.ext - Image [number]:\n  URL: [image URL]\n  AI Image Analysis Result:\n  [Summary of the image content]\n\nIf the image URLs are relevant or useful for the response, include them as part of your answer.\nAlways consider the AI Image Analysis Result, as the text-based content may not always be available (e.g.: scanned PDF file) or evaluable.\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}\n\n`;
        //formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple parts, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\n  filename.ext - Part [number] response:\n  [Summary of Part [number]]\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\n  filename.ext - Image [number]:\n  URL: [image URL]\n  AI Image Analysis Result:\n  [Summary of the image content]\n\nIf the image URLs are relevant or useful for the response, include them as part of your answer.\nAlways consider the AI Image Analysis Result, as the text-based content may not always be available (e.g.: scanned PDF file) or evaluable.\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}\n\n`;
        formattedLoadedFiles = `Files are attached. In all your responses, you must use the content of the summaries of the attached files to answer.\nFiles are processed by an AI agent based on the user's request. For longer texts or books, the content is processed in multiple chunks, and summaries are provided in the following format:\n\nFor text-based content:\n- Example:\nfilename.ext - Part [number] response:\n[Summary of Part [number]]\n(For example, for a book titled 'History of Aviation', the AI breaks the book into chunks, and response 1 corresponds to the first chunk or part of the book.)\n\nFor image-based content included in the files:\nImages are analyzed individually, with results provided in this format:\n- Example:\nfilename.ext - Image [number]:\nURL: [image URL]\nAI Image Analysis Result:\n[Summary of the image content]\nThis is mandatory: It is important to use and attach images to your responses, for example the cover image of the book 'History of Aviation' could provide visual context and details related to the cover art or branding, which might be useful in answering related questions. Similarly, for a novel, an image might depict a significant element of the story, or in a scientific dissertation, the image could include diagrams or visuals directly related to the user's question. Use the images in your responses!\n\nIf the image URLs are relevant or useful for the response, include them as part of your answer. For example, if the image contains a book cover or diagram etc. that visually supports the text, you should reference it:\n\n- Example answer:\n'Here is the cover of the book, which provides an overview of the themes: ![image](URL).' \n\nAlways consider the AI Image Analysis Result, as the text-based content may not always be available (e.g.: scanned PDF file) or evaluable.\n\nAttached files, documents, images, books, text files:\n${session.loadedFiles.join('\n')}\n\n`;


    } else {
            formattedLoadedFiles = ``;
        }
      
        
        const payload = {
            model: "gpt-4o-mini",
            messages: [
                //{ role: "system", content: `System parameters in context:\nCurrent Date and Time at User Location: ${currentDateTime}\n${userLocation}\n${userLocationText}\n${metarDataRaw}\nFile Attachment contents in context (PDF, docx or other plain text file contents):\n ${combinedResponses}\nKnowledge Base to use:\n ${sessions[currentTabId].knowledgeBaseContent}\n${formattedBingResults}\n${formattedGoogleResults}\n${formattedPerplexityResults}` },
                { role: "system", content: `System parameters in context:\nCurrent Date and Time at User Location: ${currentDateTime}\n${userLocation}\n${userLocationText}\n${metarDataRaw}\n\nFile Attachment contents in context (PDF, epub, docx or other text file contents):\nIf "No files attached" appears below, it means the user did not attach any files.\n\n${formattedLoadedFiles}${combinedImageResponses}${combinedResponses}\n\nKnowledge Base to use:\n ${sessions[currentTabId].knowledgeBaseContent}\n\n${formattedBingResults}\n\n${formattedGoogleResults}\n\n${formattedPerplexityResults}` },
                ...conversationHistory
            ],
            temperature: TEMPERATURE
        };
        //console.log(perplexityContent);
        //console.log(perplexityCitations);
        //console.log(combinedImageResponses);
        //console.log(payload);
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
            await logToFile(`________`);
            await logToFile(`🧑 User: ${userInput}\n\n`);
            await logToFile(`🤖 Assistant: ${reply}\n`);
            await logToFile(`⭐ Total Tokens: ${totalTokens}`);
            await logToFile(`____________________\n\n`);




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

/*             if (imageContent) {
                const imageId = `image-${Date.now()}`;

                // Display the legend as a system message
                const legendHtml = `
                <span id="${imageId}-legend" style="cursor: pointer;">
                🔽 Images in 🔽
                </span>
                `;
                displayMessage(legendHtml, "system");

                //console.log(imageUrls);
                //const messageId = displayThumbnails(imageUrls, "image");
                const messageId = initializeImageLegend(imageUrls);
                
                const messageElement = document.getElementById(messageId);
                messageElement.style.display = 'none';

                // Add event listener to toggle display
                setTimeout(() => {
                    const legendSpan = document.getElementById(`${imageId}-legend`);
                    legendSpan.addEventListener('click', () => {
                        if (messageElement.style.display === 'none' || messageElement.style.display === '') {
                            messageElement.style.display = 'block';
                            legendSpan.innerHTML = '🔼 Images in 🔼';
                        } else {
                            messageElement.style.display = 'none';
                            legendSpan.innerHTML = '🔽 Images in 🔽';
                        }
                    });

                }, 0);
                reattachEventListeners();
                switchTab(currentTabId);
            } */


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
            userInputToAi = "";
            //combinedImageResponses = '';            
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


    const displayMessage = (message, role, subRole = null) => {
        const messagesDiv = document.getElementById("messages");        
        const messageElement = document.createElement("div");
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        messageElement.id = messageId;
        messageElement.classList.add("message", role);

        let htmlContent;
        
             if (role === "user") {
                const safeMarkdown = DOMPurify.sanitize(message, {
                    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'code', 'pre', 'br', 'span'],
                    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
                });       
 

 /*             if (role === "user") {
                const safeMarkdown = DOMPurify.sanitize(message, {
                    ALLOWED_TAGS: [
                        'b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'code', 'pre', 'br', 'span', 'div', 'blockquote', 
                        'img', 'figure', 'figcaption', 'sub', 'sup', 'dl', 'dt', 'dd', 'hr', 'mark', 'caption', 'svg', 
                        'path', 'button', 'input', 'label', 'form', 'select', 'option', 'textarea', 'style'
                    ],
                    ALLOWED_ATTR: [
                        'href', 'title', 'target', 'rel', 'class', 'id', 'style', 'src', 'alt', 'width', 'height', 
                        'align', 'valign', 'colspan', 'rowspan', 'type', 'name', 'value', 'checked', 'placeholder', 
                        'action', 'method', 'for', 'aria-label', 'aria-hidden', 'role', 'viewBox', 'd'
                    ],
                }); */
                

            htmlContent = marked.parse(safeMarkdown);
            //htmlContent = marked.parse(message);  
            //htmlContent = `<pre><code>${escapeHtml(message)}</code></pre>`;
            //htmlContent = `<pre><code>${escapeHtml(marked.parse(safeMarkdown))}</code></pre>`;
            } else if (role === "assistant" || role === "perplexity" || role === "image") {
                htmlContent = marked.parse(message);        
        } else if (role === "system") {
            // Rendszerüzeneteket közvetlenül jelenítünk meg (de sanitize-olva)
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
        } else if (role === "perplexity" || role === "image") {
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

        } else if (role === 'image') {
            messageElement.innerHTML = `
                <div class="avatar">${avatarText}</div>
                <div class="content${subRoleClass}">${htmlContent}</div>
                ${timestampHtml}
                <div class="icons-container" style="position: relative; bottom: 0px;">
                    ${role === 'assistant' || role === 'user' || role === 'perplexity' || role === 'image'? '<br>' : ''}
                </div>
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
        initializeLegendToggles();
        reattachEventListeners();

        // MathJax renderelés (ha szükséges)
        if (typeof MathJax !== "undefined") {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, messageElement]);
        }        

        //MathJax.Hub.Queue(["Typeset", MathJax.Hub, messageElement]);
        //MathJax.Hub.Queue(["Typeset", MathJax.Hub, messagesDiv]);
        
        
        return messageId;
    };    

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
                    //console.log("Test 1");
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
                        initializeLegendToggles();
                        reattachEventListeners();
                        switchTab(currentTabId);
                    }
                    initializeLegendToggles();
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
                        const formatTextForCopy = (text) => {
                            // Először távolítsuk el a fölösleges üres sorokat, de tartsuk meg a valódi sortöréseket
                            return text.replace(/\n{2,}/g, '\n\n').trim();
                        };
                        const textToCopy = formatTextForCopy(messageElement.querySelector('.content').innerText);
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
                                initializeLegendToggles();                              
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
                    } else if (target.id && target.id.endsWith('-legend') && target.id.startsWith('image-')) {
                        // Handle click on Perplexity legend
                        const perplexityId = target.id.replace('-legend', '');
                        const messageElement = target.closest('.message');

                        if (messageElement) {
                            // Find the assistant message that follows the legend
                            let assistantMessageElement = messageElement.nextElementSibling;
                            while (assistantMessageElement && !assistantMessageElement.classList.contains('image')) {
                                assistantMessageElement = assistantMessageElement.nextElementSibling;
                            }

                            if (assistantMessageElement) {                                
                                initializeLegendToggles();
                                reattachEventListeners();

                                if (assistantMessageElement.style.display === 'none' || assistantMessageElement.style.display === '') {
                                    assistantMessageElement.style.display = 'block';
                                    target.innerHTML = `🔼 Select Images for AI Processing 🔼`;
                                } else {
                                    assistantMessageElement.style.display = 'none';
                                    target.innerHTML = `🔽 Select Images for AI Processing 🔽`;
                                }
                            }
                        }                       
                    } else if (target.id.startsWith('bing-')) {
                        // Handle Bing legend click
                        initializeLegendToggles();
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
                        initializeLegendToggles();
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
                    //const cssFilename = `<?php echo $css_build_number; ?>`;  // PHP változó, amit átadunk JS-nek
                    fetch(`css/${cssFilename}`)
                    .then(response => response.text())
                    .then(cssContent => {
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
        
                            ${cssContent}

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
                })
                .catch(error => console.error("CSS fájl betöltése sikertelen:", error));
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

                if (session.loadedFiles && session.loadedFiles.length > 0) {
                    toggleRemoveFilesButton();
                }                

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

    

    

    const removeMessage = (messageId) => {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.remove();
        }
        toggleSaveButton();
        toggleUpdateButton();
    };

})();