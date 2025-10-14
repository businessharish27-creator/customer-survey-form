/* ===== common helpers ===== */
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

/* ===== index.html ===== */
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
  navigateTo('survey.html');
}

/* ===== survey.html ===== */
async function submitSurvey(status) {
  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) {
    alert('Phone number missing. Please start again.');
    return navigateTo('index.html');
  }

  showLoading();

  try {
    const apiUrl = `${window.location.origin}/api/leadsquared`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status })
    });

    const data = await res.json().catch(() => ({}));
    console.log('API Response:', data);

    if (!res.ok) {
      hideLoading();
      alert('Submission failed. Please try again.');
      return;
    }

    hideLoading();
    navigateTo('thank_you.html');
  } catch (err) {
    console.error('Network error:', err);
    hideLoading();
    alert('Network error. Please try again.');
  }
}

/* ===== feedback.html ===== */
async function handleFeedbackSubmit(event) {
  event.preventDefault();

  const feedbackEl = document.getElementById('feedback');
  const feedback = feedbackEl?.value.trim();
  if (!feedback) {
    alert('Please enter your feedback before submitting.');
    return;
  }

  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) {
    alert('Phone number missing. Please start again.');
    return navigateTo('index.html');
  }

  showLoading();

  try {
    const apiUrl = `${window.location.origin}/api/leadsquared`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, status: 'Unsatisfied', feedback })
    });

    const data = await res.json().catch(() => ({}));
    console.log('Feedback API Response:', data);

    if (!res.ok) {
      hideLoading();
      alert('Submission failed. Please try again.');
      return;
    }

    hideLoading();
    navigateTo('thank_you.html');
  } catch (err) {
    console.error('Network error:', err);
    hideLoading();
    alert('Network error. Please try again.');
  }
}
