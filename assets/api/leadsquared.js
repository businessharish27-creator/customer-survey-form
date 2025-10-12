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

    // Build LeadSquared payload: array of Attribute/Value objects
    const payload = [
      { Attribute: "Phone Number", Value: phone },
      { Attribute: "SearchBy", Value: "Phone Number" }
    ];

    if (status) {
      payload.push({ Attribute: "mx_Customer_Satisfaction_Survey", Value: status });
    }
    if (feedback) {
      payload.push({ Attribute: "mx_feedback", Value: feedback });
    }

    const accessKey = process.env.LEADSQUARED_ACCESS_KEY;
    const secretKey = process.env.LEADSQUARED_SECRET_KEY;

    if (!accessKey || !secretKey) {
      return res.status(500).json({ error: 'Server not configured (missing keys)' });
    }

    const apiUrl = `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate?postUpdatedLead=false&accessKey=${encodeURIComponent(accessKey)}&secretKey=${encodeURIComponent(secretKey)}`;

    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseJson = await apiRes.json().catch(()=>null);

    if (!apiRes.ok) {
      return res.status(apiRes.status || 500).json({ error: 'Leadsquared error', details: responseJson });
    }

    return res.status(200).json(responseJson);
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
