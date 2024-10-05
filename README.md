# HungaryVFR CoPilot WebUI Chat Application

## Overview

The HungaryVFR CoPilot WebUI Chat Application is a web-based, general-purpose chatbot powered by the OpenAI API. It allows users to engage in conversations with an AI assistant on a wide range of topics. The application supports custom knowledge bases in its own format, enabling users to enhance the AI's responses with specialized information. 
Knowledge base examples are included to help you get started.

Designed for flexibility and adaptability, this chatbot can be tailored to various use cases, from casual conversation to domain-specific assistance. Whether you want to use it for general inquiries, educational purposes, or integrate your own data, the HungaryVFR CoPilot WebUI Chat Application provides a robust platform for interactive AI experiences.

The application is designed with modularity in mind, allowing certain functions to be easily integrated into existing websites. This means you can customize and embed the chatbot into your own site, tailoring it to specific needs. For example, if you have a website focused on a particular product, you can set up the chatbot to use your own pre-defined AI profile and knowledge base, providing users with specialized assistance related to your product.

This project is a web-based counterpart to the HungaryVFR CoPilot Discord bot, sharing the same knowledge base but functioning independently. While it provides details on Discord commands, it does not execute them. 

## Features

- **AI-Powered Chatbot**: Engage in conversations with an AI assistant.
- **Multiple Tabs and Sessions**: Manage multiple chat sessions with tabbed navigation.
- **Customizable AI Profiles**: Load different AI profiles or use custom initial prompts to tailor the assistant's behavior.
- **Knowledge Base Integration**: Load knowledge base files to provide the assistant with specialized information.
- **File Attachments**: Upload text, EPUB, PDF, or Word documents to include their content in the conversation context.
- **Speech Recognition and Synthesis**: Use speech-to-text for input and text-to-speech for the assistant's responses.
- **Image Recognition**: Using OpenAI Vision for image recognition. 
- **Search Integration**: Optionally enable Bing, Google, and Perplexity searches to enhance responses with real-time information.
- **Location Awareness**: Optionally share your location to receive localized information like weather updates.
- **Export / Import**: Export and Import your chat sessions.
- **Easy Copy AI responses**: Click on the ``📋`` icon to copy AI responses (or your own input).

## Demo
[HungaryVFR CoPilot full functionality](https://hungaryvfr.hu/images/HVFR_CoPilot_preview.jpg)

[HungaryVFR AI Support page - modular](https://hungaryvfr.hu/chat/index.php)

## Installation

### Prerequisites

- **Web Server**: A server capable of running PHP scripts.
- **API Keys**: You'll need API keys for the following services:
  - **OpenAI GPT API**: For AI-powered responses.
  - **Bing Search API**: For integrating Bing search results.
  - **Google Custom Search API**: For integrating Google search results.
  - **Perplexity API**: For integrating Perplexity search results.
  - **Open-Meteo API**: For fetching weather data (this API does not require a key).
  - **Nominatim API**: For reverse geocoding (this API does not require a key).

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/darealgege/hungaryvfr-copilot.git

2. Set Up API Keys
   The application requires several API keys. Below are the details on which keys are needed and where to place them.
   - OpenAI GPT API Key
     - Purpose: To generate AI responses.
     - Where to get it: [OpenAI API Keys](https://platform.openai.com/account/api-keys)
     - Where to place it: In the ``get_config.php`` and ``process_image.php`` file.
     - Instructions:
     - Open ``get_config.php``. Find the line:
       ```
       $OPENAI_API_KEY = '';
     - Place your OpenAI API key between the quotes.
     - Open ``process_image.php``. Find the line:
       ```
       $apiKey = '';
     - Place your OpenAI API key between the quotes.
   - Bing Search API Key
     - Purpose: To enable Bing search integration.
     - Where to get it: [Azure Portal - Bing Search APIs](https://azure.microsoft.com/en-us/services/cognitive-services/bing-web-search-api/)
     - Where to place it: In the ``bing.php`` file.
     - Instructions:
     - Open ``bing.php``. Find the line:
       ```
       $BING_API_KEY = '';
     - Place your Bing Search API key between the quotes.
   - Google Custom Search API Key and Search Engine ID
     - Purpose: To enable Google search integration.
     - Where to get it: 
       - API Key: [Google Cloud Console](https://console.cloud.google.com/apis/)
       - Search Engine ID: [Google Custom Search Engine](https://programmablesearchengine.google.com/controlpanel/all)
     - Where to place them: In the ``google.php`` file.
     - Instructions:
     - Open ``google.php``. Find the lines:
      ```
       $GOOGLE_API_KEY = '';
       $GOOGLE_SEARCH_ENGINE_ID = '';
      ```
     - Place your Google API key and Search Engine ID between the quotes.
   - Perplexity API Key
     - Purpose: To enable Perplexity search integration.
     - Where to get it: [Perplexity AI](https://docs.perplexity.ai/guides/getting-started)
     - Where to place it: In the ``perplexity.php`` file.
     - Instructions:
     - Open ``perplexity.php``.
     - Find the line:
       ```
       $PERPLEXITY_API_KEY = '';
       ```
     - Place your Perplexity API key between the quotes.
3. Configure Server
   Ensure that your web server is configured to serve PHP files and that all necessary permissions are set.
4. Upload the application files to your web server.
5. Open the application in a web browser and verify that it's functioning correctly.

### Usage
Starting a Conversation
Simply type your message into the input box and press send. The AI assistant will respond based on the current context and any loaded knowledge bases.
### Managing Tabs
- Add Tab: Click the ``➕`` button to start a new chat session.
- Close Tab: Click the ``❌`` icon on a tab to close it.
- Rename Tab: Right-click on a tab and click on ``✍️ Rename Tab`` to rename it.
- Lock a Tab: Right-click on the tab and click on ``🔒 Lock Tab`` (``🔓 Unlock Tab`` to unlock a locked tab)

### Customizing the AI Assistant
- Initial Prompts: Choose from predefined AI profiles or enter a custom initial prompt.
- Knowledge Base: Load additional knowledge base files to provide the assistant with more information.

### File Attachments
Attach text, PDF, or Word documents by clicking the ``➕`` button. The content will be included in the conversation context. To remove all attached files click on ``➖`` button (attached files will be removed with new sessions).

### Speech Recognition and Synthesis
- Speech-to-Text: Use the ``🎤`` button to input messages via speech.
- Text-to-Speech: Click the ``🔊`` next to a message to have it read aloud.

### Search Integration
Enable or disable Bing, Google, and Perplexity searches using the toggles. When enabled, the assistant will use these services to enhance its responses.

### Location Awareness
Enable location sharing to allow the assistant to provide localized information such as weather updates.

### API Keys and Configuration
- OpenAI GPT-4 API Key
  - File: ``config.php``
  - Instructions: Open ``config.php``. Set your OpenAI API key:
    ```
    $OPENAI_API_KEY = 'your-openai-api-key';
  - File: ``process_image.php``
  - Instructions: Open ``process_image.php``. Set your OpenAI API key:
    ```
    $apiKey = 'your-openai-api-key';
- Bing Search API Key
  - File: ``bing.php``
  - Instructions: Open ``bing.php``. Set your Bing API key:
    ```
    $BING_API_KEY = 'your-bing-api-key';
- Google Custom Search API Key and Search Engine ID
  - File: ``google.php``
  - Instructions: Open ``google.php``. Set your Google API key and Search Engine ID:
    ```
    $GOOGLE_API_KEY = 'your-google-api-key';
    $GOOGLE_SEARCH_ENGINE_ID = 'your-search-engine-id';
- Perplexity API Key
  - File: ``perplexity.php``
  - Instructions: Open ``perplexity.php``. Set your Perplexity API key:
    ```
    $PERPLEXITY_API_KEY = 'your-perplexity-api-key';
    ```
    
### Obtaining API Keys
- OpenAI GPT-4 API Key
  - Sign up or log in to the OpenAI Platform. Navigate to the API keys section to create a new key.
- Bing Search API Key
  - Visit the Azure Portal. Create a new resource for Bing Search v7 API. Retrieve the key from the keys section.
- Google Custom Search API Key and Search Engine ID
  - API Key: Go to the Google Cloud Console. Create a new API key.
  - Search Engine ID: Visit Google Custom Search Engine. Create a new search engine and note the Search Engine ID.
- Perplexity API Key
  - API Key: Read the Getting Started section
   
### Contributing
- Contributions are welcome! Please open an issue or submit a pull request.

### License
- MIT License.
