// api/leadsquared.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, status, feedback } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Missing phone' });
    }

    // Normalize phone into +971-XXXXXXXXX format and digitsOnly for searches
    // Accepts input like "+971-5XXXXXXXX" or "+971-XXXXXXXXX" or "05XXXXXXXX"
    const digitsOnlyIn = (phone || '').replace(/\D/g, ''); // remove non-digits
    // Ensure we keep only last 9 digits for the UAE mobile
    const last9 = digitsOnlyIn.slice(-9);
    const phoneNumber = `+971-${last9}`;
    const digitsOnlyForSearch = `971${last9}`; // e.g. 9715XXXXXXXX (no + or hyphens)

    // ---- 0️⃣ Try to retrieve FirstName from LeadSquared using phone ----
    let firstName = '';
    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;

    if (accessKey && secretKey) {
      try {
        const retrieveUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}&phone=${encodeURIComponent(digitsOnlyForSearch)}`;

        const getRes = await fetch(retrieveUrl, { method: 'GET' });
        if (getRes.ok) {
          const getJson = await getRes.json().catch(() => null);
          if (Array.isArray(getJson) && getJson.length > 0) {
            firstName = getJson[0].FirstName || '';
          }
        } else {
          // Non-fatal: log it and continue
          const txt = await getRes.text().catch(()=>null);
          console.warn('RetrieveLeadByPhoneNumber failed:', getRes.status, txt);
        }
      } catch (err) {
        console.warn('Error calling RetrieveLeadByPhoneNumber:', err?.message || err);
      }
    } else {
      console.warn('LeadSquared keys missing; skipping retrieve step.');
    }

    // ---- 1️⃣ Create/Update Lead in LeadSquared (if keys present) ----
    const payload = [
      { Attribute: "Phone", Value: phoneNumber },
      { Attribute: "SearchBy", Value: "Phone" }
    ];
    if (firstName) payload.push({ Attribute: "FirstName", Value: firstName });
    if (status) payload.push({ Attribute: "mx_Customer_Satisfaction_Survey", Value: status });
    if (feedback) payload.push({ Attribute: "mx_feedback", Value: feedback });

    if (accessKey && secretKey) {
      try {
        const apiUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate?postUpdatedLead=false&accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}`;
        const apiRes = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        // note: don't assume body is JSON; ignore result except errors
        if (!apiRes.ok) {
          const txt = await apiRes.text().catch(()=>null);
          console.warn('Lead.CreateOrUpdate non-ok:', apiRes.status, txt);
        }
      } catch (err) {
        console.warn('Error calling Lead.CreateOrUpdate:', err?.message || err);
      }
    }

    // ---- 2️⃣ Send row to Google Sheets (Apps Script URL) ----
    // Recommended: store your Apps Script Web App URL in Vercel env on > SHEET_WEBAPP_URL
    const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL;

    if (!SHEET_WEBAPP_URL) {
      console.warn('No SHEET_WEBAPP_URL configured; skipping sheet write.');
    } else {
      const sheetPayload = {
        firstName: firstName || '',
        phone: phoneNumber,
        status: status || '',
        feedback: feedback || ''
      };

      const sheetRes = await fetch(SHEET_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetPayload)
      });

      if (!sheetRes.ok) {
        const txt = await sheetRes.text().catch(()=>null);
        console.error('Google Sheets write failed:', sheetRes.status, txt);
        return res.status(500).json({ error: 'Failed to store response in Google Sheets', details: txt });
      }
    }

    // ---- ✅ Success ----
    return res.status(200).json({ success: true, firstName });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  }
}
