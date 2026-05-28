export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "No recipe text provided" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `You are a recipe parser. Extract structured recipe data from the following content.

CRITICAL: If the content contains MULTIPLE distinct dishes (e.g. a main course AND side dishes AND sauces), split them into SEPARATE recipe objects. A steak recipe with a pepper salad and rice should become 3 separate recipes, not 1.

Respond ONLY with a valid JSON array (even if there's only one recipe), no markdown backticks, no preamble.

Each recipe object in the array must have:
{
  "title": "string",
  "description": "string (1-2 sentence summary)",
  "mealType": "Main" or "Side" or "Appetizer" or "Dessert" or "Drink",
  "servings": number,
  "prepTime": "string (e.g. '15 min')",
  "cookTime": "string (e.g. '45 min')",
  "tags": ["relevant tags from: Beef, Chicken, Pork, Seafood, Vegetarian, Proteins, Greens, Grains, Italian, Mexican, Asian, Grilling, Smoking, Quick Weeknight, Weekend Project, Date Night, Comfort Food, Healthy, Soup/Stew, Breakfast, Dessert, Appetizer, Brisket BBQ"],
  "ingredients": [{"name": "string", "amount": number, "unit": "string"}],
  "steps": ["string array of clear instructions"],
  "sides": ["suggested side dishes if this is a main"],
  "drinks": ["suggested drink pairings"]
}

Content to parse:
${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(500).json({ error: "Anthropic API returned an error: " + response.status });
    }

    const data = await response.json();
    const raw = data.content?.map((c) => c.text || "").join("") || "";
    const clean = raw.replace(/```json|```/g, "").trim();

    if (!clean) {
      return res.status(500).json({ error: "Empty response from API" });
    }

    const parsed = JSON.parse(clean);
    const recipes = Array.isArray(parsed) ? parsed : [parsed];
    return res.status(200).json(recipes);
  } catch (e) {
    console.error("Parse error:", e);
    return res.status(500).json({ error: "Failed to parse recipe: " + e.message });
  }
}
