document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
  const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
  const minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
  const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
  const screenshotImg = document.getElementById('screenshot-img') as HTMLImageElement;
  const placeholderText = document.getElementById('placeholder-text') as HTMLDivElement;
  const analysisOutput = document.getElementById('analysis-output') as HTMLDivElement;
  const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

  // Screenshot data storage
  let currentScreenshotData: string | null = null;

  // Capture screenshot
  captureBtn.addEventListener('click', async () => {
    try {
      currentScreenshotData = await window.electronAPI.captureScreenshot();
      
      // Display the screenshot
      if (currentScreenshotData) {
        screenshotImg.src = currentScreenshotData;
        screenshotImg.style.display = 'block';
        placeholderText.style.display = 'none';
        
        // Enable analyze button
        analyzeBtn.disabled = false;
        sendBtn.disabled = false;
        
        // Update analysis area
        analysisOutput.textContent = 'Screenshot captured. Click "Analyze with Claude" to process it.';
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      analysisOutput.textContent = 'Error capturing screenshot. Please try again.';
    }
  });

  // Analyze screenshot with Claude
  analyzeBtn.addEventListener('click', async () => {
    if (!currentScreenshotData) {
      analysisOutput.textContent = 'No screenshot available. Capture one first.';
      return;
    }

    try {
      analysisOutput.textContent = 'Analyzing screenshot with Claude...';
      const result = await window.electronAPI.callAnthropicAPI(
        currentScreenshotData,
        'What can you see in this screenshot?'
      );
      
      if (result.success) {
        analysisOutput.textContent = result.analysis;
      } else {
        analysisOutput.textContent = 'Analysis failed. Please try again.';
      }
    } catch (error) {
      console.error('Failed to analyze screenshot:', error);
      analysisOutput.textContent = 'Error during analysis. Please try again.';
    }
  });

  // Send custom prompt
  sendBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || !currentScreenshotData) return;
    
    try {
      analysisOutput.textContent = `Processing: "${prompt}"...`;
      const result = await window.electronAPI.callAnthropicAPI(
        currentScreenshotData,
        prompt
      );
      
      if (result.success) {
        analysisOutput.textContent = result.analysis;
      } else {
        analysisOutput.textContent = 'Analysis failed. Please try again.';
      }
      
      // Clear the input
      promptInput.value = '';
    } catch (error) {
      console.error('Failed to process prompt:', error);
      analysisOutput.textContent = 'Error processing your request. Please try again.';
    }
  });

  // Allow Enter key to send prompt
  promptInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !sendBtn.disabled) {
      sendBtn.click();
    }
  });

  // Window controls
  minimizeBtn.addEventListener('click', () => {
    // This will be implemented in the main process
    console.log('Minimize clicked');
  });
  
  closeBtn.addEventListener('click', () => {
    window.close();
  });
});
