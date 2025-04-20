document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
  const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
  const copyResultBtn = document.getElementById('copy-result-btn') as HTMLButtonElement;
  const minimizeBtn = document.getElementById('minimize-btn') as HTMLButtonElement;
  const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;
  const screenshotImg = document.getElementById('screenshot-img') as HTMLImageElement;
  const placeholderText = document.getElementById('placeholder-text') as HTMLDivElement;
  const analysisOutput = document.getElementById('analysis-output') as HTMLDivElement;
  const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

  // Screenshot data storage
  let currentScreenshotData: string | null = null;
  let hasAnalysisResult = false;

  // Function to clear the current screenshot
  const clearScreenshot = () => {
    // Reset UI elements
    if (screenshotImg.src) {
      // Clean up any blob URLs
      if (screenshotImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotImg.src);
      }
      screenshotImg.src = '';
    }
    
    screenshotImg.style.display = 'none';
    placeholderText.textContent = 'Capture a screenshot to analyze it';
    placeholderText.style.display = 'block';
    
    // Disable buttons that need a screenshot
    analyzeBtn.disabled = true;
    sendBtn.disabled = true;
    clearBtn.disabled = true;
    copyResultBtn.disabled = true;
    
    // Clear the analysis area
    analysisOutput.textContent = 'Analysis will appear here after processing...';
    hasAnalysisResult = false;
    
    // Clear the current screenshot data
    currentScreenshotData = null;
  };

  // Copy result to clipboard
  copyResultBtn.addEventListener('click', () => {
    const textToCopy = analysisOutput.textContent || '';
    
    if (textToCopy && textToCopy !== 'Analysis will appear here after processing...') {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          // Show temporary feedback that copy was successful
          const originalText = copyResultBtn.textContent;
          copyResultBtn.textContent = 'Copied!';
          
          setTimeout(() => {
            copyResultBtn.textContent = originalText;
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    }
  });

  // Clear Screenshot button
  clearBtn.addEventListener('click', clearScreenshot);

  // Capture screenshot
  captureBtn.addEventListener('click', async () => {
    try {
      // Update UI
      captureBtn.disabled = true;
      captureBtn.textContent = 'Capturing...';
      
      // Show capturing state
      screenshotImg.style.display = 'none';
      placeholderText.textContent = 'Capturing content...';
      placeholderText.style.display = 'block';
      
      // Disable buttons
      analyzeBtn.disabled = true;
      sendBtn.disabled = true;
      clearBtn.disabled = true;
      copyResultBtn.disabled = true;
      
      // Clear old image
      if (screenshotImg.src) {
        if (screenshotImg.src.startsWith('blob:')) {
          URL.revokeObjectURL(screenshotImg.src);
        }
        screenshotImg.src = '';
      }
      
      // Take the screenshot
      const dataUrl = await window.electronAPI.captureScreenshot();
      
      // Create a new Image to verify it loads correctly
      const testImage = new Image();
      
      testImage.onload = () => {
        // Image loaded successfully, update the UI
        currentScreenshotData = dataUrl;
        
        // Apply to the visible image element with cache busting
        const timestamp = Date.now();
        screenshotImg.src = `${dataUrl}#t=${timestamp}`;
        
        // Show the image
        screenshotImg.style.display = 'block';
        placeholderText.style.display = 'none';
        
        // Enable buttons
        analyzeBtn.disabled = false;
        sendBtn.disabled = false;
        clearBtn.disabled = false;
        copyResultBtn.disabled = false;
        
        // Update message
        analysisOutput.textContent = 'Screenshot captured. Click "Analyze with Claude" to process it.';
      };
      
      testImage.onerror = () => {
        console.error('Failed to load captured image data');
        placeholderText.textContent = 'Error loading screenshot. Please try again.';
        analysisOutput.textContent = 'Error loading screenshot. Please try again.';
      };
      
      // Test if the image loads
      testImage.src = dataUrl;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      placeholderText.textContent = 'Error capturing screenshot. Please try again.';
      analysisOutput.textContent = 'Error capturing screenshot. Please try again.';
    } finally {
      // Re-enable button
      captureBtn.disabled = false;
      captureBtn.textContent = 'Capture Screenshot';
    }
  });

  // Analyze screenshot with Claude
  analyzeBtn.addEventListener('click', async () => {
    if (!currentScreenshotData) {
      analysisOutput.textContent = 'No screenshot available. Capture one first.';
      return;
    }

    try {
      // Disable copy button during analysis
      copyResultBtn.disabled = true;
      hasAnalysisResult = false;
      
      analysisOutput.textContent = 'Analyzing screenshot with Claude...';
      const result = await window.electronAPI.callAnthropicAPI(
        currentScreenshotData,
        'What can you see in this screenshot?'
      );
      
      if (result.success) {
        analysisOutput.textContent = result.analysis;
        // Enable copy button now that we have results
        copyResultBtn.disabled = false;
        hasAnalysisResult = true;
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
      // Disable copy button during processing
      copyResultBtn.disabled = true;
      hasAnalysisResult = false;
      
      analysisOutput.textContent = `Processing: "${prompt}"...`;
      const result = await window.electronAPI.callAnthropicAPI(
        currentScreenshotData,
        prompt
      );
      
      if (result.success) {
        analysisOutput.textContent = result.analysis;
        // Enable copy button now that we have results
        copyResultBtn.disabled = false;
        hasAnalysisResult = true;
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
    window.electronAPI.minimizeWindow();
  });
  
  closeBtn.addEventListener('click', () => {
    window.close();
  });
});
