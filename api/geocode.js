// Proxies reverse geocoding to OpenStreetMap Nominatim (free, no key) — done
// server-side so we can set a proper User-Agent per Nominatim's usage policy
// and avoid client-side CORS issues.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { lat, lng } = req.body || {};
  if (typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "lat and lng (numbers) are required" });
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const geoRes = await fetch(url, {
      headers: { "User-Agent": "SoinDeSoie-Website/1.0 (checkout address lookup)" },
    });
    if (!geoRes.ok) throw new Error(`Nominatim returned ${geoRes.status}`);
    const data = await geoRes.json();
    res.status(200).json({ address_text: data.display_name || null });
  } catch (err) {
    console.error(err);
    res.status(200).json({ address_text: null });
  }
}
