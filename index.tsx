/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

// --- DOM Elements ---
const inputView = document.getElementById('input-view') as HTMLDivElement;
const recipeView = document.getElementById('recipe-view') as HTMLDivElement;
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const recipeForm = document.getElementById('recipe-form') as HTMLFormElement;
const dishInput = document.getElementById('dish-input') as HTMLInputElement;
const recipeStepText = document.getElementById('recipe-step-text') as HTMLParagraphElement;
const prevStepBtn = document.getElementById('prev-step-btn') as HTMLButtonElement;
const nextStepBtn = document.getElementById('next-step-btn') as HTMLButtonElement;
const repeatStepBtn = document.getElementById('repeat-step-btn') as HTMLButtonElement;
const startOverBtn = document.getElementById('start-over-btn') as HTMLButtonElement;
const errorMessageDiv = document.getElementById('error-message') as HTMLDivElement;

// --- App State ---
let recipeSteps: string[] = [];
let currentStepIndex = 0;
let ai: GoogleGenAI;

// --- Functions ---

/**
 * Shows a specific view ('input', 'recipe', 'loading') and hides others.
 * @param viewName The name of the view to show.
 */
function showView(viewName: 'input' | 'recipe' | 'loading' | 'error') {
  inputView.classList.add('hidden');
  recipeView.classList.add('hidden');
  loadingSpinner.classList.add('hidden');
  errorMessageDiv.classList.add('hidden');

  switch (viewName) {
    case 'input':
      inputView.classList.remove('hidden');
      break;
    case 'recipe':
      recipeView.classList.remove('hidden');
      break;
    case 'loading':
      loadingSpinner.classList.remove('hidden');
      break;
    case 'error':
      errorMessageDiv.classList.remove('hidden');
      break;
  }
}

/**
 * Displays an error message to the user.
 * @param message The error message to display.
 */
function showError(message: string) {
    errorMessageDiv.textContent = `Oops! Something went wrong. ${message}. Please try again.`;
    showView('error');
    // Add a button to go back to the input view after an error
    const backButton = document.createElement('button');
    backButton.textContent = 'Try Again';
    backButton.onclick = () => {
        showView('input');
        errorMessageDiv.innerHTML = ''; // Clear previous error
    };
    // To prevent multiple buttons, clear previous content
    errorMessageDiv.innerHTML = '';
    const errorText = document.createElement('p');
    errorText.textContent = `Oops! Something went wrong: ${message}.`;
    errorMessageDiv.appendChild(errorText);
    errorMessageDiv.appendChild(backButton);
}


/**
 * Uses the browser's SpeechSynthesis API to read text aloud.
 * @param text The text to be spoken.
 */
function speak(text: string) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel(); // Stop any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  } else {
    console.warn("Speech Synthesis not supported in this browser.");
  }
}

/**
 * Updates the UI to display the current recipe step and manages button states.
 */
function updateRecipeStepUI() {
  if (recipeSteps.length === 0) return;

  const currentStep = recipeSteps[currentStepIndex];
  recipeStepText.textContent = currentStep;

  // Update button states
  prevStepBtn.disabled = currentStepIndex === 0;
  nextStepBtn.disabled = currentStepIndex === recipeSteps.length - 1;

  speak(currentStep);
}

/**
 * Fetches a recipe from the Gemini API for the given dish.
 * @param dishName The name of the dish.
 */
async function getRecipe(dishName: string) {
  showView('loading');
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a simple, step-by-step recipe for ${dishName}. Provide only the instructions.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              description: "A list of steps for the recipe.",
              items: {
                type: Type.STRING,
                description: "A single instruction step for the recipe."
              }
            }
          }
        }
      }
    });

    const responseText = response.text.trim();
    const recipeData = JSON.parse(responseText);

    if (recipeData && recipeData.steps && recipeData.steps.length > 0) {
      recipeSteps = recipeData.steps;
      currentStepIndex = 0;
      updateRecipeStepUI();
      showView('recipe');
    } else {
      throw new Error("Could not find a recipe for that dish.");
    }

  } catch (error) {
    console.error("Error fetching recipe:", error);
    showError(error instanceof Error ? error.message : "An unknown error occurred");
  }
}


// --- Event Handlers ---

function handleFormSubmit(event: Event) {
  event.preventDefault();
  const dishName = dishInput.value.trim();
  if (dishName) {
    getRecipe(dishName);
  }
}

function handleNextStep() {
  if (currentStepIndex < recipeSteps.length - 1) {
    currentStepIndex++;
    updateRecipeStepUI();
  }
}

function handlePrevStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    updateRecipeStepUI();
  }
}

function handleRepeatStep() {
  updateRecipeStepUI(); // Re-reads the current step
}

function handleStartOver() {
    recipeSteps = [];
    currentStepIndex = 0;
    dishInput.value = '';
    speechSynthesis.cancel();
    showView('input');
}


// --- Initialization ---

function initialize() {
  if (!process.env.API_KEY) {
    showError("API_KEY is not configured.");
    return;
  }
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  recipeForm.addEventListener('submit', handleFormSubmit);
  nextStepBtn.addEventListener('click', handleNextStep);
  prevStepBtn.addEventListener('click', handlePrevStep);
  repeatStepBtn.addEventListener('click', handleRepeatStep);
  startOverBtn.addEventListener('click', handleStartOver);

  showView('input');
}

// Start the app
initialize();
