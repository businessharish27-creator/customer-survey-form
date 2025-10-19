/* ===== common helpers ===== */
function navigateTo(path) { window.location.href = path; }
function showLoading() {
  const ol = document.getElementById('loadingOverlay'); if (ol) ol.style.display = 'flex';
}
function hideLoading() {
  const ol = document.getElementById('loadingOverlay'); if (ol) ol.style.display = 'none';
}

/* ===== index.html ===== */
async function handleSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('phone');
  if (!input) return;

  const raw = input.value.trim();
  if (!/^[0-9]{9}$/.test(raw)) {
    alert('Please enter a valid 9-digit phone number (5XXXXXXXX).');
    return;
  }

  const fullPhone = '+971-' + raw;
  // call API to retrieve existing firstName
  showLoading();
  try {
    const res = await fetch('/api/leadsquared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: fullPhone, action: 'retrieve' })
    });
    const json = await res.json().catch(()=>({}));
    const firstName = (json.firstName || '').trim();
    const exists = !!json.exists;

    // store in sessionStorage
    sessionStorage.setItem('phoneNumber', fullPhone);
    sessionStorage.setItem('firstName', firstName || '');
    sessionStorage.setItem('isExisting', exists ? '1' : '0');

    hideLoading();
    navigateTo('survey.html');
  } catch (err) {
    console.error('Retrieve error', err);
    hideLoading();
    // Still save phone and default to new lead
    sessionStorage.setItem('phoneNumber', fullPhone);
    sessionStorage.setItem('firstName', '');
    sessionStorage.setItem('isExisting', '0');
    navigateTo('survey.html');
  }
}

/* ===== survey.html ===== */
function renderGreeting() {
  const name = sessionStorage.getItem('firstName') || '';
  const isExisting = sessionStorage.getItem('isExisting') === '1';
  const container = document.querySelector('.container');
  // Insert greeting at top of container (below h1)
  const h1 = container.querySelector('h1');
  // Remove existing greeting if any
  const old = document.getElementById('greetingLine'); if (old) old.remove();

  const greet = document.createElement('div');
  greet.id = 'greetingLine';
  greet.style.marginTop = '8px';
  greet.style.marginBottom = '12px';
  greet.style.fontSize = '1.15rem';
  greet.style.color = '#B4985A';
  greet.textContent = isExisting && name ? `Hello, ${name}! Share your feedback with us.` : 'Hello, Customer! Share your feedback with us.';
  h1.insertAdjacentElement('afterend', greet);
}

// Call when survey page loads
if (document.body.classList.contains('page-survey')) {
  document.addEventListener('DOMContentLoaded', renderGreeting);
}

async function submitSurvey(status) {
  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) { alert('Phone number missing. Please start again.'); return navigateTo('index.html'); }

  // read firstName from session
  let firstName = sessionStorage.getItem('firstName') || '';
  const isExisting = sessionStorage.getItem('isExisting') === '1';
  if (!firstName) firstName = isExisting ? '' : 'NO NAME'; // if not existing -> NO NAME

  showLoading();
  try {
    const res = await fetch('/api/leadsquared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, firstName, status })
    });
    const json = await res.json().catch(()=>({}));
    console.log('API Response:', json);

    if (!res.ok) {
      hideLoading();
      alert('Submission failed. Please try again.');
      return;
    }

    // store firstName returned by server (if any)
    if (json.firstName) sessionStorage.setItem('firstName', json.firstName);
    if (json.isExisting) sessionStorage.setItem('isExisting', '1');

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
  const feedbackEl = document.getElementById('feedback'); const feedback = feedbackEl?.value.trim();
  if (!feedback) { alert('Please enter your feedback before submitting.'); return; }

  const phone = sessionStorage.getItem('phoneNumber');
  if (!phone) { alert('Phone number missing. Please start again.'); return navigateTo('index.html'); }

  let firstName = sessionStorage.getItem('firstName') || '';
  const isExisting = sessionStorage.getItem('isExisting') === '1';
  if (!firstName) firstName = isExisting ? '' : 'NO NAME';

  showLoading();
  try {
    const res = await fetch('/api/leadsquared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, firstName, status: 'Unsatisfied', feedback })
    });
    const json = await res.json().catch(()=>({}));
    console.log('Feedback API Response:', json);

    if (!res.ok) { hideLoading(); alert('Submission failed. Please try again.'); return; }

    if (json.firstName) sessionStorage.setItem('firstName', json.firstName);
    if (json.isExisting) sessionStorage.setItem('isExisting', '1');

    hideLoading();
    navigateTo('thank_you.html');
  } catch (err) {
    console.error('Network error:', err);
    hideLoading();
    alert('Network error. Please try again.');
  }
}
