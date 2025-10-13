/* ===== common helpers used by all pages ===== */

function navigateTo(path) {
  window.location.href = path;
}

function showLoading() {
  const ol = document.getElementById('loadingOverlay');
  if (ol) ol.style.display = 'flex';
}

function hideLoading() {
  const ol = document.getElementById('loadingOverlay');
  if (ol) ol.style.display = 'none';
}

/* index.html: store phone and go to survey */
function handleSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('phone');
  if (!input) return;
  const raw = input.value.trim();
  if (!/^[0-9]{9}$/.test(raw)) {
    alert('Please enter a valid 9-digit phone number (5XXXXXXXX).');
    return;
  }
  const fullPhone = '+971-' + raw;
  sessionStorage.setItem('phoneNumber', fullPhone);
  window.location.href = 'survey.html';
}

/* survey.html: satisfied click calls serverless API and then redirect */
async function submitSurvey(status) {
  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) {
    alert('Phone number missing. Please start again.');
    window.location.href = 'index.html';
    return;
  }

  showLoading();

  try {
    // CHANGE 1: Use window.location.origin to build the absolute path
    const apiUrl = `${window.location.origin}/api/leadsquared`;
    
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status })
    });

    // ... (error handling)
} catch (e) {
    // ...
}
}


/* feedback.html: submit feedback */
async function handleFeedbackSubmit(event) {
    // ... (setup code)

    showLoading();

    try {
        // CHANGE 2: Use window.location.origin to build the absolute path
        const apiUrl = `${window.location.origin}/api/leadsquared`;
        
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, status: 'Unsatisfied', feedback })
        });
        
        // ... (error handling)
    } catch (e) {
        // ...
    }
}

/* feedback.html: submit feedback */
async function handleFeedbackSubmit(event) {
  event.preventDefault();
  const feedbackEl = document.getElementById('feedback');
  const feedback = (feedbackEl && feedbackEl.value || '').trim();
  if (!feedback) {
    alert('Please enter your feedback before submitting.');
    return;
  }
  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) {
    alert('Phone number missing. Please start again.');
    window.location.href = 'index.html';
    return;
  }

  showLoading();

  try {
    const res = await fetch('/api/leadsquared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status: 'Unsatisfied', feedback })
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>null);
      console.error('Server error', err);
      alert('Submission failed. Please try again.');
      hideLoading();
      return;
    }

    window.location.href = 'thankyou.html';
  } catch (e) {
    console.error(e);
    alert('Network error. Please try again.');
    hideLoading();
  }
}
