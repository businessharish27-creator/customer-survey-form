// api/leadsquared.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, status, feedback } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    // --- Normalize phone formats ---
    const digitsOnly = (phone || '').replace(/\D/g, '');
    const last9 = digitsOnly.slice(-9); // Keep only last 9 digits

    const phoneForCRM = `+971-${last9}`; // LeadSquared expects full format
    const phoneForSheet = last9;          // Send only 9 digits to Google Sheet

    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;
    const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL;

    // --- 1️⃣ Retrieve Existing Lead Stage (to preserve it) ---
    let existingLeadStage = null;
    if (accessKey && secretKey) {
      try {
        const retrieveUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}&phone=${encodeURIComponent(phoneForCRM)}`;
        const getRes = await fetch(retrieveUrl, { method: 'GET' });
        if (getRes.ok) {
          const json = await getRes.json().catch(() => []);
          if (Array.isArray(json) && json.length > 0) {
            // ✅ Correct schema name: ProspectStage
            existingLeadStage = json[0].ProspectStage || null;
          }
        }
      } catch (err) {
        console.warn('RetrieveLeadByPhoneNumber failed:', err?.message || err);
      }
    }

    // --- 2️⃣ Update Lead in LeadSquared (preserve ProspectStage) ---
    if (accessKey && secretKey) {
      try {
        const payload = [
          { Attribute: 'Phone', Value: phoneForCRM },
          { Attribute: 'SearchBy', Value: 'Phone' },
          { Attribute: 'mx_Customer_Satisfaction_Survey', Value: status || '' },
          { Attribute: 'mx_feedback', Value: feedback || '' }
        ];

        // Preserve existing stage if found
        if (existingLeadStage) {
          payload.push({ Attribute: 'ProspectStage', Value: existingLeadStage });
        }

        const apiUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate?postUpdatedLead=false&accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}`;

        const apiRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!apiRes.ok) {
          const txt = await apiRes.text().catch(() => null);
          console.warn('Lead.CreateOrUpdate failed:', apiRes.status, txt);
        }
      } catch (err) {
        console.warn('Error calling Lead.CreateOrUpdate:', err?.message || err);
      }
    } else {
      console.warn('LeadSquared keys missing; skipping update.');
    }

    // --- 3️⃣ Send to Google Sheet (only 9-digit format) ---
    if (SHEET_WEBAPP_URL) {
      const sheetPayload = {
        phone: phoneForSheet, // ✅ just the 9 digits
        status: status || '',
        feedback: feedback || ''
      };

      try {
        const sheetRes = await fetch(SHEET_WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload)
        });

        if (!sheetRes.ok) {
          const txt = await sheetRes.text().catch(() => null);
          console.error('Google Sheets write failed:', sheetRes.status, txt);
          return res.status(500).json({
            error: 'Failed to store response in Google Sheets',
            details: txt
          });
        }
      } catch (err) {
        console.error('Error writing to Google Sheets:', err);
      }
    } else {
      console.warn('SHEET_WEBAPP_URL not configured; skipping sheet write.');
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err?.message || String(err)
    });
  }
}
