// VIP Access Code
const VIP_CODE = 'VIP';

// Main domain redirect
const MAIN_DOMAIN = 'https://www.thechiefnegotiators.com';

// Get form elements
const accessForm = document.getElementById('accessForm');
const accessCodeInput = document.getElementById('accessCode');
const errorMessage = document.getElementById('errorMessage');

// Handle form submission
accessForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const enteredCode = accessCodeInput.value.trim().toUpperCase();
    
    // Clear previous error message
    errorMessage.textContent = '';
    
    // Validate access code
    if (enteredCode === VIP_CODE) {
        // Success - redirect to main domain
        accessForm.classList.add('form-success');
        errorMessage.textContent = '';
        
        setTimeout(() => {
            window.location.href = MAIN_DOMAIN;
        }, 500);
    } else {
        // Error - shake form and show message
        accessForm.classList.add('form-error');
        errorMessage.textContent = 'Invalid access code. Please try again.';
        accessCodeInput.value = '';
        
        // Remove shake animation after completion
        setTimeout(() => {
            accessForm.classList.remove('form-error');
        }, 500);
        
        // Focus input for retry
        accessCodeInput.focus();
    }
});

// Focus on input on page load
window.addEventListener('load', () => {
    accessCodeInput.focus();
});

// Clear error message when user starts typing
accessCodeInput.addEventListener('input', () => {
    errorMessage.textContent = '';
});