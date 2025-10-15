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

    // Format phone as +971-XXXXXXXXX (9 digits)
    const formattedPhone = phone.replace(/^0+/, ''); // remove leading zeros
    const phoneNumber = `+971-${formattedPhone.slice(-9)}`;

    // Build LeadSquared payload
    const payload = [
      { Attribute: "Phone", Value: phoneNumber },
      { Attribute: "SearchBy", Value: "Phone" }
    ];

    if (status) {
      payload.push({ Attribute: "mx_Customer_Satisfaction_Survey", Value: status });
    }
    if (feedback) {
      payload.push({ Attribute: "mx_feedback", Value: feedback });
    }

    // ---- 1️⃣ Send to LeadSquared ----
    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;

    if (!accessKey || !secretKey) {
      console.warn('⚠️ Missing LeadSquared keys — skipping LeadSquared update.');
    } else {
      const apiUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate?postUpdatedLead=false&accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}`;

      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // ---- 2️⃣ Send to Google Sheets ----
    // Replace this URL with your Google Apps Script Web App URL
    const SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwiwiE1Dw-mJiuq8iTYGM4hSm0SfwMbhhZgCk_znjOHl1i3Xh6Ioklxiix0zdhElvV74g/exec";

    const sheetPayload = {
      phone: phoneNumber,
      status: status || "",
      feedback: feedback || ""
    };

    const sheetRes = await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetPayload)
    });

    const sheetResponse = await sheetRes.text();

    if (!sheetRes.ok) {
      console.error("Google Sheets API error:", sheetResponse);
      return res.status(500).json({ error: 'Failed to store response in Google Sheets' });
    }

    // ---- ✅ Success ----
    return res.status(200).json({
      message: 'Data submitted successfully to LeadSquared and Google Sheets',
      sheetResponse
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
