// api/leadsquared.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, status, feedback, action } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    // --- Normalize phone formats ---
    const digitsOnly = (phone || '').replace(/\D/g, '');
    const last9 = digitsOnly.slice(-9);
    const phoneForCRM = `+971-${last9}`;
    const phoneForSheet = last9;

    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;
    const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL;

    let existingLeadStage = null;
    let existingFirstName = '';
    let leadExists = false;

    // --- Retrieve existing lead info ---
    if (accessKey && secretKey) {
      try {
        const retrieveUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}&phone=${encodeURIComponent(phoneForCRM)}`;
        const getRes = await fetch(retrieveUrl, { method: 'GET' });
        if (getRes.ok) {
          const json = await getRes.json().catch(() => []);
          if (Array.isArray(json) && json.length > 0) {
            const lead = json[0];
            existingLeadStage = lead.ProspectStage || null;
            existingFirstName = lead.FirstName || '';
            leadExists = true;
          }
        }
      } catch (err) {
        console.warn('RetrieveLeadByPhoneNumber failed:', err?.message || err);
      }
    }

    // --- If the request is just for retrieval (index.html step) ---
    if (action === 'retrieve') {
      return res.status(200).json({
        success: true,
        firstName: existingFirstName,
        exists: leadExists
      });
    }

    // --- Update Lead (preserve stage) ---
    if (accessKey && secretKey) {
      try {
        const payload = [
          { Attribute: 'Phone', Value: phoneForCRM },
          { Attribute: 'SearchBy', Value: 'Phone' },
          { Attribute: 'OwnerId', Value: System },
          { Attribute: 'mx_Customer_Satisfaction_Survey', Value: status || '' },
          { Attribute: 'mx_feedback', Value: feedback || '' }
        ];

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
    }

    // --- Send to Google Sheet (plain 9 digits) ---
    if (SHEET_WEBAPP_URL) {
      const sheetPayload = {
        phone: phoneForSheet,
        status: status || '',
        feedback: feedback || ''
      };
      try {
        await fetch(SHEET_WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetPayload)
        });
      } catch (err) {
        console.error('Error writing to Google Sheets:', err);
      }
    }

    return res.status(200).json({
      success: true,
      firstName: existingFirstName,
      isExisting: leadExists
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err?.message || String(err)
    });
  }
}
