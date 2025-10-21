// api/leadsquared.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, status, feedback, action } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    // Extract digits and normalize formats
    const digitsOnly = (phone || '').replace(/\D/g, '');
    const last9 = digitsOnly.slice(-9);
    const phoneForCRM = `+971-${last9}`; // ✅ For LeadSquared
    const phoneForSheet = `971${last9}`;  // ✅ For Google Sheet (plain)

    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;
    const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL;

    // Helper: Retrieve Lead by phone
    async function retrieveByPhone(p) {
      if (!accessKey || !secretKey) return { exists: false, firstName: '' };
      try {
        const url = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}&phone=${encodeURIComponent(p)}`;
        const r = await fetch(url, { method: 'GET' });
        const txt = await r.text();
        let json = null;
        try { json = JSON.parse(txt); } catch {}
        if (Array.isArray(json) && json.length > 0) {
          return { exists: true, firstName: json[0].FirstName || '' };
        }
        return { exists: false, firstName: '' };
      } catch (err) {
        console.warn('retrieveByPhone error:', err?.message || err);
        return { exists: false, firstName: '' };
      }
    }

    // Step 1: Retrieve name (for front-end display)
    if (action === 'retrieve') {
      let result = await retrieveByPhone(phoneForCRM);
      if (!result.exists) result = await retrieveByPhone(`971${last9}`);
      return res.status(200).json({
        success: true,
        firstName: result.firstName || '',
        exists: !!result.exists
      });
    }

    // Step 2: On submission — update LeadSquared
    let result = await retrieveByPhone(phoneForCRM);
    if (!result.exists) result = await retrieveByPhone(`971${last9}`);
    const finalFirstName = result.firstName || '';

    if (accessKey && secretKey) {
      try {
        const payload = [
          { Attribute: 'Phone', Value: phoneForCRM },
          { Attribute: 'SearchBy', Value: 'Phone' },
          { Attribute: 'mx_Customer_Satisfaction_Survey', Value: status || '' },
          { Attribute: 'mx_feedback', Value: feedback || '' }
        ];

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

    // --- Send to Google Sheet (plain 971 format) ---
    if (SHEET_WEBAPP_URL) {
      const sheetPayload = {
        phone: phoneForSheet,
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
    }

    return res.status(200).json({ success: true, firstName: finalFirstName });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err?.message || String(err)
    });
  }
}
