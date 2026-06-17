const key = "YOUR_GEMINI_KEY";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

async function list() {
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed:", res.status, await res.text());
    return;
  }
  const data = await res.json() as any;
  console.log("Models:", data.models.map((m: any) => m.name));
}

list();
